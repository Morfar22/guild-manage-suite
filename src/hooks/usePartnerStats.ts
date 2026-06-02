import { useEffect, useState, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyStat {
  id: string;
  guild_id: string;
  streamer_id: string;
  week_start: string;
  streams_count: number;
  minutes_streamed: number;
  quota_type: string;
  quota_streams_goal: number;
  quota_hours_goal: number;
  quota_met: boolean;
  created_at: string;
}

export function usePartnerStats(weeks = 8) {
  const { selectedGuild } = useGuild();
  const [stats, setStats] = useState<WeeklyStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!selectedGuild?.id) return;
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeks * 7);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('twitch_partner_weekly_stats' as any)
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .gte('week_start', cutoffStr)
        .order('week_start', { ascending: false });

      if (error) throw error;
      setStats((data as unknown as WeeklyStat[]) || []);
    } catch (e) {
      console.error('Error fetching partner stats:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedGuild?.id, weeks]);

  useEffect(() => {
    fetchStats();

    if (!selectedGuild?.id) return;
    const channel = supabase
      .channel(`partner-stats-${selectedGuild.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'twitch_partner_weekly_stats', filter: `guild_id=eq.${selectedGuild.id}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
