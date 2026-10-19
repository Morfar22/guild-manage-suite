/**
 * Reminder Handler
 *
 * Polls the reminders table every 30 seconds and sends reminders
 * to the configured Discord channel (or DM) when remind_at has passed.
 * Supports one-time and recurring reminders (hourly, daily, weekly, monthly).
 *
 * Reminders are claimed before sending (compare-and-swap on `sent`), so
 * overlapping polls or several bot processes never send the same reminder
 * twice. Both schema generations are supported: channel_id/target_channel_id,
 * repeat_interval/(is_recurring + recurrence_interval) and sent/is_sent.
 */

const { EmbedBuilder } = require("discord.js");

const POLL_INTERVAL_MS = 30_000;
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
  if (reminder.is_recurring && INTERVALS.has(reminder.recurrence_interval)) {
    return reminder.recurrence_interval;
  }
  return null;
}

function addInterval(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "hourly":
      next.setTime(next.getTime() + 60 * 60 * 1000);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return null;
  }
  return next;
}

/** Next occurrence strictly after `now`, or null for unknown intervals. */
function computeNextOccurrence(remindAt, interval, now = new Date()) {
  let next = addInterval(new Date(remindAt), interval);
  if (!next || Number.isNaN(next.getTime())) return null;
  // Skip missed occurrences (bot offline) instead of sending a burst.
  for (let i = 0; next <= now && i < 100_000; i++) {
    next = addInterval(next, interval);
  }
  return next;
}

/** Atomically mark a reminder sent. Returns true if this caller claimed it. */
async function claimReminder(supabase, reminderId) {
  const { data, error } = await supabase
    .from("reminders")
    .update({ sent: true, is_sent: true })
    .eq("id", reminderId)
    .or("sent.eq.false,sent.is.null")
    .select("id");
  if (error) {
    console.error(`[Reminders] Claim error for ${reminderId}:`, error.message);
    return false;
  }
  return Array.isArray(data) && data.length === 1;
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
      value: INTERVAL_LABELS[interval] || interval,
      inline: true,
    });
  }
  return embed;
}

async function deliverReminder(client, reminder, embed) {
  const channelId = reminder.channel_id || reminder.target_channel_id;
  const channel = channelId
    ? await client.channels.fetch(channelId).catch(() => null)
    : null;

  if (reminder.target_user_discord_id) {
    try {
      const user = await client.users.fetch(reminder.target_user_discord_id);
      await user.send({ embeds: [embed] });
      return true;
    } catch {
      if (channel) {
        await channel.send({
          content: `<@${reminder.target_user_discord_id}>`,
          embeds: [embed],
          allowedMentions: { users: [reminder.target_user_discord_id] },
        });
        return true;
      }
      return false;
    }
  }
  if (!channel) {
    console.warn(`[Reminders] Channel not found: ${channelId}`);
    return false;
  }
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  return true;
}

async function scheduleNextReminder(supabase, reminder, interval, now) {
  const nextDate = computeNextOccurrence(reminder.remind_at, interval, now);
  if (!nextDate) return;

  const { error } = await supabase.from("reminders").insert({
    guild_id: reminder.guild_id,
    channel_id: reminder.channel_id || reminder.target_channel_id || null,
    target_channel_id:
      reminder.target_channel_id || reminder.channel_id || null,
    target_user_discord_id: reminder.target_user_discord_id || null,
    message: reminder.message,
    remind_at: nextDate.toISOString(),
    repeat_interval: interval,
    recurrence_interval: interval,
    is_recurring: true,
    created_by_id: reminder.created_by_id || null,
    created_by_name: reminder.created_by_name || null,
    created_by_user_id: reminder.created_by_user_id || null,
    sent: false,
    is_sent: false,
  });

  if (error) {
    console.error(
      `[Reminders] Error scheduling next occurrence:`,
      error.message,
    );
  } else {
    console.log(
      `[Reminders] Next occurrence for ${reminder.id} scheduled at ${nextDate.toISOString()}`,
    );
  }
}

async function processDueReminders(client, supabase, options = {}) {
  const { shouldHandleGuild, now = new Date() } = options;
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*, guilds!inner(guild_id)")
    .or("sent.eq.false,sent.is.null")
    .lte("remind_at", now.toISOString());

  if (error) {
    console.error("[Reminders] Query error:", error.message);
    return { sent: 0 };
  }
  let sent = 0;
  for (const reminder of reminders || []) {
    const discordGuildId = reminder.guilds?.guild_id;
    if (!discordGuildId) continue;
    if (shouldHandleGuild && !shouldHandleGuild(discordGuildId)) continue;

    // Claim first: at-most-once delivery even with overlapping polls.
    if (!(await claimReminder(supabase, reminder.id))) continue;

    const interval = resolveInterval(reminder);
    try {
      const delivered = await deliverReminder(
        client,
        reminder,
        buildEmbed(reminder, interval),
      );
      if (delivered) sent++;
    } catch (err) {
      console.error(
        `[Reminders] Error sending reminder ${reminder.id}:`,
        err.message,
      );
    }
    // Recurring reminders continue even if this occurrence failed to deliver.
    if (interval) await scheduleNextReminder(supabase, reminder, interval, now);
  }
  return { sent };
}

function setupReminderHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;
  console.log("[Reminders] Handler initialized");
  let running = false;

  return setInterval(async () => {
    if (running) return; // previous poll still in progress
    running = true;
    try {
      await processDueReminders(client, supabase, { shouldHandleGuild });
    } catch (err) {
      console.error("[Reminders] Poll error:", err.message);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
}

module.exports = {
  setupReminderHandler,
  processDueReminders,
  computeNextOccurrence,
  resolveInterval,
  claimReminder,
};
