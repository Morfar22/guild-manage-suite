'use strict';

const { Events } = require('discord.js');

const WORKFLOW_CACHE_TTL = 30_000;
const EVENT_POLL_MS = Number(process.env.PLATFORM_V3_EVENT_POLL_MS || 10_000);
const HEALTH_SCAN_MS = Number(process.env.PLATFORM_V3_HEALTH_SCAN_MS || 300_000);
const SLA_SCAN_MS = Number(process.env.PLATFORM_V3_SLA_SCAN_MS || 60_000);

function setupPlatformV3Handler(client, supabase, options = {}) {
  const shouldHandleGuild = options.shouldHandleGuild || (() => true);
  const workflowCache = new Map();
  const guildByInternalId = new Map();
  const internalByDiscordId = new Map();
  const seenEvents = new Set();
  let lastPoll = new Date(Date.now() - 5_000).toISOString();
  let polling = false;
  let scanningHealth = false;
  let scanningSla = false;

  const rememberSeen = (id) => {
    seenEvents.add(id);
    if (seenEvents.size > 10_000) {
      const first = seenEvents.values().next().value;
      if (first) seenEvents.delete(first);
    }
  };

  const getInternalGuild = async (discordGuildId) => {
    if (!discordGuildId) return null;
    if (internalByDiscordId.has(discordGuildId)) return internalByDiscordId.get(discordGuildId);

    const { data, error } = await supabase
      .from('guilds')
      .select('id, guild_id, guild_name')
      .eq('guild_id', discordGuildId)
      .maybeSingle();

    if (error || !data) return null;
    internalByDiscordId.set(discordGuildId, data);
    guildByInternalId.set(data.id, data);
    return data;
  };

  const getDiscordGuildRecord = async (internalGuildId) => {
    if (!internalGuildId) return null;
    if (guildByInternalId.has(internalGuildId)) return guildByInternalId.get(internalGuildId);

    const { data, error } = await supabase
      .from('guilds')
      .select('id, guild_id, guild_name')
      .eq('id', internalGuildId)
      .maybeSingle();

    if (error || !data) return null;
    guildByInternalId.set(internalGuildId, data);
    internalByDiscordId.set(data.guild_id, data);
    return data;
  };

  const getWorkflows = async (internalGuildId, triggerType) => {
    const key = `${internalGuildId}:${triggerType}`;
    const cached = workflowCache.get(key);
    if (cached && Date.now() - cached.time < WORKFLOW_CACHE_TTL) return cached.rows;

    const { data, error } = await supabase
      .from('automation_workflows')
      .select('*')
      .eq('guild_id', internalGuildId)
      .eq('trigger_type', triggerType)
      .eq('enabled', true);

    if (error) {
      console.error('[PlatformV3] Workflow fetch error:', error.message);
      return cached?.rows || [];
    }

    const rows = data || [];
    workflowCache.set(key, { rows, time: Date.now() });
    return rows;
  };

  const render = (value, context) => {
    if (typeof value !== 'string') return value;
    return value
      .replace(/\{user\}/g, context.userId ? `<@${context.userId}>` : 'ukendt bruger')
      .replace(/\{username\}/g, context.username || context.userId || 'ukendt')
      .replace(/\{server\}/g, context.guildName || 'serveren')
      .replace(/\{channel\}/g, context.channelId ? `<#${context.channelId}>` : 'ukendt kanal')
      .replace(/\{command\}/g, context.commandName || '')
      .replace(/\{ticket\}/g, context.ticketId || '');
  };

  const executeActions = async (workflow, context) => {
    const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
    const guildRecord = await getDiscordGuildRecord(workflow.guild_id);
    if (!guildRecord || !shouldHandleGuild(guildRecord.guild_id)) return 'skipped';

    const guild = client.guilds.cache.get(guildRecord.guild_id)
      || await client.guilds.fetch(guildRecord.guild_id).catch(() => null);
    if (!guild) return 'skipped';

    let partial = false;

    for (const action of actions) {
      try {
        const type = action?.type;

        if (type === 'send_message') {
          const channelId = action.channel_id || context.channelId;
          const channel = channelId
            ? guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)
            : null;
          if (!channel?.isTextBased?.()) throw new Error('Workflow channel not found or not text-based');
          await channel.send({ content: render(action.message || 'Workflow triggered', context) });
          continue;
        }

        if (type === 'dm') {
          if (!context.userId) throw new Error('Workflow has no target user');
          const target = await client.users.fetch(context.userId);
          await target.send(render(action.message || 'Workflow triggered', context));
          continue;
        }

        if (type === 'add_role' || type === 'remove_role') {
          if (!context.userId || !action.role_id) throw new Error('Workflow role action missing user or role');
          const member = await guild.members.fetch(context.userId);
          if (type === 'add_role') await member.roles.add(action.role_id, `Workflow: ${workflow.name}`);
          else await member.roles.remove(action.role_id, `Workflow: ${workflow.name}`);
          continue;
        }

        if (type === 'dashboard_alert') {
          await supabase.from('dashboard_notifications').insert({
            guild_id: workflow.guild_id,
            type: action.severity === 'critical' ? 'error' : 'system',
            severity: action.severity || 'info',
            status: 'open',
            title: render(action.title || `Workflow: ${workflow.name}`, context),
            message: render(action.message || `Trigger: ${workflow.trigger_type}`, context),
            source: 'workflow',
            metadata: {
              workflow_id: workflow.id,
              trigger_type: workflow.trigger_type,
              context,
            },
          });
          continue;
        }

        if (type === 'create_case') {
          if (!context.userId) throw new Error('Workflow case action missing target user');
          await supabase.from('moderation_logs').insert({
            guild_id: workflow.guild_id,
            action_type: 'warn',
            moderator_id: client.user.id,
            moderator_name: client.user.tag,
            target_id: context.userId,
            target_name: context.username || context.userId,
            reason: render(action.reason || `Workflow: ${workflow.name}`, context),
            status: 'open',
            severity: action.severity || 'medium',
            metadata: {
              automated: true,
              workflow_id: workflow.id,
            },
          });
          continue;
        }

        partial = true;
        console.warn(`[PlatformV3] Unknown workflow action: ${type}`);
      } catch (error) {
        partial = true;
        console.error(`[PlatformV3] Workflow action failed (${workflow.name}):`, error.message);
      }
    }

    return partial ? 'partial' : 'success';
  };

  const runWorkflows = async (internalGuildId, triggerType, context) => {
    const workflows = await getWorkflows(internalGuildId, triggerType);
    for (const workflow of workflows) {
      try {
        if (triggerType === 'message_keyword') {
          const keyword = String(workflow.trigger_config?.keyword || '').trim();
          if (!keyword) continue;
          const haystack = String(context.messageContent || '');
          const caseSensitive = Boolean(workflow.trigger_config?.case_sensitive);
          const matched = caseSensitive
            ? haystack.includes(keyword)
            : haystack.toLowerCase().includes(keyword.toLowerCase());
          if (!matched) continue;
        }

        const status = await executeActions(workflow, context);

        await supabase.from('workflow_executions').insert({
          guild_id: internalGuildId,
          workflow_id: workflow.id,
          trigger_type: triggerType,
          trigger_payload: context,
          status,
        });

        await supabase
          .from('automation_workflows')
          .update({
            run_count: Number(workflow.run_count || 0) + 1,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', workflow.id);

        workflow.run_count = Number(workflow.run_count || 0) + 1;
      } catch (error) {
        console.error(`[PlatformV3] Workflow failed (${workflow.name}):`, error.message);

        await supabase.from('workflow_executions').insert({
          guild_id: internalGuildId,
          workflow_id: workflow.id,
          trigger_type: triggerType,
          trigger_payload: context,
          status: 'error',
          error_message: String(error.message || error).slice(0, 1000),
        }).catch(() => {});

        await supabase.from('dashboard_notifications').insert({
          guild_id: internalGuildId,
          type: 'error',
          severity: 'error',
          status: 'open',
          title: `Workflow fejlede: ${workflow.name}`,
          message: String(error.message || error).slice(0, 500),
          source: 'workflow',
          metadata: { workflow_id: workflow.id },
        }).catch(() => {});
      }
    }
  };

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || !shouldHandleGuild(member.guild.id)) return;
    const internal = await getInternalGuild(member.guild.id);
    if (!internal) return;

    await runWorkflows(internal.id, 'member_join', {
      userId: member.id,
      username: member.user.username,
      guildId: member.guild.id,
      guildName: member.guild.name,
      accountCreatedAt: member.user.createdAt?.toISOString?.() || null,
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || !shouldHandleGuild(message.guild.id)) return;
    const internal = await getInternalGuild(message.guild.id);
    if (!internal) return;

    await runWorkflows(internal.id, 'message_keyword', {
      userId: message.author.id,
      username: message.author.username,
      guildId: message.guild.id,
      guildName: message.guild.name,
      channelId: message.channel.id,
      messageId: message.id,
      messageContent: message.content,
    });
  });

  const pollDbTriggers = async () => {
    if (polling) return;
    polling = true;
    const now = new Date().toISOString();
    const since = lastPoll;

    try {
      const [ticketsResult, commandErrorsResult, raidsResult] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, guild_id, creator_id, creator_name, channel_id, subject, created_at')
          .gte('created_at', since)
          .lt('created_at', now)
          .order('created_at'),
        supabase
          .from('command_execution_events')
          .select('id, guild_id, command_name, user_id, channel_id, error_message, latency_ms, created_at')
          .eq('status', 'error')
          .gte('created_at', since)
          .lt('created_at', now)
          .order('created_at'),
        supabase
          .from('raid_logs')
          .select('id, guild_id, join_count, action_taken, user_ids, created_at')
          .gte('created_at', since)
          .lt('created_at', now)
          .order('created_at'),
      ]);

      for (const ticket of ticketsResult.data || []) {
        if (seenEvents.has(ticket.id)) continue;
        rememberSeen(ticket.id);
        const guildRecord = await getDiscordGuildRecord(ticket.guild_id);
        await runWorkflows(ticket.guild_id, 'ticket_created', {
          ticketId: ticket.id,
          userId: ticket.creator_id,
          username: ticket.creator_name,
          channelId: ticket.channel_id,
          guildId: guildRecord?.guild_id,
          guildName: guildRecord?.guild_name,
          subject: ticket.subject,
        });
      }

      for (const event of commandErrorsResult.data || []) {
        if (seenEvents.has(event.id)) continue;
        rememberSeen(event.id);
        const guildRecord = await getDiscordGuildRecord(event.guild_id);
        await runWorkflows(event.guild_id, 'command_error', {
          eventId: event.id,
          userId: event.user_id,
          channelId: event.channel_id,
          commandName: event.command_name,
          errorMessage: event.error_message,
          latencyMs: event.latency_ms,
          guildId: guildRecord?.guild_id,
          guildName: guildRecord?.guild_name,
        });
      }

      for (const raid of raidsResult.data || []) {
        if (seenEvents.has(raid.id)) continue;
        rememberSeen(raid.id);
        const guildRecord = await getDiscordGuildRecord(raid.guild_id);
        await runWorkflows(raid.guild_id, 'raid_detected', {
          raidId: raid.id,
          joinCount: raid.join_count,
          actionTaken: raid.action_taken,
          userIds: raid.user_ids,
          guildId: guildRecord?.guild_id,
          guildName: guildRecord?.guild_name,
        });
      }

      lastPoll = now;
    } catch (error) {
      console.error('[PlatformV3] DB trigger poll failed:', error.message);
    } finally {
      polling = false;
    }
  };

  const scanCommandHealth = async () => {
    if (scanningHealth) return;
    scanningHealth = true;
    try {
      const { data, error } = await supabase
        .from('command_health_7d')
        .select('*')
        .gte('executions', 5)
        .gte('error_rate', 25);

      if (error) throw error;

      for (const row of data || []) {
        const { data: existing } = await supabase
          .from('dashboard_notifications')
          .select('id')
          .eq('guild_id', row.guild_id)
          .eq('source', 'command-health')
          .neq('status', 'resolved')
          .contains('metadata', { command_name: row.command_name })
          .limit(1)
          .maybeSingle();

        if (existing) continue;

        const severity = Number(row.error_rate || 0) >= 50 ? 'critical' : 'warning';
        await supabase.from('dashboard_notifications').insert({
          guild_id: row.guild_id,
          type: 'warning',
          severity,
          status: 'open',
          title: `Command health: ${row.command_name}`,
          message: `${row.error_rate}% fejlrate over ${row.executions} executions. Gns. latency ${row.avg_latency_ms || 0} ms.`,
          source: 'command-health',
          metadata: {
            command_name: row.command_name,
            error_rate: row.error_rate,
            executions: row.executions,
            avg_latency_ms: row.avg_latency_ms,
          },
        });
      }
    } catch (error) {
      console.error('[PlatformV3] Command health scan failed:', error.message);
    } finally {
      scanningHealth = false;
    }
  };

  const scanTicketSla = async () => {
    if (scanningSla) return;
    scanningSla = true;
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('tickets')
        .select('id, guild_id, creator_name, subject, sla_due_at')
        .is('closed_at', null)
        .is('escalated_at', null)
        .not('sla_due_at', 'is', null)
        .lte('sla_due_at', now)
        .limit(100);

      if (error) throw error;

      for (const ticket of data || []) {
        await supabase.from('dashboard_notifications').insert({
          guild_id: ticket.guild_id,
          type: 'warning',
          severity: 'warning',
          status: 'open',
          title: 'Ticket SLA overskredet',
          message: `${ticket.creator_name || 'Bruger'} · ${ticket.subject || ticket.id}`,
          source: 'ticket-sla',
          metadata: { ticket_id: ticket.id, sla_due_at: ticket.sla_due_at },
        });

        await supabase
          .from('tickets')
          .update({ escalated_at: now, updated_at: now })
          .eq('id', ticket.id)
          .is('escalated_at', null);
      }
    } catch (error) {
      console.error('[PlatformV3] Ticket SLA scan failed:', error.message);
    } finally {
      scanningSla = false;
    }
  };

  const pollInterval = setInterval(() => void pollDbTriggers(), EVENT_POLL_MS);
  const healthInterval = setInterval(() => void scanCommandHealth(), HEALTH_SCAN_MS);
  const slaInterval = setInterval(() => void scanTicketSla(), SLA_SCAN_MS);

  setTimeout(() => void pollDbTriggers(), 3_000);
  setTimeout(() => void scanCommandHealth(), 8_000);
  setTimeout(() => void scanTicketSla(), 10_000);

  console.log('[PlatformV3] Workflow + alert engine initialized');

  return {
    destroy() {
      clearInterval(pollInterval);
      clearInterval(healthInterval);
      clearInterval(slaInterval);
      workflowCache.clear();
      guildByInternalId.clear();
      internalByDiscordId.clear();
      seenEvents.clear();
    },
  };
}

module.exports = { setupPlatformV3Handler };
