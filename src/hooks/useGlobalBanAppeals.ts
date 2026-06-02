import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GlobalBanAppeal {
  id: string;
  ban_id: string;
  appellant_discord_id: string;
  appellant_discord_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

async function getAuthHeaders() {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-ban-handler`;

export function useGlobalBanAppeals(status?: string) {
  return useQuery({
    queryKey: ['global-ban-appeals', status],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ action: 'appeals' });
      if (status) params.set('status', status);
      const res = await fetch(`${BASE_URL}?${params}`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return ((await res.json()) as { appeals: GlobalBanAppeal[] }).appeals;
    },
  });
}

export function useApproveAppeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ appealId, reviewNote }: { appealId: string; reviewNote?: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'approve_appeal', appeal_id: appealId, review_note: reviewNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-ban-appeals'] });
      qc.invalidateQueries({ queryKey: ['global-bans'] });
      toast.success('Appeal godkendt - ban fjernet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}

export function useRejectAppeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ appealId, reviewNote }: { appealId: string; reviewNote?: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'reject_appeal', appeal_id: appealId, review_note: reviewNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-ban-appeals'] });
      toast.success('Appeal afvist');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}
