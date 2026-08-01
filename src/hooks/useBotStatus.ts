import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

interface BotStatus {
  id: string;
  guild_id: string;
  is_online: boolean;
  latency_ms: number | null;
  last_heartbeat: string | null;
  member_count: number | null;
  message_count_today: number | null;
}

const POLL_INTERVAL = 30000; // 30 seconds

export function useBotStatus() {
  const { selectedGuild } = useGuild();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!selectedGuild) return;

    const { data, error: fetchError } = await supabase
      .from('bot_status')
      .select('*')
      .eq('guild_id', selectedGuild.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching bot status:', fetchError);
      setError(fetchError.message);
    } else {
      setStatus(data);
      setError(null);
    }
    setLoading(false);
  }, [selectedGuild]);

  useEffect(() => {
    if (!selectedGuild) {
      setStatus(null);
      setLoading(false);
      return;
    }

    // Initial fetch
    setLoading(true);
    fetchStatus();

    // Set up polling interval as backup
    const pollInterval = setInterval(fetchStatus, POLL_INTERVAL);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`bot_status_${selectedGuild.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_status',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        (payload) => {
          console.log('Bot status update:', payload);
          if (payload.eventType === 'DELETE') {
            setStatus(null);
          } else {
            setStatus(payload.new as BotStatus);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedGuild, fetchStatus]);

  // Check if bot is considered online (heartbeat within last 2 minutes)
  const isOnline = status?.is_online && status?.last_heartbeat
    ? new Date(status.last_heartbeat).getTime() > Date.now() - 120000
    : false;

  return {
    status,
    isOnline,
    loading,
    error,
    refetch: fetchStatus,
  };
}
