/**
 * Welcome Handler for Discord Bot
 * 
 * Environment variables required:
 * - BOT_SECRET_KEY: (same as in Lovable Cloud secrets)
 * - WELCOME_API_URL: https://rkdqunnttcyuybbofkvz.supabase.co/functions/v1/bot-welcome
 * 
 * Usage in your main bot file:
 * const { setupWelcomeHandler } = require('./welcomeHandler');
 * setupWelcomeHandler(client);
 * 
 * IMPORTANT: Your bot needs the following intents:
 * - GatewayIntentBits.GuildMembers
 * - GatewayIntentBits.Guilds
 */

const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';
const configuredWelcomeApiUrl = String(process.env.WELCOME_API_URL || '').trim();
const legacyWelcomeApi = configuredWelcomeApiUrl.includes('/functions/v1/bot-welcome');
const API_URL = configuredWelcomeApiUrl && !legacyWelcomeApi
  ? configuredWelcomeApiUrl
  : `${APP_API_BASE}/api/public/bot-welcome`;
const BOT_SECRET = process.env.BOT_SECRET_KEY;

if (legacyWelcomeApi) {
  console.warn('[Welcome] Ignorerer legacy WELCOME_API_URL og bruger GuildOS web API-ruten i stedet.');
}

// Deduplication: track recently processed events to prevent double handling
const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000; // 5 second window

function isDuplicateEvent(key) {
  const now = Date.now();
  const lastTime = recentEvents.get(key);
  
  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    console.log(`👋 Welcome duplicate event skipped: ${key}`);
    return true;
  }
  
  recentEvents.set(key, now);
  
  // Cleanup old entries
  if (recentEvents.size > 100) {
    for (const [k, v] of recentEvents) {
      if (now - v > DEDUP_WINDOW_MS * 2) {
        recentEvents.delete(k);
      }
    }
  }
  
  return false;
}

/**
 * Call the Lovable API for welcome actions
 */
async function callWelcomeAPI(action, data) {
  if (!BOT_SECRET) {
    throw new Error('BOT_SECRET_KEY mangler');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET
    },
    body: JSON.stringify({ action, data })
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { error: raw || 'Ugyldigt API-svar' };
  }

  if (!response.ok) {
    throw new Error(payload.error || `Welcome API fejl (HTTP ${response.status})`);
  }

  return payload;
}

/**
 * Setup welcome handler on Discord client
 * @param {Client} client - Discord.js client
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function setupWelcomeHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  // Handle member join
  client.on('guildMemberAdd', async (member) => {
    // Check if this bot instance should handle this guild
    if (!shouldHandleGuild(member.guild.id)) return;
    
    // Dedup check: prevent double handling when multiple bots process same event
    const dedupKey = `join:${member.guild.id}:${member.user.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      console.log(`👋 Member joined: ${member.user.username} in ${member.guild.name}`);
      
      // Build server icon URL
      const guild = member.guild;
      const serverIconUrl = guild.iconURL({ size: 256, extension: 'png' }) || null;

      const result = await callWelcomeAPI('sendWelcome', {
        guildId: guild.id,
        userId: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.displayAvatarURL({ size: 256 }),
        memberCount: guild.memberCount,
        serverIconUrl,
      });
      
      if (result.success) {
        console.log(`✅ Welcome flow completed for ${member.user.username}`);
      } else if (result.partial) {
        console.warn(
          `⚠️ Welcome flow partially completed for ${member.user.username}: ${(result.errors || []).join(' | ')}`
        );
      } else {
        console.log(`ℹ️ Welcome flow not completed: ${result.reason || (result.errors || []).join(' | ') || 'unknown'}`);
      }
    } catch (error) {
      console.error('Welcome error:', error.message);
    }
  });

  // Handle member leave
  client.on('guildMemberRemove', async (member) => {
    // Check if this bot instance should handle this guild
    if (!shouldHandleGuild(member.guild.id)) return;
    
    // Dedup check: prevent double handling when multiple bots process same event
    const dedupKey = `leave:${member.guild.id}:${member.user.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      console.log(`👋 Member left: ${member.user.username} from ${member.guild.name}`);
      
      const result = await callWelcomeAPI('sendLeave', {
        guildId: member.guild.id,
        userId: member.user.id,
        username: member.user.username
      });
      
      if (result.success) {
        console.log(`✅ Leave message sent for ${member.user.username}`);
      } else {
        console.warn(`⚠️ Leave message not sent: ${result.reason || (result.errors || []).join(' | ') || 'unknown'}`);
      }
    } catch (error) {
      console.error('Leave message error:', error.message);
    }
  });
  
  console.log('✅ Welcome handler initialized');
}

module.exports = { setupWelcomeHandler };
