import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface ApplicationSettings {
  id: string;
  guild_id: string;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  log_channel_id: string | null;
  dm_on_submit: boolean;
  dm_on_approval: boolean;
  dm_on_denial: boolean;
  approval_message: string | null;
  denial_message: string | null;
  panel_type: 'buttons' | 'dropdown';
  created_at: string;
  updated_at: string;
}

export function useApplicationSettings() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('application_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as ApplicationSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpsertApplicationSettings() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<ApplicationSettings, 'id' | 'guild_id' | 'created_at' | 'updated_at'>>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('application_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('application_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('application_settings')
          .insert({
            ...settings,
            guild_id: selectedGuild.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-settings', selectedGuild?.id] });
      toast.success('Settings saved');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });
}
