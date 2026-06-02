import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface VerificationSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  channel_id: string | null;
  role_id: string | null;
  method: string;
  welcome_message: string;
  rate_limit_per_minute: number;
}

export interface VerificationLog {
  id: string;
  guild_id: string;
  user_id: string;
  user_name: string | null;
  method: string | null;
  success: boolean;
  created_at: string;
}

export function useVerificationSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['verification-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await supabase
        .from('verification_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as VerificationSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const logsQuery = useQuery({
    queryKey: ['verification-logs', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('verification_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as VerificationLog[];
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<VerificationSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { data: existing } = await supabase
        .from('verification_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('verification_settings')
          .update(settings as any)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('verification_settings')
          .insert({ guild_id: selectedGuild.id, ...settings } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-settings'] });
      toast.success('Verification-indstillinger gemt!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    logs: logsQuery.data || [],
    logsLoading: logsQuery.isLoading,
    updateSettings,
  };
}
