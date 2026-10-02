/**
 * Bot Twitch Handler
 * 
 * Checker periodisk Twitch streamers og sender live notifikationer.
 * Importér denne fil i din bot's main fil og kald startTwitchChecker().
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Check interval i millisekunder (60 sekunder)
const CHECK_INTERVAL = 60000;
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';
let twitchCheckerStartupTimeout = null;
let twitchCheckerInterval = null;
let twitchCheckInFlight = false;

/**
 * Check Twitch streamers for en enkelt guild
 * @param {string} guildId - Discord guild ID (optional - checks all if not provided)
 */
async function checkTwitchStreamers(guildId = null) {
  if (!BOT_SECRET_KEY) {
    console.error('[Twitch] BOT_SECRET_KEY er ikke sat i environment variables');
    return;
  }

  if (twitchCheckInFlight) {
    console.log('[Twitch] Forrige check kører stadig; springer overlappende check over');
    return;
  }

  twitchCheckInFlight = true;

  try {
    const url = guildId 
      ? `${APP_API_BASE}/api/public/twitch-handler?action=check&guild_id=${guildId}`
      : `${APP_API_BASE}/api/public/twitch-handler?action=check`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET_KEY
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Twitch] Check fejl:', error);
      return;
    }

    const result = await response.json();
    
    if (result.notifications && result.notifications.length > 0) {
      const uniqueNotifications = [
        ...new Map(
          result.notifications.map((n) => [
            `${n.guild_id || ''}:${n.streamer || ''}:${n.action || ''}:${n.channel_id || ''}`,
            n,
          ])
        ).values(),
      ];
      console.log(
        `[Twitch] Sendte ${uniqueNotifications.length} notifikation(er):`,
        uniqueNotifications
          .map((n) => {
            const target = [n.guild_id, n.channel_id].filter(Boolean).join('/');
            return `${n.streamer}: ${n.action}${target ? ` [${target}]` : ''}`;
          })
          .join(', ')
      );
    } else {
      console.log(`[Twitch] Checked ${result.checked || 0} streamers, ${result.live || 0} live`);
    }
  } catch (error) {
    console.error('[Twitch] Network fejl:', error.message);
  } finally {
    twitchCheckInFlight = false;
  }
}

/**
 * Post weekly stream schedule to Discord
 */
async function postWeeklySchedule() {
  if (!BOT_SECRET_KEY) return;

  try {
    const response = await fetch(
      `${APP_API_BASE}/api/public/twitch-handler?action=schedule_post`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Twitch] Schedule post fejl:', error);
      return;
    }

    const result = await response.json();
    if (result.posted > 0) {
      console.log(`[Twitch] Postede ugeskema til ${result.posted} guild(s)`);
    }
  } catch (error) {
    console.error('[Twitch] Schedule post network fejl:', error.message);
  }
}

/**
 * Start Twitch checker service
 * @param {object} client - Discord.js client (optional, for logging)
 */
function startTwitchChecker(client = null, config = {}) {
  void client;
  void config;

  if (!BOT_SECRET_KEY) {
    console.error('[Twitch] BOT_SECRET_KEY mangler! Twitch checker deaktiveret.');
    console.error('[Twitch] Sæt BOT_SECRET_KEY i dine environment variables.');
    return;
  }

  // Twitch checks are server-side and do not depend on a specific bot client.
  // We only want ONE periodic loop per process, regardless of default/custom bots.
  if (twitchCheckerStartupTimeout || twitchCheckerInterval) {
    return;
  }

  console.log('[Twitch] Starter Twitch checker service...');

  twitchCheckerStartupTimeout = setTimeout(() => {
    checkTwitchStreamers();
    postWeeklySchedule();
    twitchCheckerInterval = setInterval(() => {
      checkTwitchStreamers();
      // Check schedule posting every run (the edge function handles dedup)
      postWeeklySchedule();
    }, CHECK_INTERVAL);
    twitchCheckerStartupTimeout = null;
  }, 10000);

  console.log('[Twitch] Service initialiseret (checker hvert 60. sekund)');
}

module.exports = {
  startTwitchChecker,
  checkTwitchStreamers,
  postWeeklySchedule
};
