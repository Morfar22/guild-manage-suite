/** Persistent reminders: claim a lease, deliver, then acknowledge success. */
const { EmbedBuilder } = require("discord.js");
const {
  claimJob,
  listDueJobs,
  runJob,
  messageDeliveryOptions,
  permanentJobError,
  computeNextOccurrence,
} = require("../utils/durableJobs");

const INTERVALS = new Set(["hourly", "daily", "weekly", "monthly"]);
const INTERVAL_LABELS = {
  hourly: "Hver time",
  daily: "Dagligt",
  weekly: "Ugentligt",
  monthly: "Månedligt",
};

function resolveInterval(reminder) {
  if (reminder.repeat_interval && reminder.repeat_interval !== "none") {
    return INTERVALS.has(reminder.repeat_interval)
      ? reminder.repeat_interval
      : null;
  }
  return reminder.is_recurring && INTERVALS.has(reminder.recurrence_interval)
    ? reminder.recurrence_interval
    : null;
}

function claimReminder(supabase, reminderId) {
  return claimJob(supabase, "reminders", reminderId);
}

function buildEmbed(reminder, interval) {
  const embed = new EmbedBuilder()
    .setTitle("⏰ Påmindelse")
    .setDescription(String(reminder.message || "").slice(0, 4000) || "—")
    .setColor(0x5865f2)
    .setTimestamp();
  if (reminder.created_by_name) {
    embed.setFooter({ text: `Oprettet af ${reminder.created_by_name}` });
  }
  if (interval) {
    embed.addFields({
      name: "🔁 Gentages",
      value: INTERVAL_LABELS[interval],
      inline: true,
    });
  }
  return embed;
}

async function deliverReminder(client, reminder) {
  const payload = {
    embeds: [buildEmbed(reminder, resolveInterval(reminder))],
    allowedMentions: { parse: [] },
    ...messageDeliveryOptions("reminders", reminder.id),
  };
  if (reminder.target_user_discord_id) {
    try {
      const user = await client.users.fetch(reminder.target_user_discord_id);
      return await user.send(payload);
    } catch (error) {
      // Only an explicit Discord refusal can fall back to the channel. A network
      // timeout may mean the DM was delivered; retry with the same nonce instead.
      if (![50007, 10013].includes(Number(error.code))) throw error;
      if (!(reminder.channel_id || reminder.target_channel_id)) throw error;
    }
  }
  const channelId = reminder.channel_id || reminder.target_channel_id;
  if (!channelId)
    throw permanentJobError("Ingen kanal eller DM-modtager er valgt");
  const channel = await client.channels.fetch(channelId);
  if (!channel?.send)
    throw permanentJobError(
      "Påmindelsens kanal findes ikke eller kan ikke modtage beskeder",
    );
  if (reminder.target_user_discord_id) {
    payload.content = `<@${reminder.target_user_discord_id}>`;
    payload.allowedMentions = {
      users: [reminder.target_user_discord_id],
      parse: [],
    };
  }
  return channel.send(payload);
}

async function processDueReminders(client, supabase, options = {}) {
  const { shouldHandleGuild, now = new Date() } = options;
  const reminders = await listDueJobs(supabase, "reminders", "remind_at", now);
  let sent = 0;
  for (const reminder of reminders) {
    const discordGuildId = reminder.guilds?.guild_id;
    if (
      !discordGuildId ||
      (shouldHandleGuild && !shouldHandleGuild(discordGuildId))
    )
      continue;
    try {
      const delivered = await runJob(
        supabase,
        "reminders",
        reminder,
        (job) => deliverReminder(client, job),
        (job) =>
          computeNextOccurrence(
            job.remind_at,
            resolveInterval(job),
            now,
          )?.toISOString() || null,
      );
      if (delivered) sent++;
    } catch (error) {
      console.error(`[Reminders] Job ${reminder.id}:`, error.message);
    }
  }
  return { sent };
}

function setupReminderHandler(client, supabase, options = {}) {
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      await processDueReminders(client, supabase, options);
    } catch (error) {
      console.error("[Reminders] Poll error:", error.message);
    } finally {
      running = false;
    }
  };
  console.log("[Reminders] Handler initialized");
  return setInterval(poll, 30_000);
}

module.exports = {
  setupReminderHandler,
  processDueReminders,
  computeNextOccurrence,
  resolveInterval,
  claimReminder,
  deliverReminder,
};
