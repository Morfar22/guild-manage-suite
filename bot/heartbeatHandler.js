/**
 * Bot Heartbeat Handler
 * 
 * Sender periodiske heartbeats til Supabase for at holde bot status opdateret.
 * Importér denne fil i din bot's main fil og kald startHeartbeat(client).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sleiplyixaxuvydzudxn.supabase.co';
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Heartbeat interval i millisekunder (30 sekunder)
const HEARTBEAT_INTERVAL = 30000;

// Tracker for daglige beskeder per guild
const dailyMessageCount = new Map();

/**
 * Nulstil besked tæller ved midnat
 */
function resetDailyCounters() {
  const now = new Date();
  const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) - now;
  
  setTimeout(() => {
    dailyMessageCount.clear();
    console.log('[Heartbeat] Daglige besked tællere nulstillet');
    // Sæt næste reset
    resetDailyCounters();
  }, msUntilMidnight);
}

/**
 * Tæl en besked for en guild
 * @param {string} guildId - Discord guild ID
 */
function countMessage(guildId) {
  const current = dailyMessageCount.get(guildId) || 0;
  dailyMessageCount.set(guildId, current + 1);
}

/**
 * Send heartbeat for en enkelt guild
 * @param {object} client - Discord.js client
 * @param {object} guild - Discord.js guild
 */
async function sendHeartbeat(client, guild) {
  if (!BOT_SECRET_KEY) {
    console.error('[Heartbeat] BOT_SECRET_KEY er ikke sat i environment variables');
    return;
  }

  try {
    const payload = {
      guild_id: guild.id,
      is_online: true,
      latency_ms: client.ws.ping,
      member_count: guild.memberCount,
      message_count_today: dailyMessageCount.get(guild.id) || 0
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/bot-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Heartbeat] Fejl for guild ${guild.name}:`, error);
    } else {
      console.log(`[Heartbeat] Sendt for ${guild.name} (${client.ws.ping}ms latency)`);
    }
  } catch (error) {
    console.error(`[Heartbeat] Network fejl for guild ${guild.name}:`, error.message);
  }
}

/**
 * Send heartbeat for alle guilds
 * @param {object} client - Discord.js client
 */
async function sendAllHeartbeats(client, shouldHandleGuild) {
  const guilds = client.guilds.cache;
  
  for (const [, guild] of guilds) {
    // Only send heartbeats for guilds this bot instance handles
    if (shouldHandleGuild && !shouldHandleGuild(guild.id)) continue;
    await sendHeartbeat(client, guild);
  }
}

/**
 * Start heartbeat service
 * @param {object} client - Discord.js client
 */
function startHeartbeat(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  if (!BOT_SECRET_KEY) {
    console.error('[Heartbeat] BOT_SECRET_KEY mangler! Heartbeat deaktiveret.');
    console.error('[Heartbeat] Sæt BOT_SECRET_KEY i dine environment variables.');
    return;
  }

  console.log('[Heartbeat] Starter heartbeat service...');
  
  // Send første heartbeat når bot er klar
  client.once('ready', () => {
    console.log(`[Heartbeat] Bot er online i ${client.guilds.cache.size} guilds`);
    sendAllHeartbeats(client, shouldHandleGuild);
    
    // Start periodisk heartbeat
    setInterval(() => sendAllHeartbeats(client, shouldHandleGuild), HEARTBEAT_INTERVAL);
  });

  // Tæl beskeder - only for guilds this bot handles
  client.on('messageCreate', (message) => {
    if (message.guild && !message.author.bot && shouldHandleGuild(message.guild.id)) {
      countMessage(message.guild.id);
    }
  });

  // Start midnat reset timer
  resetDailyCounters();

  console.log('[Heartbeat] Service initialiseret');
}

/**
 * Send offline status når bot lukker ned
 * @param {object} client - Discord.js client
 */
async function sendOfflineStatus(client) {
  console.log('[Heartbeat] Sender offline status...');
  
  for (const [, guild] of client.guilds.cache) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/bot-heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY
        },
        body: JSON.stringify({
          guild_id: guild.id,
          is_online: false,
          latency_ms: 0,
          member_count: guild.memberCount,
          message_count_today: dailyMessageCount.get(guild.id) || 0
        })
      });
    } catch (error) {
      console.error(`[Heartbeat] Kunne ikke sende offline status for ${guild.name}`);
    }
  }
}

module.exports = {
  startHeartbeat,
  sendOfflineStatus,
  countMessage
};
