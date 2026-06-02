import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export type ModerationActionType = 'ban' | 'kick' | 'mute' | 'warn' | 'delete' | 'timeout' | 'unban' | 'unmute';

export interface ModerationLog {
  id: string;
  guild_id: string;
  action_type: ModerationActionType;
  moderator_id: string;
  moderator_name: string | null;
  target_id: string;
  target_name: string | null;
  reason: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface UseModerationLogsOptions {
  limit?: number;
  actionType?: ModerationActionType;
}

const POLL_INTERVAL = 30000; // 30 seconds

export function useModerationLogs(options: UseModerationLogsOptions = {}) {
  const { selectedGuild } = useGuild();
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const { limit = 50, actionType } = options;

  const fetchLogs = useCallback(async () => {
    if (!selectedGuild) return;

    let query = supabase
      .from('moderation_logs')
      .select('*', { count: 'exact' })
      .eq('guild_id', selectedGuild.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Error fetching moderation logs:', fetchError);
      setError(fetchError.message);
    } else {
      setLogs(data as ModerationLog[] || []);
      setTotalCount(count || 0);
      setError(null);
    }
    setLoading(false);
  }, [selectedGuild, limit, actionType]);

  useEffect(() => {
    if (!selectedGuild) {
      setLogs([]);
      setLoading(false);
      return;
    }

    // Initial fetch
    setLoading(true);
    fetchLogs();

    // Set up polling interval as backup
    const pollInterval = setInterval(fetchLogs, POLL_INTERVAL);

    // Subscribe to realtime updates for new logs
    const channel = supabase
      .channel(`moderation_logs_${selectedGuild.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moderation_logs',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        (payload) => {
          console.log('New moderation log:', payload);
          setLogs((prev) => [payload.new as ModerationLog, ...prev].slice(0, limit));
          setTotalCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedGuild, limit, actionType, fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    refetch: fetchLogs,
  };
}
