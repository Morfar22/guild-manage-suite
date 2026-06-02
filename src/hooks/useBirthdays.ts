import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useBirthdays() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id;

  const settingsQuery = useQuery({
    queryKey: ['birthday-settings', guildId],
    queryFn: async () => {
      if (!guildId) return null;
      const { data, error } = await supabase
        .from('birthday_settings').select('*').eq('guild_id', guildId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const birthdaysQuery = useQuery({
    queryKey: ['birthdays', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('birthdays').select('*').eq('guild_id', guildId)
        .order('birthday_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      if (!guildId) throw new Error('No guild');
      const { error } = await supabase
        .from('birthday_settings').upsert({ guild_id: guildId, ...settings }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['birthday-settings', guildId] }); toast.success('Indstillinger gemt'); },
    onError: () => toast.error('Kunne ikke gemme'),
  });

  const deleteBirthday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('birthdays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['birthdays', guildId] }); toast.success('Fødselsdag slettet'); },
  });

  return { settings: settingsQuery.data, birthdays: birthdaysQuery.data || [], isLoading: settingsQuery.isLoading, upsertSettings, deleteBirthday };
}
