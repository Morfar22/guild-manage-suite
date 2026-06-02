import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { PremiumFeatureKey } from '@/lib/premium-features';

export interface GuildPremiumFeature {
  id: string;
  guild_id: string;
  feature: string;
  enabled: boolean;
  enabled_by: string | null;
  enabled_at: string;
  expires_at: string | null;
  notes: string | null;
}

export function useGuildPremiumFeatures() {
  const { selectedGuild } = useGuild();

  const query = useQuery({
    queryKey: ['guild-premium-features', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('guild_premium_features')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .eq('enabled', true);
      if (error) throw error;
      return data as GuildPremiumFeature[];
    },
    enabled: !!selectedGuild?.id,
  });

  const hasPremiumFeature = (feature: PremiumFeatureKey): boolean => {
    if (!query.data) return false;
    const f = query.data.find(pf => pf.feature === feature);
    if (!f || !f.enabled) return false;
    if (f.expires_at && new Date(f.expires_at) < new Date()) return false;
    return true;
  };

  return {
    ...query,
    hasPremiumFeature,
  };
}

// Admin hook for managing all guilds' premium features
export function useAllGuildPremiumFeatures() {
  return useQuery({
    queryKey: ['all-guild-premium-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guild_premium_features')
        .select('*')
        .order('enabled_at', { ascending: false });
      if (error) throw error;
      return data as GuildPremiumFeature[];
    },
  });
}

export function useTogglePremiumFeature() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ guildId, feature, enabled, expiresAt, notes }: {
      guildId: string;
      feature: string;
      enabled: boolean;
      expiresAt?: string | null;
      notes?: string | null;
    }) => {
      if (enabled) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('guild_premium_features')
          .upsert({
            guild_id: guildId,
            feature,
            enabled: true,
            enabled_by: user?.id,
            enabled_at: new Date().toISOString(),
            expires_at: expiresAt || null,
            notes: notes || null,
          }, { onConflict: 'guild_id,feature' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guild_premium_features')
          .update({ enabled: false })
          .eq('guild_id', guildId)
          .eq('feature', feature);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-premium-features'] });
      qc.invalidateQueries({ queryKey: ['all-guild-premium-features'] });
    },
  });
}
