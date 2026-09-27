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

const API_URL = process.env.WELCOME_API_URL || '${APP_API_BASE}/api/public/bot-welcome';
const BOT_SECRET = process.env.BOT_SECRET_KEY;

// Deduplication: track recently processed events to prevent double handling
const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000; // 5 second window
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

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
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET
    },
    body: JSON.stringify({ action, data })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  
  return response.json();
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
        console.log(`✅ Welcome sent for ${member.user.username}`);
      } else {
        console.log(`ℹ️ Welcome not sent: ${result.reason}`);
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
        console.log(`ℹ️ Leave message not sent: ${result.reason}`);
      }
    } catch (error) {
      console.error('Leave message error:', error.message);
    }
  });
  
  console.log('✅ Welcome handler initialized');
}

module.exports = { setupWelcomeHandler };
