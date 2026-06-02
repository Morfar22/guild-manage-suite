import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface ApplicationSubmission {
  id: string;
  guild_id: string;
  form_id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  answers: { question: string; answer: string }[];
  status: 'pending' | 'approved' | 'denied';
  reviewer_discord_id: string | null;
  reviewer_name: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  form?: {
    name: string;
    emoji: string | null;
  };
}

export function useApplicationSubmissions(status?: 'pending' | 'approved' | 'denied') {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-submissions', selectedGuild?.id, status],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      let query = supabase
        .from('application_submissions')
        .select(`
          *,
          form:application_forms(name, emoji)
        `)
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ApplicationSubmission[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useApplicationSubmission(submissionId: string | undefined) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-submission', submissionId],
    queryFn: async () => {
      if (!submissionId || !selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('application_submissions')
        .select(`
          *,
          form:application_forms(name, emoji, granted_role_id)
        `)
        .eq('id', submissionId)
        .eq('guild_id', selectedGuild.id)
        .single();

      if (error) throw error;
      return data as ApplicationSubmission & { form: { name: string; emoji: string | null; granted_role_id: string | null } };
    },
    enabled: !!submissionId && !!selectedGuild?.id,
  });
}

export function useReviewApplication() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({
      submissionId,
      status,
      reviewerName,
      reviewerDiscordId,
      notes,
    }: {
      submissionId: string;
      status: 'approved' | 'denied';
      reviewerName: string;
      reviewerDiscordId: string;
      notes?: string;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Call edge function to handle the review (includes role assignment, DM, channel post)
      const { data, error } = await supabase.functions.invoke('application-handler', {
        body: {
          action: 'review',
          submission_id: submissionId,
          status,
          reviewer_name: reviewerName,
          reviewer_discord_id: reviewerDiscordId,
          notes,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-submissions', selectedGuild?.id] });
      toast.success('Application reviewed');
    },
    onError: (error) => {
      toast.error('Failed to review application: ' + error.message);
    },
  });
}

export function useSendApplicationPanel() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase.functions.invoke('application-handler', {
        body: {
          action: 'send_panel',
          guild_id: selectedGuild.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-settings', selectedGuild?.id] });
      toast.success('Application panel sent');
    },
    onError: (error) => {
      toast.error('Failed to send panel: ' + error.message);
    },
  });
}
