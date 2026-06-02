import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface ModmailSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  category_id: string | null;
  staff_role_id: string | null;
  log_channel_id: string | null;
  welcome_message: string | null;
  close_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModmailThread {
  id: string;
  guild_id: string;
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  channel_id: string | null;
  status: 'open' | 'closed';
  claimed_by_id: string | null;
  claimed_by_name: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ModmailMessage {
  id: string;
  thread_id: string;
  author_type: 'user' | 'staff';
  author_id: string;
  author_name: string | null;
  content: string;
  attachments: any[];
  created_at: string;
}

export function useModmail() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['modmail-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('modmail_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as ModmailSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const threadsQuery = useQuery({
    queryKey: ['modmail-threads', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('modmail_threads')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ModmailThread[];
    },
    enabled: !!selectedGuild?.id,
  });

  const openThreads = threadsQuery.data?.filter((t) => t.status === 'open') ?? [];
  const closedThreads = threadsQuery.data?.filter((t) => t.status === 'closed') ?? [];

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<ModmailSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('modmail_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('modmail_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('modmail_settings')
          .insert({ guild_id: selectedGuild.id, ...settings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modmail-settings', selectedGuild?.id] });
      toast({ title: 'Modmail-indstillinger gemt' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const getThreadMessages = async (threadId: string): Promise<ModmailMessage[]> => {
    const { data, error } = await supabase
      .from('modmail_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as ModmailMessage[];
  };

  // Stats
  const stats = {
    totalThreads: threadsQuery.data?.length ?? 0,
    openThreads: openThreads.length,
    closedThreads: closedThreads.length,
    avgResponseTime: 0, // Would need message timestamps to calculate
  };

  return {
    settings: settingsQuery.data,
    threads: threadsQuery.data ?? [],
    openThreads,
    closedThreads,
    stats,
    isLoading: settingsQuery.isLoading || threadsQuery.isLoading,
    updateSettings,
    getThreadMessages,
  };
}
