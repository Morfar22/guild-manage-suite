import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledMessage {
  id: string;
  guild_id: string;
  channel_id: string;
  content: string | null;
  embed: Record<string, any> | null;
  scheduled_at: string;
  repeat_interval: 'daily' | 'weekly' | 'monthly' | null;
  created_by_id: string;
  created_by_name: string | null;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledMessage {
  channel_id: string;
  content?: string;
  embed?: Record<string, any>;
  scheduled_at: string;
  repeat_interval?: 'daily' | 'weekly' | 'monthly' | null;
  created_by_id: string;
  created_by_name?: string;
}

export function useScheduledMessages() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['scheduled-messages', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data as ScheduledMessage[];
    },
    enabled: !!selectedGuild?.id,
  });

  const upcomingMessages = messagesQuery.data?.filter((m) => !m.sent) ?? [];
  const sentMessages = messagesQuery.data?.filter((m) => m.sent) ?? [];

  const createMessage = useMutation({
    mutationFn: async (message: CreateScheduledMessage) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          guild_id: selectedGuild.id,
          ...message,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', selectedGuild?.id] });
      toast({ title: 'Besked planlagt' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledMessage> & { id: string }) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', selectedGuild?.id] });
      toast({ title: 'Besked opdateret' });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', selectedGuild?.id] });
      toast({ title: 'Besked slettet' });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    upcomingMessages,
    sentMessages,
    isLoading: messagesQuery.isLoading,
    createMessage,
    updateMessage,
    deleteMessage,
  };
}
