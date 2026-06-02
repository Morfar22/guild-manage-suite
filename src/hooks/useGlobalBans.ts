import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GlobalBanReport {
  id: string;
  reporter_discord_id: string;
  reporter_discord_name: string;
  target_discord_id: string;
  target_discord_name: string;
  reason: string;
  evidence_urls: string[];
  severity: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface GlobalBan {
  id: string;
  report_id: string | null;
  target_discord_id: string;
  target_discord_name: string;
  reason: string;
  severity: string;
  banned_by: string | null;
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

export function useGlobalBanReports(status?: string) {
  return useQuery({
    queryKey: ['global-ban-reports', status],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ action: 'reports' });
      if (status) params.set('status', status);
      const res = await fetch(`${BASE_URL}?${params}`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return ((await res.json()) as { reports: GlobalBanReport[] }).reports;
    },
  });
}

export function useGlobalBans() {
  return useQuery({
    queryKey: ['global-bans'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}?action=bans`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return ((await res.json()) as { bans: GlobalBan[] }).bans;
    },
  });
}

export function useApproveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, reviewNote }: { reportId: string; reviewNote?: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'approve', report_id: reportId, review_note: reviewNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-ban-reports'] });
      qc.invalidateQueries({ queryKey: ['global-bans'] });
      toast.success('Rapport godkendt - global ban oprettet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}

export function useRejectReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, reviewNote }: { reportId: string; reviewNote?: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'reject', report_id: reportId, review_note: reviewNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-ban-reports'] });
      toast.success('Rapport afvist');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}

export function useRemoveGlobalBan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (banId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'unban', ban_id: banId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-bans'] });
      toast.success('Global ban fjernet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}

export function useCreateDirectBan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { target_discord_id: string; target_discord_name: string; reason: string; severity: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'direct_ban', ...data }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-bans'] });
      qc.invalidateQueries({ queryKey: ['global-ban-stats'] });
      toast.success('Global ban oprettet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });
}
