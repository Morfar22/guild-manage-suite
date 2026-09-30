import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface CommandExecutionEvent {
  id: string;
  command_name: string;
  user_id: string | null;
  channel_id: string | null;
  source: string;
  status: string;
  latency_ms: number;
  blocked_reason: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CommandAuditEvent {
  id: string;
  action: string;
  user_email: string | null;
  details: unknown;
  created_at: string | null;
}

export function useCommandDetail(commandName: string | null, days: number, enabled = true) {
  const { selectedGuild } = useGuild();

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1));
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
  }, [days]);

  const sinceDay = sinceIso.slice(0, 10);

  const query = useQuery({
    queryKey: ['command-detail', selectedGuild?.id, commandName, days],
    enabled: enabled && !!selectedGuild?.id && !!commandName,
    queryFn: async () => {
      if (!selectedGuild?.id || !commandName) {
        return { events: [], daily: [], audit: [] };
      }

      const [eventsResult, dailyResult, auditResult] = await Promise.all([
        supabase
          .from('command_execution_events')
          .select('id, command_name, user_id, channel_id, source, status, latency_ms, blocked_reason, error_message, created_at')
          .eq('guild_id', selectedGuild.id)
          .eq('command_name', commandName)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('command_execution_daily_stats')
          .select('day, executions, successes, errors, blocked, avg_latency_ms, max_latency_ms, last_used_at')
          .eq('guild_id', selectedGuild.id)
          .eq('command_name', commandName)
          .gte('day', sinceDay)
          .order('day', { ascending: true }),
        supabase
          .from('dashboard_audit_log')
          .select('id, action, user_email, details, created_at')
          .eq('guild_id', selectedGuild.id)
          .eq('target_type', 'command')
          .eq('target_id', commandName)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (dailyResult.error) throw dailyResult.error;
      if (auditResult.error) throw auditResult.error;

      return {
        events: (eventsResult.data ?? []) as CommandExecutionEvent[],
        daily: dailyResult.data ?? [],
        audit: (auditResult.data ?? []) as CommandAuditEvent[],
      };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const derived = useMemo(() => {
    const events = query.data?.events ?? [];
    const daily = query.data?.daily ?? [];
    const audit = query.data?.audit ?? [];

    let successes = 0;
    let errors = 0;
    let blocked = 0;
    let handledLatency = 0;
    let handledCount = 0;

    for (const row of daily) {
      const rowSuccesses = Number(row.successes ?? 0);
      const rowErrors = Number(row.errors ?? 0);
      const rowBlocked = Number(row.blocked ?? 0);
      const rowHandled = rowSuccesses + rowErrors;

      successes += rowSuccesses;
      errors += rowErrors;
      blocked += rowBlocked;
      handledCount += rowHandled;
      handledLatency += Number(row.avg_latency_ms ?? 0) * rowHandled;
    }

    const channelCounts = new Map<string, number>();
    const userCounts = new Map<string, number>();
    const blockedCounts = new Map<string, number>();

    for (const event of events) {
      if (event.channel_id) channelCounts.set(event.channel_id, (channelCounts.get(event.channel_id) || 0) + 1);
      if (event.user_id) userCounts.set(event.user_id, (userCounts.get(event.user_id) || 0) + 1);
      if (event.blocked_reason) blockedCounts.set(event.blocked_reason, (blockedCounts.get(event.blocked_reason) || 0) + 1);
    }

    const top = (map: Map<string, number>, limit = 6) =>
      [...map.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const latencies = events
      .filter((event) => event.status === 'success' || event.status === 'error')
      .map((event) => Number(event.latency_ms || 0))
      .sort((a, b) => a - b);

    const p95Index = latencies.length ? Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1) : 0;

    return {
      events,
      daily,
      audit,
      recentErrors: events.filter((event) => event.status === 'error').slice(0, 25),
      recentBlocked: events.filter((event) => event.status === 'blocked').slice(0, 25),
      topChannels: top(channelCounts),
      topUsers: top(userCounts),
      blockedReasons: top(blockedCounts),
      summary: {
        executions: successes + errors,
        successes,
        errors,
        blocked,
        successRate: handledCount > 0 ? Math.round((successes / handledCount) * 1000) / 10 : 0,
        avgLatency: handledCount > 0 ? Math.round(handledLatency / handledCount) : 0,
        p95Latency: latencies.length ? latencies[p95Index] : 0,
      },
    };
  }, [query.data]);

  return {
    ...derived,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
