/**
 * Scheduled Action Handler
 * 
 * Polls the scheduled_actions table every 60 seconds and executes
 * pending actions (mute, ban, unban, role_add, role_remove) via Discord API.
 */

function setupScheduledActionHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;
  console.log('[ScheduledActions] Handler initialized');

  setInterval(async () => {
    try {
      const now = new Date().toISOString();

      const { data: actions, error } = await supabase
        .from('scheduled_actions')
        .select('*')
        .eq('executed', false)
        .lte('execute_at', now);

      if (error) {
        console.error('[ScheduledActions] Query error:', error.message);
        return;
      }

      if (!actions || actions.length === 0) return;

      for (const action of actions) {
        try {
          // Find the guild's discord_id from the guilds table
          const { data: guildRow } = await supabase
            .from('guilds')
            .select('guild_id')
            .eq('id', action.guild_id)
            .single();

          if (!guildRow) {
            console.warn(`[ScheduledActions] Guild not found for id ${action.guild_id}`);
            continue;
          }

          // Check if this bot instance should handle this guild
          if (shouldHandleGuild && !shouldHandleGuild(guildRow.guild_id)) continue;

          const guild = client.guilds.cache.get(guildRow.guild_id);
          if (!guild) {
            console.warn(`[ScheduledActions] Discord guild not in cache: ${guildRow.guild_id}`);
            continue;
          }

          switch (action.action_type) {
            case 'mute': {
              const member = await guild.members.fetch(action.target_discord_id).catch(() => null);
              if (member) {
                // Default 1 hour timeout
                await member.timeout(60 * 60 * 1000, action.reason || 'Planlagt mute');
                console.log(`[ScheduledActions] Muted ${action.target_discord_id} in ${guild.name}`);
              }
              break;
            }
            case 'ban': {
              await guild.members.ban(action.target_discord_id, {
                reason: action.reason || 'Planlagt ban',
              });
              console.log(`[ScheduledActions] Banned ${action.target_discord_id} in ${guild.name}`);
              break;
            }
            case 'unban': {
              await guild.members.unban(action.target_discord_id, action.reason || 'Planlagt unban');
              console.log(`[ScheduledActions] Unbanned ${action.target_discord_id} in ${guild.name}`);
              break;
            }
            case 'role_add': {
              if (!action.role_id) break;
              const member = await guild.members.fetch(action.target_discord_id).catch(() => null);
              if (member) {
                await member.roles.add(action.role_id, action.reason || 'Planlagt rolle-tilføjelse');
                console.log(`[ScheduledActions] Added role to ${action.target_discord_id}`);
              }
              break;
            }
            case 'role_remove': {
              if (!action.role_id) break;
              const member = await guild.members.fetch(action.target_discord_id).catch(() => null);
              if (member) {
                await member.roles.remove(action.role_id, action.reason || 'Planlagt rolle-fjernelse');
                console.log(`[ScheduledActions] Removed role from ${action.target_discord_id}`);
              }
              break;
            }
            default:
              console.warn(`[ScheduledActions] Unknown action type: ${action.action_type}`);
          }

          // Mark as executed
          await supabase
            .from('scheduled_actions')
            .update({ executed: true, executed_at: new Date().toISOString() })
            .eq('id', action.id);

        } catch (err) {
          console.error(`[ScheduledActions] Error executing action ${action.id}:`, err.message);
          // Continue with next action
        }
      }
    } catch (err) {
      console.error('[ScheduledActions] Poll error:', err.message);
    }
  }, 60_000); // Every 60 seconds
}

module.exports = { setupScheduledActionHandler };
