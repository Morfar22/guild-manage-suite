import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface CommandAnalyticsRow {
  command_name: string;
  executions: number;
  successes: number;
  errors: number;
  blocked: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  last_used_at: string | null;
  success_rate: number;
}

export function useCommandAnalytics(days: number) {
  const { selectedGuild } = useGuild();

  const since = useMemo(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1));
    return date.toISOString().slice(0, 10);
  }, [days]);

  const query = useQuery({
    queryKey: ['command-analytics', selectedGuild?.id, days],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('command_execution_daily_stats')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .gte('day', since)
        .order('day', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const derived = useMemo(() => {
    const byCommand = new Map<string, {
      executions: number;
      successes: number;
      errors: number;
      blocked: number;
      weightedLatency: number;
      handled: number;
      maxLatency: number;
      lastUsedAt: string | null;
    }>();

    const byDay = new Map<string, {
      day: string;
      executions: number;
      successes: number;
      errors: number;
      blocked: number;
    }>();

    for (const row of query.data ?? []) {
      if (!row.command_name || !row.day) continue;

      const successes = Number(row.successes ?? 0);
      const errors = Number(row.errors ?? 0);
      const blocked = Number(row.blocked ?? 0);
      const handled = successes + errors;
      const executions = handled;
      const avgLatency = Number(row.avg_latency_ms ?? 0);

      const current = byCommand.get(row.command_name) ?? {
        executions: 0,
        successes: 0,
        errors: 0,
        blocked: 0,
        weightedLatency: 0,
        handled: 0,
        maxLatency: 0,
        lastUsedAt: null,
      };

      current.executions += executions;
      current.successes += successes;
      current.errors += errors;
      current.blocked += blocked;
      current.weightedLatency += avgLatency * handled;
      current.handled += handled;
      current.maxLatency = Math.max(current.maxLatency, Number(row.max_latency_ms ?? 0));
      if (row.last_used_at && (!current.lastUsedAt || row.last_used_at > current.lastUsedAt)) {
        current.lastUsedAt = row.last_used_at;
      }
      byCommand.set(row.command_name, current);

      const daily = byDay.get(row.day) ?? {
        day: row.day,
        executions: 0,
        successes: 0,
        errors: 0,
        blocked: 0,
      };
      daily.executions += executions;
      daily.successes += successes;
      daily.errors += errors;
      daily.blocked += blocked;
      byDay.set(row.day, daily);
    }

    const commands: CommandAnalyticsRow[] = [...byCommand.entries()]
      .map(([command_name, value]) => ({
        command_name,
        executions: value.executions,
        successes: value.successes,
        errors: value.errors,
        blocked: value.blocked,
        avg_latency_ms: value.handled > 0 ? Math.round(value.weightedLatency / value.handled) : 0,
        max_latency_ms: value.maxLatency,
        last_used_at: value.lastUsedAt,
        success_rate: value.handled > 0 ? Math.round((value.successes / value.handled) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.executions - a.executions);

    const timeline = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

    const summary = commands.reduce(
      (acc, command) => {
        acc.executions += command.executions;
        acc.successes += command.successes;
        acc.errors += command.errors;
        acc.blocked += command.blocked;
        acc.weightedLatency += command.avg_latency_ms * (command.successes + command.errors);
        acc.handled += command.successes + command.errors;
        return acc;
      },
      { executions: 0, successes: 0, errors: 0, blocked: 0, weightedLatency: 0, handled: 0 }
    );

    return {
      commands,
      timeline,
      summary: {
        executions: summary.executions,
        successes: summary.successes,
        errors: summary.errors,
        blocked: summary.blocked,
        avg_latency_ms: summary.handled > 0 ? Math.round(summary.weightedLatency / summary.handled) : 0,
        success_rate: summary.handled > 0 ? Math.round((summary.successes / summary.handled) * 1000) / 10 : 0,
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
