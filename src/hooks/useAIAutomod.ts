import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface AIAutomodSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  sensitivity: number;
  check_toxicity: boolean;
  check_spam: boolean;
  check_nsfw: boolean;
  check_hate_speech: boolean;
  custom_instructions: string | null;
  log_channel_id: string | null;
  action: string;
  notify_moderators: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIAutomodSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-automod-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await supabase
        .from('ai_automod_settings' as any)
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AIAutomodSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const upsert = useMutation({
    mutationFn: async (settings: Partial<AIAutomodSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { error } = await supabase
        .from('ai_automod_settings' as any)
        .upsert({
          guild_id: selectedGuild.id,
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automod-settings'] });
      toast.success('AI Auto-Mod indstillinger gemt');
    },
    onError: (err: any) => {
      toast.error('Fejl ved gemning: ' + err.message);
    },
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}
