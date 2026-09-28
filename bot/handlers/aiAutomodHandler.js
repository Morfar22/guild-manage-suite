/**
 * AI Auto-Moderation Handler
 * 
 * Uses AI to analyze messages for toxicity, spam, NSFW, and hate speech.
 * Integrates with the self-hosted ai-automod API route.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isAutomodBypassed } = require('./automodBypass');

const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';
const AI_AUTOMOD_URL = `${APP_API_BASE}/api/public/ai-automod`;
const BOT_SECRET = process.env.BOT_SECRET_KEY;

// Cache settings per guild (refresh every 5 minutes)
const settingsCache = new Map();
const CACHE_TTL = 300_000;

function setupAIAutomodHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

    // Global automod bypass roles
    if (message.member && await isAutomodBypassed(supabase, message.member)) return;

    try {
      // Get guild internal ID
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!guild) return;

      // Get AI automod settings (cached)
      let settings = settingsCache.get(guild.id);
      if (!settings || Date.now() - settings._cachedAt > CACHE_TTL) {
        const { data } = await supabase
          .from('ai_automod_settings')
          .select('*')
          .eq('guild_id', guild.id)
          .maybeSingle();

        if (!data || !data.enabled) {
          settingsCache.set(guild.id, { enabled: false, _cachedAt: Date.now() });
          return;
        }
        settings = { ...data, _cachedAt: Date.now() };
        settingsCache.set(guild.id, settings);
      }

      if (!settings.enabled) return;

      // Skip short messages (less likely to be problematic)
      if (message.content.length < 5) return;

      // Call AI automod edge function
      const response = await fetch(AI_AUTOMOD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
        body: JSON.stringify({
          action: 'analyze',
          data: {
            message_content: message.content,
            guild_id: guild.id,
            user_id: message.author.id,
            user_name: message.author.username,
            channel_id: message.channel.id,
            settings: {
              sensitivity: settings.sensitivity,
              check_toxicity: settings.check_toxicity,
              check_spam: settings.check_spam,
              check_nsfw: settings.check_nsfw,
              check_hate_speech: settings.check_hate_speech,
              custom_instructions: settings.custom_instructions,
            }
          }
        })
      });

      if (!response.ok) return;

      const result = await response.json();
      const analysis = result.analysis;

      if (!analysis?.flagged) return;

      // Take action
      const actionTaken = settings.action || 'delete';

      switch (actionTaken) {
        case 'delete':
          await message.delete().catch(() => {});
          break;
        case 'warn':
          await message.reply({
            content: `⚠️ ${message.author}, din besked blev flagget af AI: ${analysis.reason}`,
            allowedMentions: { users: [message.author.id] }
          }).catch(() => {});
          break;
        case 'mute':
          await message.delete().catch(() => {});
          await message.member?.timeout(600_000, `AI Auto-Mod: ${analysis.reason}`).catch(() => {});
          break;
        case 'kick':
          await message.delete().catch(() => {});
          await message.member?.kick(`AI Auto-Mod: ${analysis.reason}`).catch(() => {});
          break;
        case 'ban':
          await message.delete().catch(() => {});
          await message.member?.ban({ reason: `AI Auto-Mod: ${analysis.reason}` }).catch(() => {});
          break;
      }

      // Log to automod_logs
      await supabase.from('automod_logs').insert({
        guild_id: guild.id,
        rule_type: 'ai_toxicity',
        user_id: message.author.id,
        user_name: message.author.username,
        channel_id: message.channel.id,
        message_content: message.content.substring(0, 500),
        action_taken: actionTaken,
      }).catch(() => {});

      // Notify moderators in log channel
      if (settings.notify_moderators && settings.log_channel_id) {
        const logChannel = message.guild.channels.cache.get(settings.log_channel_id);
        if (logChannel) {
          const severityColors = { low: 0xFFA500, medium: 0xFF6600, high: 0xFF0000 };
          const logEmbed = new EmbedBuilder()
            .setTitle('🤖 AI Auto-Mod Alert')
            .setColor(severityColors[analysis.severity] || 0xFF0000)
            .addFields(
              { name: 'Bruger', value: `<@${message.author.id}> (${message.author.username})`, inline: true },
              { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
              { name: 'Kategori', value: analysis.category, inline: true },
              { name: 'Alvorlighed', value: analysis.severity, inline: true },
              { name: 'Konfidensen', value: `${analysis.confidence}%`, inline: true },
              { name: 'Handling', value: actionTaken, inline: true },
              { name: 'Årsag', value: analysis.reason || 'N/A' },
              { name: 'Besked', value: message.content.substring(0, 500) || 'N/A' },
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      // Don't spam errors - AI automod failures should be silent
      if (!err.message?.includes('Rate limited')) {
        console.error('[AI-AutoMod] Error:', err.message);
      }
    }
  });

  console.log('[AI-AutoMod] Handler initialized');
}

module.exports = { setupAIAutomodHandler };
