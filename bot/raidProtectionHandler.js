/**
 * Raid Protection Handler
 * 
 * Detects mass-joins and takes automatic action (lockdown, kick, ban, quarantine).
 * Settings are read from raid_protection_settings table.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isAutomodBypassed } = require('./automodBypass');

const joinTracker = new Map(); // guildId -> { timestamps: [], lockdownUntil }
const settingsCache = new Map();
const CACHE_TTL = 300_000;

function setupRaidProtectionHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    if (!guild) return null;

    const { data } = await supabase
      .from('raid_protection_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || (shouldHandleGuild && !shouldHandleGuild(member.guild.id))) return;

    // Global automod bypass roles (rare on join, but possible via auto-role)
    if (await isAutomodBypassed(supabase, member)) return;

    try {
      const settings = await getSettings(member.guild.id);
      if (!settings) return;

      const guildId = member.guild.id;
      if (!joinTracker.has(guildId)) {
        joinTracker.set(guildId, { timestamps: [], lockdownUntil: 0, userIds: [] });
      }

      const tracker = joinTracker.get(guildId);
      const now = Date.now();

      // If in lockdown, take action on new joins
      if (tracker.lockdownUntil > now) {
        await takeAction(member, settings);
        return;
      }

      // Track join
      tracker.timestamps.push(now);
      tracker.userIds.push(member.user.id);

      // Clean old timestamps outside window
      const cutoff = now - (settings.time_window_seconds * 1000);
      while (tracker.timestamps.length > 0 && tracker.timestamps[0] < cutoff) {
        tracker.timestamps.shift();
        tracker.userIds.shift();
      }

      // Check threshold
      if (tracker.timestamps.length >= settings.join_threshold) {
        console.log(`[RaidProtection] Raid detected in ${guildId}: ${tracker.timestamps.length} joins in ${settings.time_window_seconds}s`);

        tracker.lockdownUntil = now + (settings.lockdown_duration_minutes * 60_000);

        // Log raid
        await supabase.from('raid_logs').insert({
          guild_id: settings._guildUuid,
          join_count: tracker.timestamps.length,
          action_taken: settings.action,
          user_ids: tracker.userIds.slice(),
        }).catch(() => {});

        // Take action on all recent joiners
        for (const userId of tracker.userIds) {
          const m = member.guild.members.cache.get(userId);
          if (m) await takeAction(m, settings);
        }

        // Notify in log channel
        if (settings.notify_staff && settings.log_channel_id) {
          const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🚨 Raid Detekteret!')
              .setColor(0xED4245)
              .setDescription(`**${tracker.timestamps.length}** joins på **${settings.time_window_seconds}** sekunder`)
              .addFields(
                { name: 'Handling', value: settings.action, inline: true },
                { name: 'Lockdown varighed', value: `${settings.lockdown_duration_minutes} min`, inline: true },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }

        // Dashboard notification
        await supabase.from('dashboard_notifications').insert({
          guild_id: settings._guildUuid,
          type: 'warning',
          title: '🚨 Raid detekteret',
          message: `${tracker.timestamps.length} joins på ${settings.time_window_seconds}s - ${settings.action} aktiveret`,
          source: 'raid-protection',
        }).catch(() => {});

        // Reset tracker
        tracker.timestamps = [];
        tracker.userIds = [];
      }
    } catch (err) {
      console.error('[RaidProtection] Error:', err.message);
    }
  });

  async function takeAction(member, settings) {
    try {
      switch (settings.action) {
        case 'kick':
          await member.kick('Raid Protection: automatisk kick').catch(() => {});
          break;
        case 'ban':
          await member.ban({ reason: 'Raid Protection: automatisk ban' }).catch(() => {});
          break;
        case 'quarantine':
          if (settings.quarantine_role_id) {
            await member.roles.add(settings.quarantine_role_id, 'Raid Protection: karantæne').catch(() => {});
          }
          break;
        // 'lockdown' = no action on individual members
      }
    } catch {}
  }

  console.log('[RaidProtection] Handler initialized');
}

module.exports = { setupRaidProtectionHandler };
