import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'];

async function getAuthHeaders() {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function tebexGet(guildId: string, action: string, extra = '') {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/tebex-handler?guild_id=${guildId}&action=${action}${extra}`,
    { headers }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function tebexPost(guildId: string, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/tebex-handler?guild_id=${guildId}`,
    { method: 'POST', headers, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to save');
  }
  return res.json();
}

export function useTebexSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tebex-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const data = await tebexGet(selectedGuild.id, 'settings');
      return data.settings as {
        id: string; guild_id: string; enabled: boolean;
        notification_channel_id: string | null;
      } | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const saveSettings = useMutation({
    mutationFn: async (params: { enabled: boolean; tebex_secret?: string; notification_channel_id?: string }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      await tebexPost(selectedGuild.id, { action: 'save_settings', ...params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tebex-settings', selectedGuild?.id] });
      toast.success('Tebex indstillinger gemt');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { settings: query.data, isLoading: query.isLoading, saveSettings };
}

export function useTebexLookup(tebexEnabled: boolean) {
  const { selectedGuild } = useGuild();

  const lookupPayment = useMutation({
    mutationFn: async (txnId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      return tebexGet(selectedGuild.id, 'lookup_payment', `&txn_id=${encodeURIComponent(txnId)}`);
    },
  });

  const lookupPlayer = useMutation({
    mutationFn: async (playerId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      return tebexGet(selectedGuild.id, 'lookup_player', `&player_id=${encodeURIComponent(playerId)}`);
    },
  });

  const recentPayments = useQuery({
    queryKey: ['tebex-recent-payments', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const data = await tebexGet(selectedGuild.id, 'recent_payments');
      return data.payments;
    },
    enabled: !!selectedGuild?.id && tebexEnabled,
  });

  return { lookupPayment, lookupPlayer, recentPayments };
}

export function useTebexPackages(tebexEnabled: boolean) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['tebex-packages', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const data = await tebexGet(selectedGuild.id, 'packages');
      return data.listing;
    },
    enabled: !!selectedGuild?.id && tebexEnabled,
  });
}

export function useTebexStats(tebexEnabled: boolean) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['tebex-stats', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const data = await tebexGet(selectedGuild.id, 'stats');
      return data.stats;
    },
    enabled: !!selectedGuild?.id && tebexEnabled,
  });
}

export function useTebexPurchaseHistory(tebexEnabled: boolean) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['tebex-purchase-history', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const data = await tebexGet(selectedGuild.id, 'purchase_history');
      return data.purchases || [];
    },
    enabled: !!selectedGuild?.id && tebexEnabled,
  });
}

export function useTebexRoleMappings(tebexEnabled: boolean) {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tebex-role-mappings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const data = await tebexGet(selectedGuild.id, 'role_mappings');
      return data.mappings || [];
    },
    enabled: !!selectedGuild?.id && tebexEnabled,
  });

  const saveMapping = useMutation({
    mutationFn: async (params: {
      tebex_package_id: number;
      tebex_package_name: string;
      discord_role_id: string;
      discord_role_name: string;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      await tebexPost(selectedGuild.id, { action: 'save_role_mapping', ...params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tebex-role-mappings', selectedGuild?.id] });
      toast.success('Rolle-mapping gemt');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      await tebexPost(selectedGuild.id, { action: 'delete_role_mapping', id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tebex-role-mappings', selectedGuild?.id] });
      toast.success('Rolle-mapping slettet');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { mappings: query.data || [], isLoading: query.isLoading, saveMapping, deleteMapping };
}
