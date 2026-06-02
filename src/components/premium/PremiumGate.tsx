import React, { ReactNode } from 'react';
import { useGuildPremiumFeatures } from '@/hooks/useGuildPremiumFeatures';
import { useCurrentUserPremiumFeatures } from '@/hooks/useUserPremiumFeatures';
import { PREMIUM_FEATURES, PremiumFeatureKey } from '@/lib/premium-features';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

interface PremiumGateProps {
  feature: PremiumFeatureKey;
  children: ReactNode;
}

export const PremiumGate = ({ feature, children }: PremiumGateProps) => {
  const { hasPremiumFeature: hasGuildPremium, isLoading: guildLoading } = useGuildPremiumFeatures();
  const { hasUserPremiumFeature, isLoading: userLoading } = useCurrentUserPremiumFeatures();

  if (guildLoading || userLoading) return null;

  // Allow access if either the guild OR the user has the feature
  if (hasGuildPremium(feature) || hasUserPremiumFeature(feature)) {
    return <>{children}</>;
  }

  const featureInfo = PREMIUM_FEATURES[feature];
  const Icon = featureInfo.icon;

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full border-border/50">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {featureInfo.name}
            </h2>
            <p className="text-muted-foreground">
              Denne feature kræver et premium-abonnement.
            </p>
            <p className="text-sm text-muted-foreground">
              Kontakt en administrator for at få adgang.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
