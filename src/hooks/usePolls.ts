import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface PollOption {
  label: string;
  votes: number;
  voters: string[];
}

export interface PollVotes {
  allow_multiple?: boolean;
  created_by_name?: string;
}

export interface Poll {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  question: string;
  options: PollOption[];
  votes: PollVotes;
  created_by: string;
  ends_at: string | null;
  ended: boolean;
  created_at: string;
}

export interface CreatePoll {
  channel_id: string;
  question: string;
  options: PollOption[];
  created_by: string;
  created_by_name?: string;
  ends_at?: string;
  allow_multiple?: boolean;
}

export function usePolls() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pollsQuery = useQuery({
    queryKey: ['polls', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((p) => ({
        ...p,
        options: (p.options ?? []) as unknown as PollOption[],
        votes: (p.votes ?? {}) as unknown as PollVotes,
      })) as Poll[];
    },
    enabled: !!selectedGuild?.id,
  });

  const activePolls = pollsQuery.data?.filter((p) => !p.ended) ?? [];
  const endedPolls = pollsQuery.data?.filter((p) => p.ended) ?? [];

  const createPoll = useMutation({
    mutationFn: async (poll: CreatePoll) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('polls')
        .insert({
          guild_id: selectedGuild.id,
          channel_id: poll.channel_id,
          question: poll.question,
          options: poll.options as unknown as Json,
          created_by: poll.created_by,
          votes: { allow_multiple: poll.allow_multiple ?? false, created_by_name: poll.created_by_name } as unknown as Json,
          ends_at: poll.ends_at,
        })
        .select()
        .single();

      if (error) throw error;

      // Send the poll to Discord via edge function
      const { error: sendError } = await supabase.functions.invoke('send-poll', {
        body: { pollId: data.id },
      });

      if (sendError) {
        console.error('Failed to send poll to Discord:', sendError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', selectedGuild?.id] });
      toast({ title: 'Afstemning oprettet' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const endPoll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('polls')
        .update({ ended: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', selectedGuild?.id] });
      toast({ title: 'Afstemning afsluttet' });
    },
  });

  const deletePoll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', selectedGuild?.id] });
      toast({ title: 'Afstemning slettet' });
    },
  });

  return {
    polls: pollsQuery.data ?? [],
    activePolls,
    endedPolls,
    isLoading: pollsQuery.isLoading,
    createPoll,
    endPoll,
    deletePoll,
  };
}
