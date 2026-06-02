import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledAction {
  id: string;
  guild_id: string;
  action_type: string;
  target_discord_id: string;
  target_name: string | null;
  execute_at: string;
  executed: boolean;
  executed_at: string | null;
  reason: string | null;
  role_id: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateScheduledAction {
  action_type: string;
  target_discord_id: string;
  target_name?: string;
  execute_at: string;
  reason?: string;
  role_id?: string;
  created_by: string;
}

export function useScheduledActions() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const actionsQuery = useQuery({
    queryKey: ['scheduled-actions', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('scheduled_actions')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('execute_at', { ascending: true });

      if (error) throw error;
      return data as ScheduledAction[];
    },
    enabled: !!selectedGuild?.id,
  });

  const pendingActions = actionsQuery.data?.filter((a) => !a.executed) ?? [];
  const executedActions = actionsQuery.data?.filter((a) => a.executed) ?? [];

  const createAction = useMutation({
    mutationFn: async (action: CreateScheduledAction) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('scheduled_actions')
        .insert({
          guild_id: selectedGuild.id,
          ...action,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions', selectedGuild?.id] });
      toast({ title: 'Handling planlagt' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_actions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-actions', selectedGuild?.id] });
      toast({ title: 'Handling slettet' });
    },
  });

  return {
    actions: actionsQuery.data ?? [],
    pendingActions,
    executedActions,
    isLoading: actionsQuery.isLoading,
    createAction,
    deleteAction,
  };
}
