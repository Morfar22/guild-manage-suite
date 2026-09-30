/**
 * Bot Heartbeat Handler
 * 
 * Sender periodiske heartbeats til Supabase for at holde bot status opdateret.
 * Importér denne fil i din bot's main fil og kald startHeartbeat(client).
 */

const os = require('os');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Heartbeat interval i millisekunder (30 sekunder)
const HEARTBEAT_INTERVAL = 30000;

// Backend rows can temporarily be missing for guilds the bot is still connected to.
// Back off instead of hammering the heartbeat endpoint every 30 seconds.
const UNREGISTERED_GUILD_RETRY_MS = 10 * 60 * 1000;
const unregisteredGuildUntil = new Map();

// Tracker for daglige beskeder per guild
const dailyMessageCount = new Map();
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

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
 * Beregn CPU-forbrug i procent over et kort interval
 */
let lastCpu = os.cpus().reduce((acc, c) => {
  const total = Object.values(c.times).reduce((a, b) => a + b, 0);
  return { idle: acc.idle + c.times.idle, total: acc.total + total };
}, { idle: 0, total: 0 });

function getCpuPercent() {
  const now = os.cpus().reduce((acc, c) => {
    const total = Object.values(c.times).reduce((a, b) => a + b, 0);
    return { idle: acc.idle + c.times.idle, total: acc.total + total };
  }, { idle: 0, total: 0 });

  const idleDiff = now.idle - lastCpu.idle;
  const totalDiff = now.total - lastCpu.total;
  lastCpu = now;
  if (totalDiff <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
}

/**
 * Læs diskforbrug for rod-filsystemet (statfs findes i Node 18.15+)
 */
function getDiskUsage() {
  try {
    if (typeof fs.statfsSync !== 'function') return { used: null, total: null };
    const st = fs.statfsSync('/');
    const totalBytes = st.blocks * st.bsize;
    const freeBytes = st.bavail * st.bsize;
    const gb = (b) => Math.round((b / 1024 ** 3) * 10) / 10;
    return { used: gb(totalBytes - freeBytes), total: gb(totalBytes) };
  } catch {
    return { used: null, total: null };
  }
}

function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const disk = getDiskUsage();
  const mb = (b) => Math.round(b / 1024 / 1024);

  return {
    cpu_percent: getCpuPercent(),
    load_avg_1m: Math.round(os.loadavg()[0] * 100) / 100,
    memory_used_mb: mb(totalMem - freeMem),
    memory_total_mb: mb(totalMem),
    process_memory_mb: mb(process.memoryUsage().rss),
    disk_used_gb: disk.used,
    disk_total_gb: disk.total,
    uptime_seconds: Math.round(process.uptime()),
    host_name: os.hostname(),
    bot_version: process.env.BOT_VERSION || null,
  };
}

/**
 * Send heartbeat for en enkelt guild
 * @param {object} client - Discord.js client
 * @param {object} guild - Discord.js guild
 */
async function sendHeartbeat(client, guild, metrics) {
  if (!BOT_SECRET_KEY) {
    console.error('[Heartbeat] BOT_SECRET_KEY er ikke sat i environment variables');
    return;
  }

  const retryAt = unregisteredGuildUntil.get(guild.id) || 0;
  if (retryAt > Date.now()) return;
  if (retryAt) unregisteredGuildUntil.delete(guild.id);

  try {
    const payload = {
      guild_id: guild.id,
      is_online: true,
      latency_ms: client.ws.ping,
      member_count: guild.memberCount,
      message_count_today: dailyMessageCount.get(guild.id) || 0,
      ...(metrics || {})
    };

    const response = await fetch(`${APP_API_BASE}/api/public/bot-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();

      if (response.status === 404 && /guild not found/i.test(error)) {
        const wasBackedOff = unregisteredGuildUntil.has(guild.id);
        unregisteredGuildUntil.set(guild.id, Date.now() + UNREGISTERED_GUILD_RETRY_MS);
        if (!wasBackedOff) {
          console.warn(`[Heartbeat] Guild ${guild.name} er ikke registreret i backend; prøver igen om 10 min.`);
        }
        return;
      }

      console.error(`[Heartbeat] Fejl for guild ${guild.name}:`, error);
    } else {
      unregisteredGuildUntil.delete(guild.id);
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
  // Beregn systemmetrikker én gang pr. runde
  const metrics = getSystemMetrics();
  
  for (const [, guild] of guilds) {
    // Only send heartbeats for guilds this bot instance handles
    if (shouldHandleGuild && !shouldHandleGuild(guild.id)) continue;
    await sendHeartbeat(client, guild, metrics);
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
  client.once('clientReady', () => {
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
      await fetch(`${APP_API_BASE}/api/public/bot-heartbeat`, {
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
  getSystemMetrics,
  sendOfflineStatus,
  countMessage
};
