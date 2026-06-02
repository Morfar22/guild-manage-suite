import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useConfessions() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id;

  const settingsQuery = useQuery({
    queryKey: ['confession-settings', guildId],
    queryFn: async () => {
      if (!guildId) return null;
      const { data, error } = await supabase
        .from('confession_settings').select('*').eq('guild_id', guildId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const confessionsQuery = useQuery({
    queryKey: ['confessions', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('confessions').select('*').eq('guild_id', guildId)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      if (!guildId) throw new Error('No guild');
      const { error } = await supabase
        .from('confession_settings').upsert({ guild_id: guildId, ...settings }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['confession-settings', guildId] }); toast.success('Indstillinger gemt'); },
    onError: () => toast.error('Kunne ikke gemme'),
  });

  return { settings: settingsQuery.data, confessions: confessionsQuery.data || [], isLoading: settingsQuery.isLoading, upsertSettings };
}
