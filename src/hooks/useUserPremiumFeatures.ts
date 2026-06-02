import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PremiumFeatureKey } from '@/lib/premium-features';

export interface UserPremiumFeature {
  id: string;
  user_id: string;
  feature: string;
  enabled: boolean;
  enabled_by: string | null;
  enabled_at: string;
  expires_at: string | null;
  notes: string | null;
}

// For the current user - check if they personally have a premium feature
export function useCurrentUserPremiumFeatures() {
  const query = useQuery({
    queryKey: ['current-user-premium-features'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_premium_features')
        .select('*')
        .eq('user_id', user.id)
        .eq('enabled', true);
      if (error) throw error;
      return (data || []) as UserPremiumFeature[];
    },
  });

  const hasUserPremiumFeature = (feature: PremiumFeatureKey): boolean => {
    if (!query.data) return false;
    const f = query.data.find(pf => pf.feature === feature);
    if (!f || !f.enabled) return false;
    if (f.expires_at && new Date(f.expires_at) < new Date()) return false;
    return true;
  };

  return { ...query, hasUserPremiumFeature };
}

// Admin: get ALL user premium features
export function useAllUserPremiumFeatures() {
  return useQuery({
    queryKey: ['all-user-premium-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_premium_features')
        .select('*')
        .order('enabled_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UserPremiumFeature[];
    },
  });
}

export function useToggleUserPremiumFeature() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, feature, enabled, expiresAt, notes }: {
      userId: string;
      feature: string;
      enabled: boolean;
      expiresAt?: string | null;
      notes?: string | null;
    }) => {
      if (enabled) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('user_premium_features')
          .upsert({
            user_id: userId,
            feature,
            enabled: true,
            enabled_by: user?.id,
            enabled_at: new Date().toISOString(),
            expires_at: expiresAt || null,
            notes: notes || null,
          }, { onConflict: 'user_id,feature' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_premium_features')
          .update({ enabled: false })
          .eq('user_id', userId)
          .eq('feature', feature);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-user-premium-features'] });
      qc.invalidateQueries({ queryKey: ['current-user-premium-features'] });
    },
  });
}
