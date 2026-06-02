/**
 * Slowmode Scheduler Handler
 * 
 * Checks slowmode_schedules every minute and applies/removes
 * slowmode on channels based on configured time windows.
 */

const settingsCache = { data: null, ts: 0 };
const CACHE_TTL = 300_000;
let intervalId = null;

function setupSlowmodeScheduler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getAllSchedules() {
    if (settingsCache.data && Date.now() - settingsCache.ts < CACHE_TTL) return settingsCache.data;

    const { data } = await supabase
      .from('slowmode_schedules')
      .select('*, guilds!inner(guild_id)')
      .eq('enabled', true);

    settingsCache.data = data || [];
    settingsCache.ts = Date.now();
    return settingsCache.data;
  }

  async function checkSlowmodes() {
    try {
      const schedules = await getAllSchedules();
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      for (const schedule of schedules) {
        const guildDiscordId = schedule.guilds?.guild_id;
        if (!guildDiscordId) continue;
        if (shouldHandleGuild && !shouldHandleGuild(guildDiscordId)) continue;

        const guild = client.guilds.cache.get(guildDiscordId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(schedule.channel_id);
        if (!channel || !channel.isTextBased()) continue;

        const daysActive = schedule.days_of_week || [0, 1, 2, 3, 4, 5, 6];
        const isActiveDay = daysActive.includes(currentDay);
        const isActiveHour = schedule.start_hour <= schedule.end_hour
          ? currentHour >= schedule.start_hour && currentHour < schedule.end_hour
          : currentHour >= schedule.start_hour || currentHour < schedule.end_hour;

        const shouldBeSlowed = isActiveDay && isActiveHour;
        const currentSlowmode = channel.rateLimitPerUser || 0;

        if (shouldBeSlowed && currentSlowmode !== schedule.slowmode_seconds) {
          await channel.setRateLimitPerUser(schedule.slowmode_seconds, 'Slowmode Scheduler').catch(() => {});
        } else if (!shouldBeSlowed && currentSlowmode === schedule.slowmode_seconds) {
          await channel.setRateLimitPerUser(0, 'Slowmode Scheduler: tidsvindue slut').catch(() => {});
        }
      }
    } catch (err) {
      console.error('[SlowmodeScheduler] Error:', err.message);
    }
  }

  // Avoid duplicate intervals
  if (!intervalId) {
    intervalId = setInterval(checkSlowmodes, 60_000);
    // Initial check
    setTimeout(checkSlowmodes, 10_000);
  }

  console.log('[SlowmodeScheduler] Handler initialized');
}

module.exports = { setupSlowmodeScheduler };
