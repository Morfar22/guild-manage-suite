/**
 * XP Handler for Discord Bot
 * Supports: Message XP, Voice XP, XP Multipliers, Blacklist Channels
 * 
 * Usage in bot.js:
 *   const { initXPHandler } = require('./xpHandler');
 *   initXPHandler(client, supabaseUrl, botSecretKey);
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Track users in voice channels for voice XP
const voiceSessionTracker = new Map(); // Map<`${guildId}-${userId}`, { joinedAt: Date, channelId: string }>

/**
 * Call the xp-handler edge function
 */
async function grantXP({ guildId, userId, username, channelId, userRoles, isVoice }) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/xp-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET_KEY,
      },
      body: JSON.stringify({
        guild_id: guildId,
        user_id: userId,
        username: username,
        channel_id: channelId,
        user_roles: userRoles,
        is_voice: isVoice,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      if (data.message === 'On cooldown' || data.message === 'Channel is blacklisted') {
        // Not an error, just skip silently
        return null;
      }
      console.error('[XP] Error:', data.error || data.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[XP] Failed to grant XP:', error.message);
    return null;
  }
}

/**
 * Handle level up announcements and role assignments
 */
async function handleLevelUp(client, guildId, userId, levelUpData) {
  if (!levelUpData?.should_announce) return;

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    // Send level up message
    if (levelUpData.channel_id && levelUpData.message) {
      const channel = guild.channels.cache.get(levelUpData.channel_id);
      if (channel && channel.isTextBased()) {
        await channel.send({
          embeds: [{
            title: '🎉 Level Up!',
            description: levelUpData.message,
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
          }],
        });
      }
    }

    // Assign level roles
    if (levelUpData.roles_to_assign && levelUpData.roles_to_assign.length > 0) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        for (const roleId of levelUpData.roles_to_assign) {
          const role = guild.roles.cache.get(roleId);
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role).catch(err => {
              console.error(`[XP] Failed to add role ${roleId}:`, err.message);
            });
            console.log(`[XP] Assigned role ${role.name} to ${member.user.tag}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[XP] Error handling level up:', error.message);
  }
}

/**
 * Get user's role IDs
 */
function getUserRoleIds(member) {
  if (!member || !member.roles) return [];
  return member.roles.cache.map(role => role.id);
}

/**
 * Handle message XP
 */
async function handleMessageXP(client, message) {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  const userRoles = getUserRoleIds(member);

  const result = await grantXP({
    guildId: message.guild.id,
    userId: message.author.id,
    username: message.author.username,
    channelId: message.channel.id,
    userRoles: userRoles,
    isVoice: false,
  });

  if (result?.leveled_up && result?.level_up) {
    await handleLevelUp(client, message.guild.id, message.author.id, result.level_up);
    console.log(`[XP] ${message.author.tag} leveled up to ${result.level}! (+${result.xp_gained} XP, ${result.multiplier}x multiplier)`);
  }
}

/**
 * Handle voice state updates for voice XP tracking
 */
function handleVoiceStateUpdate(client, oldState, newState) {
  const userId = newState.member?.id || oldState.member?.id;
  const guildId = newState.guild?.id || oldState.guild?.id;
  
  if (!userId || !guildId) return;

  const key = `${guildId}-${userId}`;

  // User left voice channel
  if (oldState.channelId && !newState.channelId) {
    voiceSessionTracker.delete(key);
    return;
  }

  // User joined voice channel
  if (!oldState.channelId && newState.channelId) {
    // Don't track if user is a bot, deafened, or in AFK channel
    if (newState.member?.user?.bot) return;
    if (newState.selfDeaf || newState.serverDeaf) return;
    
    voiceSessionTracker.set(key, {
      joinedAt: new Date(),
      channelId: newState.channelId,
      guildId: guildId,
      userId: userId,
      username: newState.member?.user?.username || 'Unknown',
    });
    return;
  }

  // User switched channels
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const session = voiceSessionTracker.get(key);
    if (session) {
      session.channelId = newState.channelId;
    }
  }

  // User became deafened - stop tracking
  if (newState.selfDeaf || newState.serverDeaf) {
    voiceSessionTracker.delete(key);
  }
}

/**
 * Process voice XP for all tracked users (call this every minute)
 * @param {Client} client - Discord.js client
 * @param {Function} shouldHandleGuild - Function to check if this bot should handle the guild
 */
async function processVoiceXP(client, shouldHandleGuild = () => true) {
  for (const [key, session] of voiceSessionTracker.entries()) {
    try {
      // Check if this bot instance should handle this guild
      if (!shouldHandleGuild(session.guildId)) {
        continue;
      }

      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) {
        voiceSessionTracker.delete(key);
        continue;
      }

      const member = await guild.members.fetch(session.userId).catch(() => null);
      if (!member) {
        voiceSessionTracker.delete(key);
        continue;
      }

      // Check if still in voice and not deafened
      const voiceState = member.voice;
      if (!voiceState?.channelId || voiceState.selfDeaf || voiceState.serverDeaf) {
        voiceSessionTracker.delete(key);
        continue;
      }

      // Check if alone in channel (no XP if alone)
      const voiceChannel = guild.channels.cache.get(voiceState.channelId);
      if (voiceChannel && voiceChannel.members) {
        const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (nonBotMembers.size < 2) {
          continue; // Skip if alone
        }
      }

      const userRoles = getUserRoleIds(member);

      const result = await grantXP({
        guildId: session.guildId,
        userId: session.userId,
        username: session.username,
        channelId: voiceState.channelId,
        userRoles: userRoles,
        isVoice: true,
      });

      if (result?.leveled_up && result?.level_up) {
        await handleLevelUp(client, session.guildId, session.userId, result.level_up);
        console.log(`[Voice XP] ${session.username} leveled up to ${result.level}!`);
      } else if (result?.xp_gained) {
        console.log(`[Voice XP] ${session.username} earned ${result.xp_gained} XP (${result.multiplier}x multiplier)`);
      }
    } catch (error) {
      console.error(`[Voice XP] Error processing ${key}:`, error.message);
    }
  }
}

/**
 * Initialize the XP handler
 * @param {Client} client - Discord.js client
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} botSecretKey - Bot secret key for API auth
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function initXPHandler(client, supabaseUrl, botSecretKey, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  // Override environment if provided
  if (supabaseUrl) process.env.SUPABASE_URL = supabaseUrl;
  if (botSecretKey) process.env.BOT_SECRET_KEY = botSecretKey;

  // Message XP handler
  client.on('messageCreate', async (message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    // Check if this bot instance should handle this guild
    if (!shouldHandleGuild(message.guild.id)) return;

    await handleMessageXP(client, message);
  });

  // Voice state change handler
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = newState.guild?.id || oldState.guild?.id;
    
    // Check if this bot instance should handle this guild
    if (!guildId || !shouldHandleGuild(guildId)) return;

    handleVoiceStateUpdate(client, oldState, newState);
  });

  // Process voice XP every minute
  setInterval(() => {
    processVoiceXP(client, shouldHandleGuild);
  }, 60 * 1000); // 60 seconds

  console.log('[XP Handler] Initialized with voice XP and multiplier support');
}

module.exports = {
  initXPHandler,
  grantXP,
  handleMessageXP,
  handleVoiceStateUpdate,
  processVoiceXP,
};
