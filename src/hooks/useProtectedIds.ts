import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProtectedDiscordId {
  id: string;
  discord_id: string;
  label: string | null;
  added_by: string | null;
  created_at: string;
}

export function useProtectedIds() {
  const queryClient = useQueryClient();

  const { data: protectedIds = [], isLoading } = useQuery({
    queryKey: ['protected-discord-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protected_discord_ids')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProtectedDiscordId[];
    },
  });

  const addProtectedId = useMutation({
    mutationFn: async ({ discord_id, label }: { discord_id: string; label?: string }) => {
      const { error } = await supabase
        .from('protected_discord_ids')
        .insert({ discord_id, label: label || null, added_by: 'admin' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protected-discord-ids'] });
      toast.success('Discord ID tilføjet til beskyttede IDs');
    },
    onError: (e: any) => {
      if (e.message?.includes('duplicate')) {
        toast.error('Dette Discord ID er allerede beskyttet');
      } else {
        toast.error('Kunne ikke tilføje ID');
      }
    },
  });

  const removeProtectedId = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('protected_discord_ids')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protected-discord-ids'] });
      toast.success('Discord ID fjernet fra beskyttede IDs');
    },
    onError: () => toast.error('Kunne ikke fjerne ID'),
  });

  return { protectedIds, isLoading, addProtectedId, removeProtectedId };
}
