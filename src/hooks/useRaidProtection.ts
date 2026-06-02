import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useRaidProtection() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const key = ['raid-protection', selectedGuild?.id];

  const settings = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data } = await supabase
        .from('raid_protection_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedGuild?.id,
  });

  const logs = useQuery({
    queryKey: ['raid-logs', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data } = await supabase
        .from('raid_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
  });

  const upsert = useMutation({
    mutationFn: async (values: any) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('raid_protection_settings')
        .upsert({ ...values, guild_id: selectedGuild.id, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Raid protection gemt'); },
    onError: (e) => toast.error(e.message),
  });

  return { settings: settings.data, logs: logs.data ?? [], isLoading: settings.isLoading, upsert };
}
