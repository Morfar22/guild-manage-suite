import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

/**
 * Tjekker om den aktuelle guild har applications_pro / premium aktivt.
 * Bruges til at gate Pro-funktioner i UI.
 */
export function useGuildPremium(feature = 'applications_pro') {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['guild-premium', selectedGuild?.id, feature],
    queryFn: async () => {
      if (!selectedGuild?.id) return false;

      const { data, error } = await supabase
        .from('guild_premium_features')
        .select('enabled, expires_at')
        .eq('guild_id', selectedGuild.id)
        .in('feature', [feature, 'premium', 'all_features'])
        .eq('enabled', true);

      if (error) return false;
      if (!data || data.length === 0) return false;

      const now = Date.now();
      return data.some(
        (row) => !row.expires_at || new Date(row.expires_at).getTime() > now,
      );
    },
    enabled: !!selectedGuild?.id,
    staleTime: 60_000,
  });
}
