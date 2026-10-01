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

export interface ModerationScheduledAction {
  id: string;
  guild_id: string;
  discord_guild_id: string;
  action_type: 'unban' | 'remove_role';
  target_id: string;
  target_name: string | null;
  role_id: string | null;
  reason: string | null;
  execute_at: string;
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'cancelled';
  created_by_id: string;
  created_by_name: string | null;
  metadata: unknown;
  last_error: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
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

  const moderationQuery = useQuery({
    queryKey: ['moderation-scheduled-actions', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('moderation_scheduled_actions')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('execute_at', { ascending: true });

      if (error) throw error;
      return data as ModerationScheduledAction[];
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15_000,
  });

  const pendingActions = actionsQuery.data?.filter((a) => !a.executed) ?? [];
  const executedActions = actionsQuery.data?.filter((a) => a.executed) ?? [];
  const pendingModerationActions = moderationQuery.data?.filter((a) => ['pending', 'executing'].includes(a.status)) ?? [];
  const moderationHistory = moderationQuery.data?.filter((a) => ['executed', 'failed', 'cancelled'].includes(a.status)) ?? [];

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

  const cancelModerationAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('moderation_scheduled_actions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-scheduled-actions', selectedGuild?.id] });
      toast({ title: 'Planlagt moderation annulleret' });
    },
  });

  const executeModerationNow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('moderation_scheduled_actions')
        .update({
          execute_at: new Date().toISOString(),
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .in('status', ['pending', 'failed']);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-scheduled-actions', selectedGuild?.id] });
      toast({ title: 'Handling sat til udførelse nu' });
    },
  });

  const rescheduleModerationAction = useMutation({
    mutationFn: async ({ id, executeAt }: { id: string; executeAt: string }) => {
      const { error } = await supabase
        .from('moderation_scheduled_actions')
        .update({
          execute_at: executeAt,
          status: 'pending',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-scheduled-actions', selectedGuild?.id] });
      toast({ title: 'Handling flyttet' });
    },
  });

  return {
    actions: actionsQuery.data ?? [],
    pendingActions,
    executedActions,
    moderationActions: moderationQuery.data ?? [],
    pendingModerationActions,
    moderationHistory,
    isLoading: actionsQuery.isLoading || moderationQuery.isLoading,
    createAction,
    deleteAction,
    cancelModerationAction,
    executeModerationNow,
    rescheduleModerationAction,
  };
}
