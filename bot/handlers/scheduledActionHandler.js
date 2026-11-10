/** Persistent moderation jobs. A failed Discord request is never executed=true. */
const {
  listDueJobs,
  runJob,
  permanentJobError,
} = require("../utils/durableJobs");

async function executeAction(client, action) {
  const discordGuildId = action.guilds?.guild_id;
  const guild =
    client.guilds.cache.get(discordGuildId) ||
    (await client.guilds.fetch(discordGuildId));
  if (!guild) throw permanentJobError("Botten har ikke adgang til serveren");
  const reason = action.reason || "Planlagt moderation";
  const target = action.target_discord_id;
  switch (action.action_type) {
    case "mute": {
      const until = new Date(
        new Date(action.execute_at).getTime() + 60 * 60 * 1000,
      );
      if (until <= new Date())
        throw permanentJobError(
          "Mute-perioden er udløbet før handlingen kunne udføres",
        );
      const member = await guild.members.fetch(target);
      if (!member) throw permanentJobError("Medlemmet findes ikke på serveren");
      // Retrying must not extend a one-hour timeout by another hour.
      await member.disableCommunicationUntil(until, reason);
      break;
    }
    case "ban":
      await guild.members.ban(target, { reason });
      break;
    case "unban":
      try {
        await guild.members.unban(target, reason);
      } catch (error) {
        // Unknown Ban confirms the desired final state, including crash recovery.
        if (Number(error.code) !== 10026) throw error;
      }
      break;
    case "role_add":
    case "role_remove": {
      if (!action.role_id) throw permanentJobError("Handlingens rolle mangler");
      const member = await guild.members.fetch(target);
      if (!member) throw permanentJobError("Medlemmet findes ikke på serveren");
      if (action.action_type === "role_add")
        await member.roles.add(action.role_id, reason);
      else await member.roles.remove(action.role_id, reason);
      break;
    }
    case "kick": {
      const member = await guild.members.fetch(target);
      if (!member) throw permanentJobError("Medlemmet findes ikke på serveren");
      try {
        await member.kick(reason);
      } catch (error) {
        // A transport error/5xx can arrive after Discord performed the kick.
        // Retrying could kick a member who already rejoined. Explicit 429 is a
        // safe retry; permanent 4xx failures are classified by the queue helper.
        if (!error.status || Number(error.status) >= 500) {
          throw permanentJobError(
            "Kick-resultatet er ukendt efter en forbindelsesfejl. Kontrollér Discord før handlingen gentages.",
          );
        }
        throw error;
      }
      break;
    }
    default:
      throw permanentJobError(`Ukendt handling: ${action.action_type}`);
  }
}

async function processDueScheduledActions(client, supabase, options = {}) {
  const actions = await listDueJobs(
    supabase,
    "scheduled_actions",
    "execute_at",
    options.now || new Date(),
  );
  let executed = 0;
  for (const candidate of actions) {
    const discordGuildId = candidate.guilds?.guild_id;
    if (
      !discordGuildId ||
      (options.shouldHandleGuild && !options.shouldHandleGuild(discordGuildId))
    )
      continue;
    try {
      if (
        await runJob(supabase, "scheduled_actions", candidate, (job) =>
          executeAction(client, { ...job, guilds: candidate.guilds }),
        )
      )
        executed++;
    } catch (error) {
      console.error(`[ScheduledActions] Job ${candidate.id}:`, error.message);
    }
  }
  return { executed };
}

function setupScheduledActionHandler(client, supabase, options = {}) {
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      await processDueScheduledActions(client, supabase, options);
    } catch (error) {
      console.error("[ScheduledActions] Poll error:", error.message);
    } finally {
      running = false;
    }
  };
  console.log("[ScheduledActions] Handler initialized");
  return setInterval(poll, 60_000);
}

module.exports = {
  setupScheduledActionHandler,
  processDueScheduledActions,
  executeAction,
};
