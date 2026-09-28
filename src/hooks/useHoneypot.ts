import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface HoneypotSettings {
  enabled: boolean;
  channel_id: string | null;
  warning_message: string | null;
  action: 'none' | 'kick' | 'ban';
  delete_message: boolean;
  report_global_ban: boolean;
  report_severity: string;
  log_channel_id: string | null;
  ignore_roles: string[];
}

export function useHoneypot() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const settingsKey = ['honeypot-settings', selectedGuild?.id];
  const catchesKey = ['honeypot-catches', selectedGuild?.id];

  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await supabase
        .from('honeypot_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGuild?.id,
  });

  const catches = useQuery({
    queryKey: catchesKey,
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('honeypot_catches')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 30_000,
  });

  const upsertSettings = useMutation({
    mutationFn: async (values: HoneypotSettings) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('honeypot_settings')
        .upsert({ ...values, guild_id: selectedGuild.id }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: settingsKey }); toast.success('Honeypot-indstillinger gemt'); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('honeypot_catches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: catchesKey }),
    onError: (e) => toast.error(e.message),
  });

  return {
    settings: settings.data,
    catches: catches.data ?? [],
    isLoading: settings.isLoading,
    upsertSettings,
    deleteCatch,
  };
}
