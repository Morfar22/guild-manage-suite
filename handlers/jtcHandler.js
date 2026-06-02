/**
 * Join to Create (JTC) Handler
 * 
 * Handles automatic voice channel creation and deletion
 * Supports multiple triggers with role requirements
 * 
 * Usage:
 * const jtcHandler = require('./jtcHandler');
 * jtcHandler.init(client, supabaseUrl, supabaseKey, botSecret);
 * 
 * Required intents: GuildVoiceStates
 */

let supabaseUrl = '';
let supabaseKey = '';
let botSecretKey = '';

// Deduplication: track recently processed events to prevent double handling
const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000; // 5 second window

function isDuplicateEvent(key) {
  const now = Date.now();
  const lastTime = recentEvents.get(key);
  
  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    console.log(`🎤 JTC duplicate event skipped: ${key}`);
    return true;
  }
  
  recentEvents.set(key, now);
  
  // Cleanup old entries every 100 events
  if (recentEvents.size > 100) {
    for (const [k, v] of recentEvents) {
      if (now - v > DEDUP_WINDOW_MS * 2) {
        recentEvents.delete(k);
      }
    }
  }
  
  return false;
}

async function callJTCHandler(action, data) {
  const response = await fetch(`${supabaseUrl}/functions/v1/jtc-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'x-bot-secret': botSecretKey
    },
    body: JSON.stringify({ action, ...data })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`JTC Handler error: ${error}`);
  }

  return response.json();
}

/**
 * Initialize JTC handler
 * @param {Client} client - Discord.js client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase anon key
 * @param {string} secret - Bot secret key
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function init(client, url, key, secret, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  supabaseUrl = url;
  supabaseKey = key;
  botSecretKey = secret;

  console.log('🎤 JTC Handler initialized (multi-trigger support)');

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const guildId = newState.guild?.id || oldState.guild?.id;
    
    // Check if this bot instance should handle this guild
    if (!guildId || !shouldHandleGuild(guildId)) return;

    try {
      // User joined a channel
      if (!oldState.channelId && newState.channelId) {
        await handleVoiceJoin(newState);
      }
      
      // User left a channel
      if (oldState.channelId && !newState.channelId) {
        await handleVoiceLeave(oldState);
      }
      
      // User switched channels
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await handleVoiceLeave(oldState);
        await handleVoiceJoin(newState);
      }
    } catch (error) {
      console.error('JTC voiceStateUpdate error:', error);
    }
  });
}

async function handleVoiceJoin(voiceState) {
  const { guild, channel, member } = voiceState;
  
  if (!channel || !member) return;
  
  // Dedup check: prevent double handling when multiple bots process same event
  const dedupKey = `join:${guild.id}:${channel.id}:${member.id}`;
  if (isDuplicateEvent(dedupKey)) return;

  try {
    // Ensure we have fresh member data (roles can be empty if the member cache isn't ready after restart)
    let fullMember = member;
    try {
      fullMember = await guild.members.fetch(member.id);
    } catch (fetchErr) {
      console.warn('JTC: Failed to fetch full member data, falling back to cached member:', fetchErr);
    }

    // Get user's role IDs for role requirement check
    const userRoles = (fullMember.roles?.cache?.map(role => String(role.id)) || []).filter(Boolean);
    console.log(`🎤 JTC role payload - user=${fullMember.id}, rolesCount=${userRoles.length}`);

    // Check if this is a JTC trigger channel
    const result = await callJTCHandler('check_trigger', {
      discordGuildId: guild.id,
      channelId: channel.id,
      userId: member.id,
      userName: member.displayName || member.user.username,
      userRoles: userRoles
    });

    if (result.shouldCreate) {
      console.log(`🎤 Creating JTC channel for ${member.displayName} in ${guild.name} (trigger: ${result.trigger?.name || 'legacy'})`);
      
      await callJTCHandler('create_channel', {
        discordGuildId: guild.id,
        channelId: channel.id,
        userId: member.id,
        userName: member.displayName || member.user.username,
        triggerId: result.trigger?.id
      });
    } else if (result.reason === 'missing_role') {
      // User doesn't have the required role - optionally notify them
      console.log(`🎤 User ${member.displayName} missing role for JTC trigger (requires: ${result.requiredRoleName})`);
      
      // Disconnect user from the trigger channel since they can't use it
      try {
        await member.voice.disconnect();
      } catch (err) {
        console.error('Failed to disconnect user without role:', err);
      }
    }
  } catch (error) {
    console.error('JTC handleVoiceJoin error:', error);
  }
}

async function handleVoiceLeave(voiceState) {
  const { guild, channel } = voiceState;
  
  if (!channel) return;

  try {
    // Check if channel is empty and is a JTC channel
    if (channel.members.size === 0) {
      const result = await callJTCHandler('check_empty', {
        discordGuildId: guild.id,
        channelId: channel.id
      });

      if (result.shouldDelete) {
        console.log(`🎤 Deleting empty JTC channel in ${guild.name}`);
        
        await callJTCHandler('delete_channel', {
          discordGuildId: guild.id,
          channelId: channel.id
        });
      }
    }
  } catch (error) {
    console.error('JTC handleVoiceLeave error:', error);
  }
}

module.exports = { init };
