import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAITicketSummary() {
  const queryClient = useQueryClient();

  const generateSummary = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data, error } = await supabase.functions.invoke('ai-ticket-summary', {
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
      if (err.message?.includes('Rate limited')) {
        toast.error('AI er rate limited. Prøv igen om lidt.');
      } else if (err.message?.includes('Credits')) {
        toast.error('AI-credits opbrugt. Tilføj flere credits.');
      } else {
        toast.error('Kunne ikke generere opsummering');
      }
    },
  });

  return { generateSummary };
}
