import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface XPMultiplier {
  id: string;
  guild_id: string;
  name: string;
  multiplier_type: 'role' | 'channel' | 'global';
  target_id: string | null;
  multiplier: number;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export function useXPMultipliers() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['xp-multipliers', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('xp_multipliers')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as XPMultiplier[];
    },
    enabled: !!selectedGuild?.id,
  });

  const addMultiplier = useMutation({
    mutationFn: async (data: {
      name: string;
      multiplier_type: 'role' | 'channel' | 'global';
      target_id?: string | null;
      multiplier: number;
      starts_at?: string | null;
      ends_at?: string | null;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: result, error } = await supabase
        .from('xp_multipliers')
        .insert({
          guild_id: selectedGuild.id,
          name: data.name,
          multiplier_type: data.multiplier_type,
          target_id: data.target_id || null,
          multiplier: data.multiplier,
          starts_at: data.starts_at || null,
          ends_at: data.ends_at || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-multipliers', selectedGuild?.id] });
      toast({ title: 'XP multiplier added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMultiplier = useMutation({
    mutationFn: async ({ id, ...data }: Partial<XPMultiplier> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('xp_multipliers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-multipliers', selectedGuild?.id] });
      toast({ title: 'XP multiplier updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMultiplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('xp_multipliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-multipliers', selectedGuild?.id] });
      toast({ title: 'XP multiplier deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, addMultiplier, updateMultiplier, deleteMultiplier };
}
