import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface FiveMServerStatus {
  id: string;
  guild_id: string;
  server_id: string;
  server_name: string | null;
  max_players: number;
  player_count: number;
  uptime_seconds: number;
  server_started_at: string | null;
  last_heartbeat: string | null;
  game_type: string;
  map_name: string | null;
  resources_count: number;
  txadmin_version: string | null;
  fxserver_version: string | null;
  server_ip: string | null;
  server_port: number;
  is_online: boolean;
  metadata: Record<string, unknown>;
}

export function useFiveMServerStatus() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['fivem-server-status', selectedGuild?.id],
    enabled: !!selectedGuild?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fivem_server_status')
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as FiveMServerStatus | null;
    },
    refetchInterval: 30000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedGuild?.id) return;

    const channel = supabase
      .channel('fivem-server-status-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fivem_server_status',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fivem-server-status', selectedGuild.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, queryClient]);

  // Compute if server is actually online (heartbeat within last 2 minutes)
  const isActuallyOnline = query.data?.is_online && 
    query.data?.last_heartbeat && 
    (new Date().getTime() - new Date(query.data.last_heartbeat).getTime()) < 120000;

  return {
    ...query,
    isActuallyOnline,
  };
}
