/**
 * Auto-Responder Handler
 * 
 * Listens for messages and responds automatically based on configured triggers.
 * Supports exact match, contains, startswith, and regex trigger types.
 * Includes per-user cooldown tracking.
 */

const { Events, EmbedBuilder } = require('discord.js');
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

function setupAutoResponderHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;
  
  // Cooldown tracking: Map<responderId_userId, timestamp>
  const cooldowns = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

    try {
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!guild) return;

      const { data: responders } = await supabase
        .from('auto_responders')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('enabled', true);

      if (!responders || responders.length === 0) return;

      const content = message.content;

      for (const responder of responders) {
        let matched = false;

        switch (responder.trigger_type) {
          case 'exact':
            matched = content.toLowerCase() === responder.trigger_text.toLowerCase();
            break;
          case 'contains':
            matched = content.toLowerCase().includes(responder.trigger_text.toLowerCase());
            break;
          case 'startswith':
            matched = content.toLowerCase().startsWith(responder.trigger_text.toLowerCase());
            break;
          case 'regex':
            try {
              const regex = new RegExp(responder.trigger_text, 'i');
              matched = regex.test(content);
            } catch {
              // Invalid regex, skip
            }
            break;
        }

        if (!matched) continue;

        // Check cooldown
        const cooldownKey = `${responder.id}_${message.author.id}`;
        const lastUsed = cooldowns.get(cooldownKey);
        if (lastUsed && Date.now() - lastUsed < responder.cooldown_seconds * 1000) {
          continue;
        }

        // Set cooldown
        cooldowns.set(cooldownKey, Date.now());

        // Check if AI-powered response is enabled
        let responseText = responder.response_content;
        if (responder.use_ai) {
          try {
            const API_URL = process.env.API_URL || `${APP_API_BASE}/api/public/ai-auto-respond`;
            const BOT_SECRET = process.env.BOT_SECRET_KEY;
            const aiResponse = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
              body: JSON.stringify({
                action: 'generate_response',
                data: {
                  message_content: content,
                  trigger_text: responder.trigger_text,
                  ai_instructions: responder.ai_instructions || '',
                  response_content: responder.response_content,
                }
              })
            });
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              if (aiData.response) responseText = aiData.response;
            } else {
              const errorBody = await aiResponse.text().catch(() => '');
              console.error(`[AutoResponder] AI API error ${aiResponse.status}: ${errorBody.slice(0, 500)}`);
            }
          } catch (aiErr) {
            console.error('[AutoResponder] AI error, using fallback:', aiErr.message);
          }
        }

        // Send response
        switch (responder.response_type) {
          case 'text':
            await message.channel.send(responseText).catch(() => {});
            break;
          case 'embed':
            try {
              const embed = new EmbedBuilder()
                .setDescription(responseText)
                .setColor('#5865F2');
              await message.channel.send({ embeds: [embed] }).catch(() => {});
            } catch {
              await message.channel.send(responseText).catch(() => {});
            }
            break;
          case 'reaction':
            await message.react(responder.response_content).catch(() => {});
            break;
        }

        // Only respond with first matching trigger
        break;
      }
    } catch (err) {
      console.error('[AutoResponder] Error:', err.message);
    }
  });

  // Clean up old cooldowns periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, time] of cooldowns) {
      if (now - time > 3600_000) cooldowns.delete(key);
    }
  }, 600_000);

  console.log('[AutoResponder] Handler initialized');
}

module.exports = { setupAutoResponderHandler };
