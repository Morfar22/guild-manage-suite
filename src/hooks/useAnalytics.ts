import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface DailyStats {
  id: string;
  guild_id: string;
  date: string;
  messages: number;
  xp_gained: number;
  commands_used: number;
  members_joined: number;
  members_left: number;
  mod_actions: number;
  voice_minutes: number;
  active_users: number;
  created_at: string;
}

export interface AnalyticsSummary {
  total_messages: number;
  total_commands: number;
  total_xp: number;
  members_joined: number;
  members_left: number;
  mod_actions: number;
  avg_daily_messages: number;
  avg_active_users: number;
}

export function useAnalytics(days: number = 7) {
  const { selectedGuild } = useGuild();

  const statsQuery = useQuery({
    queryKey: ['analytics-stats', selectedGuild?.id, days],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('analytics_daily_stats')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data as DailyStats[];
    },
    enabled: !!selectedGuild?.id,
  });

  // Calculate summary
  const summary: AnalyticsSummary = statsQuery.data?.reduce(
    (acc, day) => ({
      total_messages: acc.total_messages + day.messages,
      total_commands: acc.total_commands + day.commands_used,
      total_xp: acc.total_xp + day.xp_gained,
      members_joined: acc.members_joined + day.members_joined,
      members_left: acc.members_left + day.members_left,
      mod_actions: acc.mod_actions + day.mod_actions,
      avg_daily_messages: 0,
      avg_active_users: 0,
    }),
    {
      total_messages: 0,
      total_commands: 0,
      total_xp: 0,
      members_joined: 0,
      members_left: 0,
      mod_actions: 0,
      avg_daily_messages: 0,
      avg_active_users: 0,
    }
  ) ?? {
    total_messages: 0,
    total_commands: 0,
    total_xp: 0,
    members_joined: 0,
    members_left: 0,
    mod_actions: 0,
    avg_daily_messages: 0,
    avg_active_users: 0,
  };

  const dataLength = statsQuery.data?.length || 1;
  summary.avg_daily_messages = Math.round(summary.total_messages / dataLength);
  summary.avg_active_users = Math.round(
    (statsQuery.data?.reduce((sum, d) => sum + d.active_users, 0) ?? 0) / dataLength
  );

  // Format data for charts
  const chartData = statsQuery.data?.map((day) => ({
    date: new Date(day.date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric' }),
    fullDate: day.date,
    messages: day.messages,
    commands: day.commands_used,
    xp: day.xp_gained,
    members_joined: day.members_joined,
    members_left: day.members_left,
    active_users: day.active_users,
    mod_actions: day.mod_actions,
  })) ?? [];

  return {
    stats: statsQuery.data ?? [],
    summary,
    chartData,
    isLoading: statsQuery.isLoading,
    hasData: (statsQuery.data?.length ?? 0) > 0,
  };
}
