import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface RealtimeEvent {
  id: string;
  guild_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  user_id: string | null;
  user_name: string | null;
  channel_id: string | null;
  channel_name: string | null;
  created_at: string;
}

export function useRealtimeEvents(limit = 50) {
  const { selectedGuild } = useGuild();
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);

  // Fetch initial events
  const query = useQuery({
    queryKey: ['realtime-events', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('realtime_events')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as RealtimeEvent[]) ?? [];
    },
    enabled: !!selectedGuild?.id,
  });

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!selectedGuild?.id) return;

    const channel = supabase
      .channel(`realtime-events-${selectedGuild.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'realtime_events',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        (payload) => {
          const newEvent = payload.new as RealtimeEvent;
          setLiveEvents((prev) => [newEvent, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, limit]);

  // Merge: live events first, then historical (dedup by id)
  const allEvents = (() => {
    const historical = query.data ?? [];
    const seen = new Set<string>();
    const merged: RealtimeEvent[] = [];
    for (const e of [...liveEvents, ...historical]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }
    return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
  })();

  return {
    events: allEvents,
    isLoading: query.isLoading,
  };
}
