import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useSlowmodeSchedules() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const key = ['slowmode-schedules', selectedGuild?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data } = await supabase
        .from('slowmode_schedules')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
  });

  const create = useMutation({
    mutationFn: async (values: any) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('slowmode_schedules')
        .insert([{ ...values, guild_id: selectedGuild.id }] as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Slowmode regel oprettet'); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('slowmode_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Slettet'); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('slowmode_schedules').update({ enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { schedules: query.data ?? [], isLoading: query.isLoading, create, remove, toggle };
}
