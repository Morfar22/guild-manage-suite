import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface WelcomeSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  welcome_channel_id: string | null;
  welcome_message: string;
  leave_channel_id: string | null;
  leave_message: string;
  leave_enabled: boolean;
  dm_enabled: boolean;
  dm_message: string;
  auto_role_id: string | null;
  auto_role_ids: string[];
  auto_role_enabled: boolean;
  embed_enabled: boolean;
  embed_color: string;
  embed_title: string;
  embed_footer: string;
  embed_image_url: string;
  leave_embed_enabled: boolean;
  thumbnail_type: 'user_avatar' | 'server_icon';
  created_at: string;
  updated_at: string;
}

export function useWelcomeSettings() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['welcome-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('welcome_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as WelcomeSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpdateWelcomeSettings() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (settings: Partial<WelcomeSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('welcome_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('welcome_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();

        if (error) throw error;
        return data as WelcomeSettings;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('welcome_settings')
          .insert({ ...settings, guild_id: selectedGuild.id })
          .select()
          .single();

        if (error) throw error;
        return data as WelcomeSettings;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-settings', selectedGuild?.id] });
    },
  });
}
