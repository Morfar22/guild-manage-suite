"use strict";

const ADMINISTRATOR = 8n;
const INTERVAL_MS = 60_000;
const VALIDITY_MS = 120_000;

function isAdministrator(guild, member) {
  if (!member) return false;
  if (member.id === guild.ownerId) return true;
  return (BigInt(member.permissions.bitfield) & ADMINISTRATOR) !== 0n;
}

function setupGuildAccessVerifier(
  client,
  supabase,
  { shouldHandleGuild = () => true } = {},
) {
  let stopped = false;
  let running = false;
  let rerun = false;
  const generations = new Map();
  const listeners = [];
  const allowedGuild = (id) =>
    /^\d{16,22}$/.test(id || "") && shouldHandleGuild(id);
  const check = (result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };

  async function scan() {
    if (stopped || !client.isReady?.()) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const links = [];
      for (let offset = 0; !stopped; offset += 500) {
        const page =
          check(
            await supabase
              .from("user_guilds")
              .select(
                "id,guild_id,user_id,discord_user_id,guilds!inner(guild_id)",
              )
              .order("id")
              .range(offset, offset + 499),
          ) || [];
        links.push(...page);
        if (page.length < 500) break;
      }
      const groups = new Map();
      for (const link of links || []) {
        const discordId = link.guilds?.guild_id;
        if (!allowedGuild(discordId)) continue;
        if (!groups.has(discordId)) groups.set(discordId, []);
        groups.get(discordId).push(link);
      }
      for (const [discordId, guildLinks] of groups) {
        const generation = generations.get(discordId) || 0;
        let guild;
        try {
          guild = await client.guilds.fetch({ guild: discordId, force: true });
          await guild.roles.fetch();
        } catch {
          continue;
        } // Do not renew a claim without Discord confirmation.
        for (const link of guildLinks) {
          if (stopped || generation !== (generations.get(discordId) || 0))
            break;
          let member;
          try {
            member = await guild.members.fetch({
              user: link.discord_user_id,
              force: true,
            });
          } catch (error) {
            if (![10007, 10013].includes(Number(error.code))) continue;
            member = null;
          }
          if (stopped || generation !== (generations.get(discordId) || 0))
            break;
          const admin = isAdministrator(guild, member);
          check(
            await supabase
              .from("user_guilds")
              .update({
                has_admin_permission: admin,
                admin_verified_until: admin
                  ? new Date(Date.now() + VALIDITY_MS).toISOString()
                  : null,
              })
              .eq("id", link.id)
              .eq("discord_user_id", link.discord_user_id),
          );
        }
      }
    } catch (error) {
      console.error("[GuildAccess] Verification failed:", error.message);
    } finally {
      running = false;
      if (rerun && !stopped) {
        rerun = false;
        void scan();
      }
    }
  }

  async function invalidate(discordId, userId) {
    if (stopped || !allowedGuild(discordId)) return;
    generations.set(discordId, (generations.get(discordId) || 0) + 1);
    const { data: guild, error } = await supabase
      .from("guilds")
      .select("id")
      .eq("guild_id", discordId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!guild) return;
    let query = supabase
      .from("user_guilds")
      .update({ has_admin_permission: false, admin_verified_until: null })
      .eq("guild_id", guild.id);
    if (userId) query = query.eq("discord_user_id", userId);
    check(await query);
    await scan();
  }
  const on = (event, fn) => {
    const wrapped = (...args) => {
      void Promise.resolve(fn(...args)).catch((error) =>
        console.error("[GuildAccess] Revocation failed:", error.message),
      );
    };
    client.on(event, wrapped);
    listeners.push([event, wrapped]);
  };
  on("guildMemberUpdate", (old, member) => {
    const before = old?.roles?.cache,
      after = member.roles?.cache;
    if (
      before &&
      after &&
      before.size === after.size &&
      [...before.keys()].every((id) => after.has(id))
    )
      return;
    return invalidate(member.guild.id, member.id);
  });
  on("guildMemberRemove", (member) => invalidate(member.guild.id, member.id));
  on("roleUpdate", (_old, role) => invalidate(role.guild.id));
  on("roleDelete", (role) => invalidate(role.guild.id));
  on("guildUpdate", (_old, guild) => invalidate(guild.id));
  on("guildDelete", (guild) => invalidate(guild.id));
  on("clientReady", () => scan());
  const interval = setInterval(() => void scan(), INTERVAL_MS);
  interval.unref?.();
  void scan();
  return {
    scan,
    invalidate,
    cleanup() {
      stopped = true;
      clearInterval(interval);
      for (const [event, fn] of listeners) client.off(event, fn);
    },
  };
}

module.exports = { setupGuildAccessVerifier, isAdministrator, VALIDITY_MS };
