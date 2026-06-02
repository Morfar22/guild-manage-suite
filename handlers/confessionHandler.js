/**
 * Confession Handler
 * 
 * Allows users to submit anonymous confessions via /confess command.
 * Optionally requires approval before posting.
 */

const { EmbedBuilder } = require('discord.js');

const settingsCache = new Map();
const CACHE_TTL = 300_000;

function setupConfessionHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    if (!guild) return null;

    const { data } = await supabase
      .from('confession_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  async function getNextConfessionNumber(guildUuid) {
    const { count } = await supabase
      .from('confessions')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildUuid);
    return (count || 0) + 1;
  }

  // Handle /confess slash command
  async function handleConfessCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

    const settings = await getSettings(interaction.guild.id);
    if (!settings || !settings.channel_id) {
      await interaction.reply({ content: '❌ Bekendelse-systemet er ikke konfigureret.', ephemeral: true });
      return;
    }

    const content = interaction.options.getString('tekst');
    if (!content || content.trim().length === 0) {
      await interaction.reply({ content: '❌ Du skal skrive en bekendelse.', ephemeral: true });
      return;
    }

    const confessionNumber = await getNextConfessionNumber(settings._guildUuid);

    if (settings.require_approval) {
      // Save as pending
      await supabase.from('confessions').insert({
        guild_id: settings._guildUuid,
        content: content.trim(),
        status: 'pending',
        confession_number: confessionNumber,
      });

      // Notify approval channel
      if (settings.approval_channel_id) {
        const approvalChannel = interaction.guild.channels.cache.get(settings.approval_channel_id);
        if (approvalChannel) {
          const embed = new EmbedBuilder()
            .setTitle(`📝 Bekendelse #${confessionNumber} (afventer)`)
            .setDescription(content.trim())
            .setColor(0xFFA500)
            .setTimestamp();
          await approvalChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      await interaction.reply({ content: '✅ Din bekendelse er indsendt og afventer godkendelse.', ephemeral: true });
    } else {
      // Post directly
      const confessionChannel = interaction.guild.channels.cache.get(settings.channel_id);
      if (!confessionChannel) {
        await interaction.reply({ content: '❌ Bekendelseskanalen blev ikke fundet.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🤫 Bekendelse #${confessionNumber}`)
        .setDescription(content.trim())
        .setColor(0x5865F2)
        .setTimestamp();

      const msg = await confessionChannel.send({ embeds: [embed] }).catch(() => null);

      await supabase.from('confessions').insert({
        guild_id: settings._guildUuid,
        content: content.trim(),
        status: 'posted',
        message_id: msg?.id || null,
        confession_number: confessionNumber,
      });

      await interaction.reply({ content: '✅ Din bekendelse er blevet postet anonymt!', ephemeral: true });
    }
  }

  console.log('[Confession] Handler initialized');
  return { handleConfessCommand };
}

module.exports = { setupConfessionHandler };
