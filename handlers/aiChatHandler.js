// aiChatHandler.js
// Handles AI chat responses when the bot is mentioned

const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Deduplication: prevent double replies if multiple bot instances receive same message event
const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000; // 5 second window

function isDuplicateEvent(key) {
  const now = Date.now();
  const lastTime = recentEvents.get(key);

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    console.log(`🤖 AI duplicate event skipped: ${key}`);
    return true;
  }

  recentEvents.set(key, now);

  // Cleanup old entries
  if (recentEvents.size > 200) {
    for (const [k, v] of recentEvents) {
      if (now - v > DEDUP_WINDOW_MS * 2) {
        recentEvents.delete(k);
      }
    }
  }

  return false;
}

async function callAIChatHandler(action, data) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET_KEY
      },
      body: JSON.stringify({ action, ...data })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`AI Chat API error (${action}):`, error);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`AI Chat handler error (${action}):`, error);
    return null;
  }
}

async function checkAIChatEnabled(discordGuildId, channelId) {
  const result = await callAIChatHandler('check_enabled', {
    discordGuildId,
    channelId
  });
  return result?.enabled || false;
}

async function getAIResponse(discordGuildId, channelId, userId, userName, message) {
  const result = await callAIChatHandler('chat', {
    discordGuildId,
    channelId,
    userId,
    userName,
    message
  });
  return result?.response || null;
}

/**
 * Setup AI chat handler on Discord client
 * @param {Client} client - Discord.js client
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function setupAIChatHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if this bot instance should handle this guild
    if (!message.guild || !shouldHandleGuild(message.guild.id)) return;
    
    // Check if the bot was mentioned
    if (!message.mentions.has(client.user)) return;

    // Dedup check: messageCreate can be received by both default+custom bot in same guild
    // message.id is unique per Discord message.
    const dedupKey = `ai:${message.guild.id}:${message.channel.id}:${message.id}`;
    if (isDuplicateEvent(dedupKey)) return;
    
    // Remove the mention from the message
    const cleanMessage = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim();
    
    // Ignore if only a mention with no content
    if (!cleanMessage) {
      return message.reply('Hej! Hvad kan jeg hjælpe dig med?');
    }
    
    try {
      // Check if AI chat is enabled for this guild/channel
      const isEnabled = await checkAIChatEnabled(message.guild.id, message.channel.id);
      
      if (!isEnabled) {
        // AI chat not enabled, ignore silently
        return;
      }
      
      // Show typing indicator
      await message.channel.sendTyping();
      
      // Get AI response
      const response = await getAIResponse(
        message.guild.id,
        message.channel.id,
        message.author.id,
        message.author.username,
        cleanMessage
      );
      
      if (response) {
        // Split response if too long (Discord has 2000 char limit)
        if (response.length > 2000) {
          const chunks = response.match(/.{1,1990}/gs) || [];
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } else {
          await message.reply(response);
        }
      } else {
        await message.reply('Beklager, jeg kunne ikke generere et svar lige nu. Prøv igen senere.');
      }
    } catch (error) {
      console.error('AI chat error:', error);
      await message.reply('Der opstod en fejl. Prøv igen senere.').catch(() => {});
    }
  });
  
  console.log('AI Chat handler initialized');
}

module.exports = { setupAIChatHandler };
