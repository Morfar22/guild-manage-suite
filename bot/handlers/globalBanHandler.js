/**
 * Global Ban Handler
 * 
 * Polls pending global ban executions and applies them only in the guilds
 * this bot instance is responsible for.
 * Also auto-detects globally banned users when they join a guild.
 */

function setupGlobalBanHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  console.log('[GlobalBan] Setting up handler...');

  let isProcessingQueue = false;
  const permissionWarnings = new Set();
  const banFailureWarnings = new Set();
  const blockedExecutionUntil = new Map();
  const BLOCKED_RETRY_MS = 10 * 60 * 1000;

  async function getManagedGuildRows() {
    const managedDiscordGuildIds = client.guilds.cache
      .map(guild => guild.id)
      .filter(guildId => !shouldHandleGuild || shouldHandleGuild(guildId));

    if (managedDiscordGuildIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('guilds')
      .select('id, guild_id')
      .in('guild_id', managedDiscordGuildIds);

    if (error) {
      console.error('[GlobalBan] Error fetching managed guilds:', error.message);
      return [];
    }

    return data || [];
  }

  async function processPendingExecutions() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      const guildRows = await getManagedGuildRows();
      if (guildRows.length === 0) return;

      const guildIdByDbId = new Map(guildRows.map(row => [row.id, row.guild_id]));
      const managedGuildDbIds = guildRows.map(row => row.id);

      const { data: executions, error } = await supabase
        .from('global_ban_executions')
        .select('id, guild_id, global_ban_id')
        .eq('executed', false)
        .in('guild_id', managedGuildDbIds)
        .limit(100);

      if (error) {
        console.error('[GlobalBan] Error fetching executions:', error.message);
        return;
      }

      if (!executions || executions.length === 0) return;

      const banIds = [...new Set(executions.map(execution => execution.global_ban_id).filter(Boolean))];
      const { data: bans, error: bansError } = await supabase
        .from('global_bans')
        .select('id, target_discord_id, target_discord_name, reason')
        .in('id', banIds);

      if (bansError) {
        console.error('[GlobalBan] Error fetching ban details:', bansError.message);
        return;
      }

      const bansById = new Map((bans || []).map(ban => [ban.id, ban]));
      let executedCount = 0;

      for (const execution of executions) {
        const blockedUntil = blockedExecutionUntil.get(execution.id) || 0;
        if (blockedUntil > Date.now()) continue;
        if (blockedUntil) blockedExecutionUntil.delete(execution.id);

        const discordGuildId = guildIdByDbId.get(execution.guild_id);
        const ban = bansById.get(execution.global_ban_id);

        if (!discordGuildId) {
          await supabase.from('global_ban_executions').update({
            executed: false,
            error_message: 'Guild not found in database',
            executed_at: new Date().toISOString(),
          }).eq('id', execution.id);
          continue;
        }

        if (!ban) {
          await supabase.from('global_ban_executions').update({
            executed: false,
            error_message: 'Global ban record not found',
            executed_at: new Date().toISOString(),
          }).eq('id', execution.id);
          continue;
        }

        try {
          const guild = client.guilds.cache.get(discordGuildId);
          if (!guild) {
            await supabase.from('global_ban_executions').update({
              executed: false,
              error_message: 'Bot not in guild',
              executed_at: new Date().toISOString(),
            }).eq('id', execution.id);
            continue;
          }

          const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
          if (!me?.permissions?.has('BanMembers')) {
            const permissionError = 'Missing BanMembers permission';
            blockedExecutionUntil.set(execution.id, Date.now() + BLOCKED_RETRY_MS);
            if (!permissionWarnings.has(discordGuildId)) {
              console.warn(`[GlobalBan] Skipping ${guild.name}: ${permissionError} (retry om 10 min)`);
              permissionWarnings.add(discordGuildId);
            }
            await supabase.from('global_ban_executions').update({
              executed: false,
              error_message: permissionError,
              executed_at: new Date().toISOString(),
            }).eq('id', execution.id);
            continue;
          }

          permissionWarnings.delete(discordGuildId);

          // If the target is currently a member, Discord role hierarchy may make
          // them unbannable even when the bot has BanMembers.
          const targetMember = await guild.members.fetch(ban.target_discord_id).catch(() => null);
          if (targetMember && !targetMember.bannable) {
            const hierarchyError = 'Target is not bannable (role hierarchy or guild owner)';
            const failureKey = `${discordGuildId}:${ban.target_discord_id}:hierarchy`;
            blockedExecutionUntil.set(execution.id, Date.now() + BLOCKED_RETRY_MS);

            if (!banFailureWarnings.has(failureKey)) {
              console.warn(`[GlobalBan] Skipping ${ban.target_discord_id} in ${guild.name}: ${hierarchyError} (retry om 10 min)`);
              banFailureWarnings.add(failureKey);
            }

            await supabase.from('global_ban_executions').update({
              executed: false,
              error_message: hierarchyError,
              executed_at: new Date().toISOString(),
            }).eq('id', execution.id);
            continue;
          }

          await guild.members.ban(ban.target_discord_id, {
            reason: `[Global Ban] ${ban.reason}`,
          });

          await supabase.from('global_ban_executions').update({
            executed: true,
            error_message: null,
            executed_at: new Date().toISOString(),
          }).eq('id', execution.id);

          executedCount++;
          console.log(`[GlobalBan] ✅ Banned ${ban.target_discord_id} from ${guild.name}`);
        } catch (banError) {
          const errorMsg = banError.message || String(banError);
          const failureKey = `${discordGuildId}:${ban.target_discord_id}:${errorMsg}`;

          if (banError.code === 50013 || /missing permissions/i.test(errorMsg)) {
            blockedExecutionUntil.set(execution.id, Date.now() + BLOCKED_RETRY_MS);
          }

          if (!banFailureWarnings.has(failureKey)) {
            const retryNote = blockedExecutionUntil.has(execution.id) ? ' (retry om 10 min)' : '';
            console.warn(`[GlobalBan] Could not ban ${ban.target_discord_id} in ${discordGuildId}: ${errorMsg}${retryNote}`);
            banFailureWarnings.add(failureKey);
          }

          await supabase.from('global_ban_executions').update({
            executed: false,
            error_message: errorMsg,
            executed_at: new Date().toISOString(),
          }).eq('id', execution.id);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (executedCount > 0) {
        console.log(`[GlobalBan] Finished polling run: ${executedCount} ban(s) executed`);
      }
    } catch (err) {
      console.error('[GlobalBan] Error processing execution queue:', err);
    } finally {
      isProcessingQueue = false;
    }
  }

  const executionInterval = setInterval(processPendingExecutions, 15000);
  const initialExecutionTimeout = setTimeout(processPendingExecutions, 5000);

  // ── Auto-detect: check new members against global bans ──
  const onGuildMemberAdd = async (member) => {
    try {
      if (shouldHandleGuild && !shouldHandleGuild(member.guild.id)) return;

      const { data: guildRow } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', member.guild.id)
        .single();

      if (!guildRow) return;

      const { data: bans } = await supabase
        .from('global_bans')
        .select('id, reason, severity')
        .eq('target_discord_id', member.user.id);

      if (!bans || bans.length === 0) return;

      const ban = bans[0];
      console.log(`[GlobalBan] ⚠️ Globally banned user ${member.user.tag} joined ${member.guild.name}`);

      const { data: settings } = await supabase
        .from('guild_bot_settings')
        .select('global_ban_auto_action, global_ban_opt_out')
        .eq('guild_id', guildRow.id)
        .single();

      if (settings?.global_ban_opt_out) return;

      const autoAction = settings?.global_ban_auto_action || 'none';

      await supabase.from('global_ban_alerts').insert({
        guild_id: guildRow.id,
        ban_id: ban.id,
        member_discord_id: member.user.id,
        alert_type: autoAction === 'none' ? 'warning' : autoAction,
        action_taken: autoAction,
      });

      if (autoAction === 'ban') {
        await member.ban({ reason: `[Global Ban Auto-detect] ${ban.reason}` });
        console.log(`[GlobalBan] Auto-banned ${member.user.tag} from ${member.guild.name}`);
      } else if (autoAction === 'kick') {
        await member.kick(`[Global Ban Auto-detect] ${ban.reason}`);
        console.log(`[GlobalBan] Auto-kicked ${member.user.tag} from ${member.guild.name}`);
      } else if (autoAction === 'warn') {
        try {
          await member.send(`⚠️ Du er registreret i det globale ban-system på **${member.guild.name}**. Kontakt en administrator for mere info.`);
        } catch { /* DMs may be disabled */ }
        console.log(`[GlobalBan] Warned ${member.user.tag} in ${member.guild.name}`);
      }
    } catch (err) {
      console.error('[GlobalBan] Error in auto-detect:', err);
    }
  };

  client.on('guildMemberAdd', onGuildMemberAdd);

  return {
    destroy: () => {
      clearInterval(executionInterval);
      clearTimeout(initialExecutionTimeout);
      client.removeListener('guildMemberAdd', onGuildMemberAdd);
      console.log('[GlobalBan] Handler destroyed');
    },
  };
}

module.exports = { setupGlobalBanHandler };
