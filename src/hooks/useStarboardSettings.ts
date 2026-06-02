import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface StarboardSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  channel_id: string | null;
  emoji: string;
  threshold: number;
  ignore_self_star: boolean;
  ignored_channels: string[];
  created_at: string;
  updated_at: string;
}

export interface StarboardEntry {
  id: string;
  guild_id: string;
  message_id: string;
  channel_id: string;
  author_id: string;
  author_name: string | null;
  content: string | null;
  attachments: any[];
  starboard_message_id: string | null;
  star_count: number;
  created_at: string;
}

export function useStarboardSettings() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['starboard-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('starboard_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as StarboardSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const entriesQuery = useQuery({
    queryKey: ['starboard-entries', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('starboard_entries')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('star_count', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as StarboardEntry[];
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<StarboardSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('starboard_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('starboard_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('starboard_settings')
          .insert({ guild_id: selectedGuild.id, ...settings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['starboard-settings', selectedGuild?.id] });
      toast({ title: 'Starboard-indstillinger gemt' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings: settingsQuery.data,
    entries: entriesQuery.data ?? [],
    isLoading: settingsQuery.isLoading,
    updateSettings,
  };
}
