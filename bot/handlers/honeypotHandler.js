/**
 * Honeypot Handler
 *
 * A designated channel that legitimate members never write in.
 * Any (non-bypassed) user posting there is treated as a compromised
 * account / spam bot: message deleted, user kicked/banned, global ban
 * report submitted automatically, and the catch logged.
 */

const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const settingsCache = new Map(); // discordGuildId -> { data, _ts }
const CACHE_TTL = 120_000;
const recentlyHandled = new Map(); // `${guild}:${user}` -> ts (prevents double-processing)

function setupHoneypotHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild, error: guildError } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).maybeSingle();
    if (guildError) {
      console.error(`[Honeypot] Failed to resolve guild ${guildDiscordId}:`, guildError.message);
      settingsCache.set(guildDiscordId, { data: null, _ts: Date.now() });
      return null;
    }
    if (!guild) {
      console.warn(`[Honeypot] Guild ${guildDiscordId} is not registered in the database`);
      settingsCache.set(guildDiscordId, { data: null, _ts: Date.now() });
      return null;
    }

    const { data, error: settingsError } = await supabase
      .from('honeypot_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    if (settingsError) {
      console.error(`[Honeypot] Failed to load settings for ${guildDiscordId}:`, settingsError.message);
      settingsCache.set(guildDiscordId, { data: null, _ts: Date.now() });
      return null;
    }

    const result = data && data.enabled && data.channel_id ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  // Invalidate cache when dashboard changes settings
  try {
    supabase
      .channel('honeypot-settings-cache')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honeypot_settings' }, () => {
        settingsCache.clear();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Honeypot] Settings realtime subscription status: ${status}`);
        }
      });
  } catch { /* realtime optional */ }

  async function onMessage(message) {
    try {
      if (!message.guild || message.author.bot || message.system) return;
      if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

      const settings = await getSettings(message.guild.id);
      if (!settings || message.channel.id !== settings.channel_id) return;

      console.log(`[Honeypot] Message detected in trap channel ${message.channel.id} from ${message.author.tag} (${message.author.id})`);

      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return;

      // Never act on server owner / admins / ignored roles.
      // Log bypasses so testing does not look like a broken honeypot.
      if (member.id === message.guild.ownerId) {
        console.log(`[Honeypot] Bypassed server owner ${message.author.tag}`);
        return;
      }
      if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        console.log(`[Honeypot] Bypassed administrator ${message.author.tag}`);
        return;
      }
      const ignore = settings.ignore_roles || [];
      const ignoredRole = member.roles.cache.find(r => ignore.includes(r.id));
      if (ignoredRole) {
        console.log(`[Honeypot] Bypassed ${message.author.tag} because of ignored role ${ignoredRole.name} (${ignoredRole.id})`);
        return;
      }

      const key = `${message.guild.id}:${member.id}`;
      const last = recentlyHandled.get(key);
      if (last && Date.now() - last < 60_000) {
        if (settings.delete_message) await message.delete().catch(() => {});
        return;
      }
      recentlyHandled.set(key, Date.now());

      const content = (message.content || '').slice(0, 1000)
        || (message.attachments.size ? `[${message.attachments.size} vedhæftning(er)]` : '[tom besked]');
      const action = settings.action || 'kick';
      const errors = [];
      let reportId = null;

      console.log(`[Honeypot] 🍯 ${message.author.tag} (${member.id}) wrote in honeypot in ${message.guild.name}`);

      if (settings.delete_message) {
        await message.delete().catch(e => errors.push(`delete: ${e.message}`));
      }

      // Global ban report
      if (settings.report_global_ban) {
        const { data, error } = await supabase.from('global_ban_reports').insert({
          reporter_discord_id: client.user.id,
          reporter_discord_name: `${client.user.tag} (Honeypot @ ${message.guild.name})`,
          target_discord_id: member.id,
          target_discord_name: message.author.tag,
          reason: `[Honeypot] Skrev i honeypot-kanal på ${message.guild.name}. Besked: "${content.slice(0, 300)}"`,
          severity: settings.report_severity || 'scam',
          evidence_urls: [],
        }).select('id').single();
        if (error) errors.push(`report: ${error.message}`);
        else reportId = data?.id ?? null;
      }

      // Try to notify the user first
      try {
        await member.send(
          `🍯 Du blev fjernet fra **${message.guild.name}**, fordi du skrev i en honeypot-kanal. ` +
          `Dette sker typisk, når en konto er blevet hacket eller bruges til spam. ` +
          `Skift dit password og aktiver 2FA, og kontakt serverens administratorer, hvis det er en fejl.`
        );
      } catch { /* DMs closed */ }

      const reason = `[Honeypot] Skrev i honeypot-kanal`;
      if (action === 'ban') {
        if (!member.bannable) {
          errors.push('ban: botten kan ikke banne brugeren (manglende Ban Members eller rollehierarki)');
        } else {
          await member.ban({ reason, deleteMessageSeconds: 3600 }).catch(e => errors.push(`ban: ${e.message}`));
        }
      } else if (action === 'kick') {
        if (!member.kickable) {
          errors.push('kick: botten kan ikke kicke brugeren (manglende Kick Members eller rollehierarki)');
        } else {
          await member.kick(reason).catch(e => errors.push(`kick: ${e.message}`));
        }
      }

      await supabase.from('honeypot_catches').insert({
        guild_id: settings._guildUuid,
        user_id: member.id,
        user_name: message.author.tag,
        message_content: content,
        action_taken: action,
        global_ban_report_id: reportId,
        error_message: errors.length ? errors.join('; ') : null,
      }).then(({ error }) => { if (error) console.error('[Honeypot] catch insert error:', error.message); });

      await supabase.from('dashboard_notifications').insert({
        guild_id: settings._guildUuid,
        type: 'warning',
        title: '🍯 Honeypot fangede en bruger',
        message: `${message.author.tag} skrev i honeypot-kanalen og blev ${action === 'ban' ? 'bannet' : action === 'kick' ? 'kicket' : 'logget'}${reportId ? ' + rapporteret til global ban' : ''}.`,
        source: 'honeypot',
        metadata: { user_id: member.id, report_id: reportId },
      }).then(() => {}, () => {});

      if (settings.log_channel_id) {
        const logChannel = message.guild.channels.cache.get(settings.log_channel_id);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🍯 Honeypot udløst')
            .setColor(action === 'ban' ? 0xED4245 : 0xFFA500)
            .addFields(
              { name: 'Bruger', value: `<@${member.id}> (${message.author.tag})`, inline: true },
              { name: 'Handling', value: action === 'none' ? 'Kun logget' : action === 'ban' ? 'Ban' : 'Kick', inline: true },
              { name: 'Global ban-rapport', value: reportId ? `✅ Oprettet (afventer review)` : '—', inline: true },
              { name: 'Besked', value: content.slice(0, 1000) || '—' },
            )
            .setTimestamp();
          if (errors.length) embed.addFields({ name: 'Fejl', value: errors.join('\n').slice(0, 1000) });
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Honeypot] Error:', err.message);
    }
  }

  client.on(Events.MessageCreate, onMessage);

  /**
   * Posts (or refreshes) the warning message in the honeypot channel.
   * Called from the dashboard via realtime `honeypot_settings` change or on startup.
   */
  async function ensureWarningMessage(guildDiscordId) {
    try {
      settingsCache.delete(guildDiscordId);
      const settings = await getSettings(guildDiscordId);
      if (!settings || !settings.warning_message) return;
      const guild = client.guilds.cache.get(guildDiscordId);
      const channel = guild?.channels.cache.get(settings.channel_id);
      if (!guild) {
        console.warn(`[Honeypot] Cannot post warning: guild ${guildDiscordId} is not in this bot client's cache`);
        return;
      }
      if (!channel || !channel.isTextBased()) {
        console.warn(`[Honeypot] Cannot post warning: channel ${settings.channel_id} was not found or is not text based`);
        return;
      }

      const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      const existing = recent?.find(m => m.author.id === client.user.id && m.embeds[0]?.footer?.text === 'honeypot');
      const embed = new EmbedBuilder()
        .setTitle('🍯 Sikkerhedskanal')
        .setDescription(settings.warning_message)
        .setColor(0xFEE75C)
        .setFooter({ text: 'honeypot' });
      if (existing) await existing.edit({ embeds: [embed] }).catch(() => {});
      else await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('[Honeypot] ensureWarningMessage error:', err.message);
    }
  }

  // Post warning message when settings change
  try {
    supabase
      .channel('honeypot-warning-message')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'honeypot_settings' }, async (payload) => {
        const row = payload.new;
        if (!row?.guild_id || !row.enabled || !row.channel_id) return;
        const { data: g } = await supabase.from('guilds').select('guild_id').eq('id', row.guild_id).maybeSingle();
        if (g?.guild_id && (!shouldHandleGuild || shouldHandleGuild(g.guild_id))) {
          await ensureWarningMessage(g.guild_id);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Honeypot] Warning realtime subscription status: ${status}`);
        }
      });
  } catch { /* realtime optional */ }

  console.log('[Honeypot] Handler initialized');

  return {
    ensureWarningMessage,
    destroy: () => client.removeListener(Events.MessageCreate, onMessage),
  };
}

module.exports = { setupHoneypotHandler };
