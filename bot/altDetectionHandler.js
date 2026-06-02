/**
 * Alt Account Detection Handler
 * 
 * When a new member joins, checks if their username/discriminator pattern
 * matches any recently banned users. Flags suspicious matches.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isAutomodBypassed } = require('./automodBypass');

const banCache = new Map(); // guildId -> { bans: [...], ts }
const CACHE_TTL = 600_000;

function setupAltDetectionHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getRecentBans(guild) {
    const cached = banCache.get(guild.id);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.bans;

    try {
      const bans = await guild.bans.fetch({ limit: 100 });
      const banList = bans.map(b => ({
        id: b.user.id,
        username: b.user.username.toLowerCase(),
        createdAt: b.user.createdTimestamp,
      }));
      banCache.set(guild.id, { bans: banList, ts: Date.now() });
      return banList;
    } catch {
      return [];
    }
  }

  function isSuspicious(newUser, bannedUsers) {
    const newName = newUser.username.toLowerCase();
    const newAge = Date.now() - newUser.createdTimestamp;
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

    for (const banned of bannedUsers) {
      // Same base name with numbers appended
      const baseNew = newName.replace(/[0-9_.-]+$/g, '');
      const baseBanned = banned.username.replace(/[0-9_.-]+$/g, '');

      if (baseNew.length >= 3 && baseBanned.length >= 3) {
        // Similar names
        if (baseNew === baseBanned && newName !== banned.username) {
          return { match: banned, reason: 'Lignende brugernavn' };
        }
        // Name contains banned name
        if (baseNew.includes(baseBanned) || baseBanned.includes(baseNew)) {
          if (newAge < ONE_WEEK) {
            return { match: banned, reason: 'Nyt navn matcher banliste + ny konto' };
          }
        }
      }
    }
    return null;
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || member.user.bot) return;
    if (shouldHandleGuild && !shouldHandleGuild(member.guild.id)) return;
    if (await isAutomodBypassed(supabase, member)) return;

    try {
      const bannedUsers = await getRecentBans(member.guild);
      if (bannedUsers.length === 0) return;

      const result = isSuspicious(member.user, bannedUsers);
      if (!result) return;

      // Get guild UUID for DB operations
      const { data: guild } = await supabase
        .from('guilds').select('id').eq('guild_id', member.guild.id).single();
      if (!guild) return;

      // Send dashboard notification
      await supabase.from('dashboard_notifications').insert({
        guild_id: guild.id,
        type: 'warning',
        title: '⚠️ Mulig alt-konto detekteret',
        message: `${member.user.username} ligner banned bruger ${result.match.username}: ${result.reason}`,
        source: 'alt-detection',
        metadata: {
          user_id: member.user.id,
          banned_user_id: result.match.id,
          reason: result.reason,
        },
      }).catch(() => {});

      // Find log channel from raid or quarantine settings
      const { data: raidSettings } = await supabase
        .from('raid_protection_settings').select('log_channel_id').eq('guild_id', guild.id).maybeSingle();

      const logChannelId = raidSettings?.log_channel_id;
      if (logChannelId) {
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Mulig Alt-Konto')
            .setColor(0xFFA500)
            .addFields(
              { name: 'Ny bruger', value: `<@${member.user.id}> (${member.user.username})`, inline: true },
              { name: 'Matcher', value: result.match.username, inline: true },
              { name: 'Årsag', value: result.reason },
              { name: 'Kontoalder', value: `${accountAge} dage`, inline: true },
            )
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      console.log(`[AltDetection] Suspicious join: ${member.user.username} matches ${result.match.username}`);
    } catch (err) {
      console.error('[AltDetection] Error:', err.message);
    }
  });

  console.log('[AltDetection] Handler initialized');
}

module.exports = { setupAltDetectionHandler };
