"use strict";

const { PermissionFlagsBits } = require("discord.js");
const LEASE_SECONDS = 90;
const MAX_ATTEMPTS = 5;
const permanentCodes = new Set([
  10003, 10004, 10007, 10011, 50001, 50013, 50035,
]);

function shopError(message, reason = "delivery_unavailable") {
  return Object.assign(new Error(message), { permanent: true, reason });
}

function permanent(error) {
  return Boolean(
    error?.permanent ||
    permanentCodes.has(Number(error?.code)) ||
    (Number(error?.status) >= 400 &&
      Number(error?.status) < 500 &&
      ![408, 429].includes(Number(error?.status))),
  );
}

function ambiguous(error) {
  // An explicit Discord 4xx rejected this request. Network/5xx/timeout outcomes
  // may already have changed Discord and must not trigger an automatic refund.
  const status = Number(error?.status);
  return !(
    permanent(error) ||
    (status >= 400 && status < 500 && status !== 408)
  );
}

function description(error) {
  return `${error?.code ? `Discord ${error.code}: ` : ""}${error?.message || "Ukendt leveringsfejl"}`.slice(
    0,
    500,
  );
}

async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

async function inspectRoleDelivery(guild, userId, roleId) {
  const role = await guild.roles.fetch(roleId, { force: true });
  if (!role || role.id === guild.id || role.managed) {
    throw shopError(
      "Butikkens rolle findes ikke eller kan ikke tildeles af botten.",
      "invalid_role",
    );
  }
  const member = await guild.members.fetch({ user: userId, force: true });
  if (member.roles.cache.has(roleId))
    return { role, member, alreadyOwned: true };
  const me = await guild.members.fetchMe({ force: true });
  if (
    !me.permissions.has(PermissionFlagsBits.ManageRoles) ||
    me.roles.highest.comparePositionTo(role) <= 0
  ) {
    throw shopError(
      "Botten mangler Administrer roller, eller butikkens rolle ligger over bottens højeste rolle.",
      "missing_role_permission",
    );
  }
  return { role, member, alreadyOwned: false };
}

async function reserveOrder(supabase, interaction, guildId, item) {
  return rpc(supabase, "bot_shop_reserve", {
    p_interaction_id: interaction.id,
    p_guild_id: guildId,
    p_user_id: interaction.user.id,
    p_user_name: interaction.user.username,
    p_item_id: item.id,
    p_expected_role_id: item.role_id || null,
    p_expected_price: item.price,
  });
}

async function processShopOrder(client, supabase, candidate, options = {}) {
  const discordGuildId = candidate.guilds?.guild_id || options.guild?.id;
  const canContinue = () =>
    !options.isStopped?.() &&
    (!options.shouldHandleGuild || options.shouldHandleGuild(discordGuildId));
  if (!canContinue()) return null;
  const job = await rpc(supabase, "bot_shop_claim", {
    p_id: candidate.id,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (!job) return null;
  let renewed = true;
  let renewing = false;
  const heartbeat = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      renewed = await rpc(supabase, "bot_shop_extend", {
        p_id: job.id,
        p_token: job.lease_token,
        p_lease_seconds: LEASE_SECONDS,
      });
    } catch {
      renewed = false;
    } finally {
      renewing = false;
    }
  }, 30_000);
  heartbeat.unref?.();
  const finish = async (outcome, error, uncertain = false) => {
    const result = await rpc(supabase, "bot_shop_finish", {
      p_id: job.id,
      p_token: job.lease_token,
      p_outcome: outcome,
      p_error: error ? description(error) : null,
      p_uncertain: uncertain,
    });
    if (!result)
      throw new Error("Shop order lease lost before acknowledgement");
    return result;
  };
  try {
    let delivery;
    try {
      if (!discordGuildId) throw shopError("Ordren mangler en Discord-server.");
      const guild =
        options.guild || (await client.guilds.fetch(discordGuildId));
      if (!guild || guild.id !== discordGuildId)
        throw shopError("Ordren tilhører en anden Discord-server.");
      delivery = await inspectRoleDelivery(guild, job.user_id, job.role_id);
    } catch (error) {
      const outcome = permanent(error) ? "refund" : "retry";
      return finish(outcome, error);
    }

    // A previous attempt (including one interrupted by restart) may have
    // succeeded. A fresh member fetch proves the requested final state.
    if (delivery.alreadyOwned) {
      return finish(
        job.attempted_delivery ? "delivered" : "refund",
        job.attempted_delivery
          ? null
          : shopError("Rollen var allerede tildelt; købet tilbagebetales."),
      );
    }
    if (job.exhausted || job.attempt_count > MAX_ATTEMPTS) {
      return finish(
        job.delivery_uncertain ? "manual_review" : "refund",
        shopError(
          "Leveringen kunne ikke bekræftes efter fem forsøg. Kontrollér ordren manuelt.",
        ),
      );
    }
    if (!canContinue()) throw new Error("Shop owner changed before delivery");
    if (!renewed)
      throw new Error("Shop order lease renewal failed before delivery");
    const held = await rpc(supabase, "bot_shop_mark_attempted", {
      p_id: job.id,
      p_token: job.lease_token,
    });
    if (!held) throw new Error("Shop order lease lost before delivery");
    try {
      // Passing ONE role uses Discord's idempotent PUT endpoint, never a full
      // member-role PATCH that could overwrite unrelated role changes.
      await delivery.member.roles.add(job.role_id, `Butik ordre ${job.id}`);
    } catch (error) {
      return finish(
        permanent(error) ? "refund" : "retry",
        error,
        ambiguous(error),
      );
    }
    // Keep the acknowledgement outside the delivery catch. An acknowledgement
    // outage is recovered by checking role presence, not by refunding a success.
    return finish("delivered");
  } finally {
    clearInterval(heartbeat);
  }
}

async function processPendingShopOrders(client, supabase, options = {}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("bot_shop_orders")
    .select("*, guilds!inner(guild_id)")
    .in("status", ["pending", "processing"])
    .or(
      `and(status.eq.pending,next_attempt_at.lte.${now}),and(status.eq.processing,lease_expires_at.lte.${now})`,
    )
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  let processed = 0;
  for (const order of data || []) {
    const discordGuildId = order.guilds?.guild_id;
    if (
      !discordGuildId ||
      (options.shouldHandleGuild && !options.shouldHandleGuild(discordGuildId))
    )
      continue;
    try {
      if (await processShopOrder(client, supabase, order, options)) processed++;
    } catch (error) {
      console.error(`[Shop] ${order.id}:`, description(error));
    }
  }
  return processed;
}

module.exports = {
  inspectRoleDelivery,
  reserveOrder,
  processShopOrder,
  processPendingShopOrders,
  shopError,
};
