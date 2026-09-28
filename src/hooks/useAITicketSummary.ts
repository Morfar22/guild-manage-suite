import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invokeFunction } from '@/lib/functions-client';

export function useAITicketSummary() {
  const queryClient = useQueryClient();

  const generateSummary = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data, error } = await invokeFunction('ai-ticket-summary', {
        body: { action: 'summarize', data: { ticket_id: ticketId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.summary as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      toast.success('AI-opsummering genereret');
    },
    onError: (err: any) => {
      if (err.code === 'openai_rate_limited') {
        toast.error('OpenAI er rate limited. Prøv igen om lidt.');
      } else if (err.code === 'openai_quota_exceeded') {
        toast.error('OpenAI-projektet mangler quota eller billing.');
      } else if (err.code === 'openai_not_configured') {
        toast.error('OPENAI_API_KEY mangler i serverens runtime.');
      } else if (err.code === 'openai_invalid_key') {
        toast.error('OpenAI API-nøglen er ugyldig eller ikke aktiv.');
      } else {
        toast.error(err.message || 'Kunne ikke generere opsummering');
      }
    },
  });

  return { generateSummary };
}
