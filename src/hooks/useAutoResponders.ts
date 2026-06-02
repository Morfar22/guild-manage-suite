import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface AutoResponder {
  id: string;
  guild_id: string;
  trigger_text: string;
  trigger_type: string;
  response_content: string;
  response_type: string;
  enabled: boolean;
  cooldown_seconds: number;
  use_ai: boolean;
  ai_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAutoResponder {
  trigger_text: string;
  trigger_type?: string;
  response_content: string;
  response_type?: string;
  cooldown_seconds?: number;
  use_ai?: boolean;
  ai_instructions?: string;
}

export function useAutoResponders() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const respondersQuery = useQuery({
    queryKey: ['auto-responders', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('auto_responders')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AutoResponder[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createResponder = useMutation({
    mutationFn: async (responder: CreateAutoResponder) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('auto_responders')
        .insert({
          guild_id: selectedGuild.id,
          ...responder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responders', selectedGuild?.id] });
      toast({ title: 'Auto-responder oprettet' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const updateResponder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutoResponder> & { id: string }) => {
      const { error } = await supabase
        .from('auto_responders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responders', selectedGuild?.id] });
      toast({ title: 'Auto-responder opdateret' });
    },
  });

  const deleteResponder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('auto_responders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responders', selectedGuild?.id] });
      toast({ title: 'Auto-responder slettet' });
    },
  });

  return {
    responders: respondersQuery.data ?? [],
    isLoading: respondersQuery.isLoading,
    createResponder,
    updateResponder,
    deleteResponder,
  };
}
