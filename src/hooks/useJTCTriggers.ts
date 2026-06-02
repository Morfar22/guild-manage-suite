import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface JTCTrigger {
  id: string;
  guild_id: string;
  name: string;
  trigger_channel_id: string;
  category_id: string | null;
  channel_name_template: string;
  default_user_limit: number;
  required_role_id: string | null;
  required_role_name: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateJTCTriggerInput {
  name: string;
  trigger_channel_id: string;
  category_id?: string | null;
  channel_name_template?: string;
  default_user_limit?: number;
  required_role_id?: string | null;
  required_role_name?: string | null;
  enabled?: boolean;
}

export interface UpdateJTCTriggerInput extends Partial<CreateJTCTriggerInput> {
  id: string;
}

export function useJTCTriggers() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ['jtc-triggers', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      
      const { data, error } = await supabase
        .from('jtc_triggers')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as JTCTrigger[];
    },
    enabled: !!selectedGuild?.id
  });

  const createTrigger = useMutation({
    mutationFn: async (input: CreateJTCTriggerInput) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('jtc_triggers')
        .insert({
          guild_id: selectedGuild.id,
          name: input.name,
          trigger_channel_id: input.trigger_channel_id,
          category_id: input.category_id || null,
          channel_name_template: input.channel_name_template || '{username}s kanal',
          default_user_limit: input.default_user_limit || 0,
          required_role_id: input.required_role_id || null,
          required_role_name: input.required_role_name || null,
          enabled: input.enabled ?? true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jtc-triggers', selectedGuild?.id] });
      toast.success('JTC trigger oprettet!');
    },
    onError: (error) => {
      console.error('Error creating JTC trigger:', error);
      toast.error('Kunne ikke oprette trigger');
    }
  });

  const updateTrigger = useMutation({
    mutationFn: async (input: UpdateJTCTriggerInput) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { id, ...updateData } = input;
      const { error } = await supabase
        .from('jtc_triggers')
        .update(updateData)
        .eq('id', id)
        .eq('guild_id', selectedGuild.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jtc-triggers', selectedGuild?.id] });
      toast.success('JTC trigger opdateret!');
    },
    onError: (error) => {
      console.error('Error updating JTC trigger:', error);
      toast.error('Kunne ikke opdatere trigger');
    }
  });

  const deleteTrigger = useMutation({
    mutationFn: async (triggerId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('jtc_triggers')
        .delete()
        .eq('id', triggerId)
        .eq('guild_id', selectedGuild.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jtc-triggers', selectedGuild?.id] });
      toast.success('JTC trigger slettet!');
    },
    onError: (error) => {
      console.error('Error deleting JTC trigger:', error);
      toast.error('Kunne ikke slette trigger');
    }
  });

  return {
    triggers,
    isLoading,
    createTrigger,
    updateTrigger,
    deleteTrigger
  };
}
