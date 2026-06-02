/**
 * Counting Channel Handler
 * 
 * Manages a counting game in a designated channel.
 * Users must count sequentially; wrong numbers reset the count.
 */

const { Events, EmbedBuilder } = require('discord.js');

const settingsCache = new Map();
const CACHE_TTL = 300_000;

function setupCountingHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    if (!guild) return null;

    const { data } = await supabase
      .from('counting_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

    try {
      const settings = await getSettings(message.guild.id);
      if (!settings || !settings.channel_id) return;
      if (message.channel.id !== settings.channel_id) return;

      const number = parseInt(message.content.trim(), 10);
      if (isNaN(number)) return; // Ignore non-numbers

      const expectedNumber = settings.current_count + 1;

      // Check same user
      if (!settings.allow_same_user && settings.last_counter_id === message.author.id) {
        await message.react('❌').catch(() => {});
        await message.reply({ content: `❌ Du kan ikke tælle to gange i træk! Tællingen nulstilles til **0**.`, allowedMentions: { repliedUser: false } }).catch(() => {});
        await resetCount(settings);
        settingsCache.delete(message.guild.id);
        return;
      }

      if (number === expectedNumber) {
        await message.react('✅').catch(() => {});
        const newHighScore = Math.max(settings.high_score, number);

        await supabase.from('counting_settings')
          .update({ current_count: number, last_counter_id: message.author.id, high_score: newHighScore })
          .eq('id', settings.id);

        settingsCache.delete(message.guild.id);

        if (number > settings.high_score) {
          await message.reply({ content: `🎉 Ny rekord: **${number}**!`, allowedMentions: { repliedUser: false } }).catch(() => {});
        }
      } else {
        await message.react('❌').catch(() => {});
        await message.reply({
          content: `❌ Forkert! Det korrekte tal var **${expectedNumber}**. Tællingen nulstilles til **0**.`,
          allowedMentions: { repliedUser: false }
        }).catch(() => {});
        await resetCount(settings);
        settingsCache.delete(message.guild.id);
      }
    } catch (err) {
      console.error('[Counting] Error:', err.message);
    }
  });

  async function resetCount(settings) {
    await supabase.from('counting_settings')
      .update({ current_count: 0, last_counter_id: null })
      .eq('id', settings.id);
  }

  console.log('[Counting] Handler initialized');
}

module.exports = { setupCountingHandler };
