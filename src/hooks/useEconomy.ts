import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface EconomyAccount {
  id: string;
  guild_id: string;
  user_id: string;
  discord_username: string | null;
  wallet: number;
  bank: number;
  total_earned: number;
  created_at: string;
}

export interface EconomySettings {
  id: string;
  guild_id: string;
  currency_name: string;
  currency_symbol: string;
  daily_amount: number;
  work_min: number;
  work_max: number;
  work_cooldown_minutes: number;
  daily_cooldown_hours: number;
  starting_balance: number;
}

export function useEconomyLeaderboard() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['economy-leaderboard', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('economy_accounts')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('total_earned', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as EconomyAccount[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useEconomySettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['economy-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('economy_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as EconomySettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<EconomySettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('economy_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('economy_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('economy_settings')
          .insert({ guild_id: selectedGuild.id, ...settings })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['economy-settings', selectedGuild?.id] });
      toast({ title: 'Indstillinger gemt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, updateSettings };
}
