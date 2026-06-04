/**
 * Quarantine Handler
 * 
 * Auto-quarantines new accounts younger than X days.
 * Assigns a quarantine role and logs the action.
 */

const { Events, EmbedBuilder } = require('discord.js');

const settingsCache = new Map();
const CACHE_TTL = 300_000;

function setupQuarantineHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    if (!guild) return null;

    const { data } = await supabase
      .from('quarantine_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || member.user.bot) return;
    if (shouldHandleGuild && !shouldHandleGuild(member.guild.id)) return;

    try {
      const settings = await getSettings(member.guild.id);
      if (!settings || !settings.quarantine_role_id) return;

      // Check account age
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
      if (accountAgeDays >= settings.auto_quarantine_days) return;

      // Quarantine the user
      await member.roles.add(settings.quarantine_role_id, `Auto-karantæne: konto er ${Math.floor(accountAgeDays)} dage gammel`).catch(() => {});

      // Log to database
      await supabase.from('quarantine_entries').insert({
        guild_id: settings._guildUuid,
        user_id: member.user.id,
        user_name: member.user.username,
        reason: `Ny konto (${Math.floor(accountAgeDays)} dage gammel)`,
      }).catch(() => {});

      // Log to channel
      if (settings.log_channel_id) {
        const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🔒 Bruger sat i karantæne')
            .setColor(0xFFA500)
            .addFields(
              { name: 'Bruger', value: `<@${member.user.id}> (${member.user.username})`, inline: true },
              { name: 'Kontoalder', value: `${Math.floor(accountAgeDays)} dage`, inline: true },
              { name: 'Årsag', value: `Under ${settings.auto_quarantine_days} dages threshold` },
            )
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      // Dashboard notification
      await supabase.from('dashboard_notifications').insert({
        guild_id: settings._guildUuid,
        type: 'moderation',
        title: '🔒 Bruger i karantæne',
        message: `${member.user.username} (konto: ${Math.floor(accountAgeDays)} dage)`,
        source: 'quarantine',
      }).catch(() => {});

    } catch (err) {
      console.error('[Quarantine] Error:', err.message);
    }
  });

  console.log('[Quarantine] Handler initialized');
}

module.exports = { setupQuarantineHandler };
