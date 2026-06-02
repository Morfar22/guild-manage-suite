import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';

export interface TwitchNotificationLog {
  id: string;
  guild_id: string;
  streamer_id: string;
  event_type: 'live' | 'offline';
  stream_title: string | null;
  game_name: string | null;
  viewer_count: number | null;
  thumbnail_url: string | null;
  channel_id: string;
  message_id: string | null;
  sent_at: string;
  created_at: string;
  // Joined from twitch_streamers
  streamer_name?: string;
  streamer_avatar?: string;
}

export function useTwitchNotificationLogs() {
  const { selectedGuild } = useGuild();
  const [logs, setLogs] = useState<TwitchNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!selectedGuild?.id) return;

    try {
      // Fetch logs with streamer info
      const { data, error } = await supabase
        .from('twitch_notification_logs')
        .select(`
          *,
          twitch_streamers (
            display_name,
            profile_image_url
          )
        `)
        .eq('guild_id', selectedGuild.id)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedLogs = (data || []).map((log: any) => ({
        ...log,
        streamer_name: log.twitch_streamers?.display_name,
        streamer_avatar: log.twitch_streamers?.profile_image_url,
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Error fetching notification logs:', error);
    }
  }, [selectedGuild?.id]);

  useEffect(() => {
    if (!selectedGuild?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchLogs().finally(() => setLoading(false));

    // Subscribe to realtime
    const channel = supabase
      .channel(`twitch-logs-${selectedGuild.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'twitch_notification_logs',
        filter: `guild_id=eq.${selectedGuild.id}`,
      }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, fetchLogs]);

  return {
    logs,
    loading,
    refetch: fetchLogs,
  };
}
