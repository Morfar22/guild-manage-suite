import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useQuarantine() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const settingsKey = ['quarantine-settings', selectedGuild?.id];
  const entriesKey = ['quarantine-entries', selectedGuild?.id];

  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data } = await supabase
        .from('quarantine_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedGuild?.id,
  });

  const entries = useQuery({
    queryKey: entriesKey,
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data } = await supabase
        .from('quarantine_entries')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('quarantined_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (values: any) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('quarantine_settings')
        .upsert({ ...values, guild_id: selectedGuild.id, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: settingsKey }); toast.success('Quarantine indstillinger gemt'); },
    onError: (e) => toast.error(e.message),
  });

  const releaseUser = useMutation({
    mutationFn: async ({ id, releasedBy }: { id: string; releasedBy: string }) => {
      const { error } = await supabase
        .from('quarantine_entries')
        .update({ released_at: new Date().toISOString(), released_by: releasedBy })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: entriesKey }); toast.success('Bruger frigivet fra karantæne'); },
    onError: (e) => toast.error(e.message),
  });

  return {
    settings: settings.data,
    entries: entries.data ?? [],
    isLoading: settings.isLoading,
    upsertSettings,
    releaseUser,
  };
}
