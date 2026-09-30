// Stats Handler - Auto-updating voice channel names with server statistics
// Updates channel names every 10 minutes with member count, online count, etc.
// Discord limits voice channel renames to 2 per 10 minutes per channel.
// Includes delay between updates and retry logic for rate limits.

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { createRealtimeSubscription } = require('../realtimeRetry');

function setupStatsHandler(client, supabase, options = {}) {
  const { shouldHandleGuild, isCustomBot } = options;

  const updateStats = async (forceGuildId = null) => {
    try {
      let query = supabase
        .from('stats_channels')
        .select('*, guilds!inner(guild_id)')
        .eq('enabled', true);

      if (forceGuildId) {
        query = query.eq('guild_id', forceGuildId);
      }

      const { data: statsChannels, error } = await query;

      if (error) {
        console.error('[Stats] DB query error:', error.message);
        return;
      }
      if (!statsChannels || statsChannels.length === 0) {
        console.log('[Stats] No enabled stat channels found');
        return;
      }

      // Group by guild to only fetch members once per guild and only keep
      // rows this specific bot instance is responsible for.
      const byGuild = {};
      for (const stat of statsChannels) {
        const discordGuildId = stat.guilds?.guild_id;
        if (!discordGuildId) continue;
        if (shouldHandleGuild && !shouldHandleGuild(discordGuildId)) continue;
        if (!byGuild[discordGuildId]) byGuild[discordGuildId] = [];
        byGuild[discordGuildId].push(stat);
      }

      const eligibleCount = Object.values(byGuild).reduce((sum, rows) => sum + rows.length, 0);
      if (eligibleCount === 0) return;

      console.log(`[Stats] Processing ${eligibleCount} stat channel(s) for ${Object.keys(byGuild).length} guild(s)`);

      for (const [discordGuildId, stats] of Object.entries(byGuild)) {
        const guild = client.guilds.cache.get(discordGuildId);
        if (!guild) {
          console.warn(`[Stats] Guild ${discordGuildId} not in cache`);
          continue;
        }

        // Fetch fresh member data once per guild
        try {
          await guild.members.fetch();
        } catch (fetchErr) {
          console.error(`[Stats] Failed to fetch members for ${discordGuildId}:`, fetchErr.message);
          continue;
        }

        for (const stat of stats) {
          try {
            let count = 0;

            switch (stat.stat_type) {
              case 'members':
                count = guild.memberCount;
                break;
              case 'online':
                count = guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;
                break;
              case 'boosts':
                count = guild.premiumSubscriptionCount || 0;
                break;
              case 'roles':
                count = guild.roles.cache.size;
                break;
              case 'bots':
                count = guild.members.cache.filter(m => m.user.bot).size;
                break;
              case 'channels':
                count = guild.channels.cache.size;
                break;
              default:
                console.warn(`[Stats] Unknown stat_type: ${stat.stat_type}`);
                continue;
            }

            const channelName = stat.format_template.replace('{count}', count.toLocaleString('da-DK'));

            if (!stat.channel_id) {
              console.warn(`[Stats] No channel_id set for stat ${stat.id}`);
              continue;
            }

            try {
              const channel = await guild.channels.fetch(stat.channel_id);
              if (!channel) {
                console.warn(`[Stats] Channel ${stat.channel_id} not found in guild ${discordGuildId}`);
                continue;
              }

              if (channel.name === channelName) {
                console.log(`[Stats] Channel ${stat.channel_id} already named "${channelName}", skipping`);
                continue;
              }

              console.log(`[Stats] Updating channel "${channel.name}" -> "${channelName}"`);

              // Attempt rename with retry on rate limit
              try {
                await channel.setName(channelName);
                console.log(`[Stats] ✅ Updated channel ${stat.channel_id} to "${channelName}"`);
              } catch (renameErr) {
                if (renameErr.httpStatus === 429 || renameErr.message?.includes('rate limit')) {
                  const retryAfter = renameErr.retryAfter || 30;
                  console.warn(`[Stats] Rate limited on ${stat.channel_id}, waiting ${retryAfter}s before retry`);
                  await sleep(retryAfter * 1000 + 1000);
                  try {
                    await channel.setName(channelName);
                    console.log(`[Stats] ✅ Updated channel ${stat.channel_id} after retry`);
                  } catch (retryErr) {
                    console.error(`[Stats] Retry also failed for ${stat.channel_id}:`, retryErr.message);
                  }
                } else {
                  throw renameErr;
                }
              }

              // Wait 10 seconds between channel renames to respect rate limits
              await sleep(10000);
            } catch (fetchErr) {
              console.error(`[Stats] Failed to fetch/update channel ${stat.channel_id}:`, fetchErr.message);
            }
          } catch (err) {
            console.error(`[Stats] Update error for ${stat.id}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[Stats] Handler error:', err.message);
    }
  };

  // Update every 10 minutes instead of 5 to stay within Discord's rate limits
  const statsInterval = setInterval(updateStats, 10 * 60 * 1000);
  // Run first update after 10 seconds
  const initialTimeout = setTimeout(updateStats, 10000);

  // Listen for force update requests via Realtime (default bot only)
  let realtimeSub = null;
  if (!isCustomBot) {
    realtimeSub = createRealtimeSubscription(supabase, 'stats-force-update', [{
      filter: { event: 'INSERT', schema: 'public', table: 'stats_force_update' },
      callback: async (payload) => {
        const guildId = payload.new?.guild_id;
        console.log(`[Stats] Force update requested for guild ${guildId}`);
        await updateStats(guildId || null);
        if (payload.new?.id) {
          await supabase.from('stats_force_update').delete().eq('id', payload.new.id);
        }
      }
    }], { label: 'StatsForceUpdate' });
  }

  console.log('✅ Stats handler loaded (10 min interval, rate-limit aware)');

  return {
    destroy() {
      clearInterval(statsInterval);
      clearTimeout(initialTimeout);
      if (realtimeSub) realtimeSub.destroy();
    }
  };
}

module.exports = { setupStatsHandler };
