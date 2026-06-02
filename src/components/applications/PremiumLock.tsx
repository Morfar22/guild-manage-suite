import { ReactNode } from 'react';
import { Crown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGuildPremium } from '@/hooks/useGuildPremium';
import { Link } from 'react-router-dom';

interface PremiumLockProps {
  children: ReactNode;
  feature?: string;
  title?: string;
  description?: string;
  className?: string;
  /** Hvis true vises børn nedtonet med overlay; ellers helt skjult bag lås */
  showPreview?: boolean;
}

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300',
        className,
      )}
    >
      <Crown className="mr-1 h-3 w-3" />
      PRO
    </Badge>
  );
}

export function PremiumLock({
  children,
  title = 'Premium-funktion',
  description = 'Denne funktion er en del af Applications Pro. Opgrader din server for at låse op for AI-screening, interviews, analytics og meget mere.',
  className,
  showPreview = true,
}: PremiumLockProps) {
  const { data: hasPremium, isLoading } = useGuildPremium();

  if (isLoading) return null;
  if (hasPremium) return <>{children}</>;

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-amber-500/20', className)}>
      {showPreview && (
        <div className="pointer-events-none select-none opacity-30 blur-[1px]">
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-background/95 via-background/90 to-amber-500/5 p-6 text-center backdrop-blur-sm">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/30 to-yellow-500/30 shadow-lg shadow-amber-500/20">
          <Lock className="h-5 w-5 text-amber-400" />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <PremiumBadge />
        </div>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>
        <Button
          asChild
          size="sm"
          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-400 hover:to-yellow-400"
        >
          <Link to="/premium">
            <Crown className="mr-2 h-4 w-4" />
            Opgrader til Pro
          </Link>
        </Button>
      </div>
    </div>
  );
}
