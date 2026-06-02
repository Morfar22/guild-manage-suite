import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface StatsChannel {
  id: string;
  guild_id: string;
  channel_id: string | null;
  stat_type: string;
  format_template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useStatsChannels() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stats-channels', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('stats_channels')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StatsChannel[];
    },
    enabled: !!selectedGuild?.id,
  });

  const addChannel = useMutation({
    mutationFn: async (channel: Partial<StatsChannel>) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase.from('stats_channels').insert({
        guild_id: selectedGuild.id,
        ...channel,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats-channels'] });
      toast.success('Stat-kanal tilføjet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StatsChannel> & { id: string }) => {
      const { error } = await supabase.from('stats_channels').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats-channels'] });
      toast.success('Stat-kanal opdateret!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stats_channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats-channels'] });
      toast.success('Stat-kanal slettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, channels: query.data || [], addChannel, updateChannel, deleteChannel };
}
