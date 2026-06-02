/**
 * Reminder Handler
 * 
 * Polls the reminders table every 30 seconds and sends reminders
 * to the configured Discord channel when remind_at has passed.
 * Supports one-time and recurring reminders (hourly, daily, weekly, monthly).
 */

const { EmbedBuilder } = require('discord.js');

function setupReminderHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;
  console.log('[Reminders] Handler initialized');

  setInterval(async () => {
    try {
      const now = new Date().toISOString();

      // Fetch due reminders
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*, guilds!inner(guild_id)')
        .eq('sent', false)
        .lte('remind_at', now);

      if (error) {
        console.error('[Reminders] Query error:', error.message);
        return;
      }

      if (!reminders || reminders.length === 0) return;

      for (const reminder of reminders) {
        try {
          const discordGuildId = reminder.guilds?.guild_id;
          if (!discordGuildId) continue;

          // Check if this bot instance should handle this guild
          if (shouldHandleGuild && !shouldHandleGuild(discordGuildId)) continue;

          const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);

          if (!channel) {
            console.warn(`[Reminders] Channel not found: ${reminder.channel_id}`);
            await markReminderSent(supabase, reminder.id);
            continue;
          }

          // Build the reminder embed
          const embed = new EmbedBuilder()
            .setTitle('⏰ Påmindelse')
            .setDescription(reminder.message)
            .setColor(0x5865F2)
            .setTimestamp();

          if (reminder.created_by_name) {
            embed.setFooter({ text: `Oprettet af ${reminder.created_by_name}` });
          }

          if (reminder.repeat_interval && reminder.repeat_interval !== 'none') {
            const labels = {
              hourly: 'Hver time',
              daily: 'Dagligt',
              weekly: 'Ugentligt',
              monthly: 'Månedligt',
            };
            embed.addFields({
              name: '🔁 Gentages',
              value: labels[reminder.repeat_interval] || reminder.repeat_interval,
              inline: true,
            });
          }

          await channel.send({ embeds: [embed] });
          console.log(`[Reminders] Sent reminder ${reminder.id} to channel ${reminder.channel_id}`);

          // Mark as sent
          await markReminderSent(supabase, reminder.id);

          // Schedule next occurrence for recurring reminders
          if (reminder.repeat_interval && reminder.repeat_interval !== 'none') {
            await scheduleNextReminder(supabase, reminder);
          }
        } catch (err) {
          console.error(`[Reminders] Error sending reminder ${reminder.id}:`, err.message);
          // Mark as sent to avoid infinite retry
          await markReminderSent(supabase, reminder.id);
        }
      }
    } catch (err) {
      console.error('[Reminders] Poll error:', err.message);
    }
  }, 30_000); // Every 30 seconds
}

async function markReminderSent(supabase, reminderId) {
  await supabase
    .from('reminders')
    .update({ sent: true })
    .eq('id', reminderId);
}

async function scheduleNextReminder(supabase, reminder) {
  const remindAt = new Date(reminder.remind_at);
  let nextDate;

  switch (reminder.repeat_interval) {
    case 'hourly':
      nextDate = new Date(remindAt.getTime() + 60 * 60 * 1000);
      break;
    case 'daily':
      nextDate = new Date(remindAt);
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate = new Date(remindAt);
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate = new Date(remindAt);
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      return;
  }

  // Ensure the next date is in the future
  const now = new Date();
  while (nextDate <= now) {
    switch (reminder.repeat_interval) {
      case 'hourly':
        nextDate = new Date(nextDate.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
  }

  const { error } = await supabase
    .from('reminders')
    .insert({
      guild_id: reminder.guild_id,
      channel_id: reminder.channel_id,
      message: reminder.message,
      remind_at: nextDate.toISOString(),
      repeat_interval: reminder.repeat_interval,
      created_by_id: reminder.created_by_id,
      created_by_name: reminder.created_by_name,
      sent: false,
    });

  if (error) {
    console.error(`[Reminders] Error scheduling next occurrence:`, error.message);
  } else {
    console.log(`[Reminders] Next occurrence for ${reminder.id} scheduled at ${nextDate.toISOString()}`);
  }
}

module.exports = { setupReminderHandler };
