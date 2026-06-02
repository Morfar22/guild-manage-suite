import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface JTCSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  trigger_channel_id: string | null;
  category_id: string | null;
  default_user_limit: number;
  channel_name_template: string;
  created_at: string;
  updated_at: string;
}

export interface JTCChannel {
  id: string;
  guild_id: string;
  channel_id: string;
  owner_id: string;
  owner_name: string | null;
  created_at: string;
  // Extended info from Discord API
  channel_name?: string;
  member_count?: number;
}

export function useJTCSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['jtc-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      
      const { data, error } = await supabase
        .from('jtc_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as JTCSettings | null;
    },
    enabled: !!selectedGuild?.id
  });

  const { data: activeChannels = [], refetch: refetchChannels, isRefetching: isRefetchingChannels } = useQuery({
    queryKey: ['jtc-channels', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      
      // Call the edge function to get enriched channel data
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jtc-handler`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_active_channels',
            guildId: selectedGuild.id
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch active channels');
      }

      const data = await response.json();
      return data.channels as JTCChannel[];
    },
    enabled: !!selectedGuild?.id
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<JTCSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      if (settings) {
        const { error } = await supabase
          .from('jtc_settings')
          .update(newSettings)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jtc_settings')
          .insert({ ...newSettings, guild_id: selectedGuild.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jtc-settings', selectedGuild?.id] });
      toast.success('JTC settings saved!');
    },
    onError: (error) => {
      console.error('Error saving JTC settings:', error);
      toast.error('Could not save settings');
    }
  });

  const deleteChannel = useMutation({
    mutationFn: async (channelId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jtc-handler`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'force_delete_channel',
            guildId: selectedGuild.id,
            channelId
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete channel');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jtc-channels', selectedGuild?.id] });
      toast.success('Channel deleted!');
    },
    onError: (error) => {
      console.error('Error deleting channel:', error);
      toast.error('Could not delete channel');
    }
  });

  return {
    settings,
    activeChannels,
    isLoading,
    updateSettings,
    deleteChannel,
    refetchChannels,
    isRefetchingChannels
  };
}
