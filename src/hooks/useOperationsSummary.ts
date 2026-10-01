import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export function useOperationsSummary() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['operations-summary', selectedGuild?.id],
    enabled: !!selectedGuild?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!selectedGuild?.id) {
        return {
          openCases: 0,
          pendingAppeals: 0,
          openAlerts: 0,
          overdueSla: 0,
          commandIssues: 0,
          scheduledModeration: 0,
        };
      }

      const guildId = selectedGuild.id;
      const now = new Date().toISOString();

      const [
        casesResult,
        appealsResult,
        alertsResult,
        ticketsResult,
        healthResult,
        scheduledResult,
      ] = await Promise.all([
        supabase
          .from('moderation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .in('status', ['open', 'investigating', 'appealed']),
        supabase
          .from('moderation_appeals')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .in('status', ['pending', 'needs_info']),
        supabase
          .from('dashboard_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .neq('status', 'resolved'),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .is('closed_at', null)
          .not('sla_due_at', 'is', null)
          .lt('sla_due_at', now),
        supabase
          .from('command_health_7d')
          .select('command_name, executions, error_rate, avg_latency_ms')
          .eq('guild_id', guildId),
        supabase
          .from('moderation_scheduled_actions')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .in('status', ['pending', 'executing']),
      ]);

      const errors = [
        casesResult.error,
        appealsResult.error,
        alertsResult.error,
        ticketsResult.error,
        healthResult.error,
        scheduledResult.error,
      ].filter(Boolean);

      if (errors.length) throw errors[0];

      const commandIssues = (healthResult.data ?? []).filter((item) =>
        Number(item.executions ?? 0) >= 3 &&
        (Number(item.error_rate ?? 0) >= 20 || Number(item.avg_latency_ms ?? 0) >= 5000),
      ).length;

      return {
        openCases: casesResult.count ?? 0,
        pendingAppeals: appealsResult.count ?? 0,
        openAlerts: alertsResult.count ?? 0,
        overdueSla: ticketsResult.count ?? 0,
        commandIssues,
        scheduledModeration: scheduledResult.count ?? 0,
      };
    },
  });
}
