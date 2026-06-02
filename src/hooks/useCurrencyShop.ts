import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export function useCurrencyShop() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id;

  const itemsQuery = useQuery({
    queryKey: ['shop-items', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('economy_shop_items').select('*').eq('guild_id', guildId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const purchasesQuery = useQuery({
    queryKey: ['shop-purchases', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('economy_purchases').select('*, economy_shop_items(name, price)')
        .eq('guild_id', guildId).order('purchased_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const createItem = useMutation({
    mutationFn: async (item: { name: string; description?: string; price: number; role_id?: string; stock?: number }) => {
      if (!guildId) throw new Error('No guild');
      const { error } = await supabase.from('economy_shop_items').insert({ guild_id: guildId, ...item });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-items', guildId] }); toast.success('Vare oprettet'); },
    onError: () => toast.error('Kunne ikke oprette'),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from('economy_shop_items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-items', guildId] }); toast.success('Vare opdateret'); },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('economy_shop_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-items', guildId] }); toast.success('Vare slettet'); },
  });

  return { items: itemsQuery.data || [], purchases: purchasesQuery.data || [], isLoading: itemsQuery.isLoading, createItem, updateItem, deleteItem };
}
