import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DbModuleType, MODULE_INFO } from '@/types/discord';
import { Shield, Music, TrendingUp, Wrench, Gamepad2, Coins, Ticket, Gift, HelpCircle, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  Shield,
  Music,
  TrendingUp,
  Wrench,
  Gamepad2,
  Coins,
  Ticket,
  Gift,
};

const getIcon = (iconName: string): React.ElementType => {
  return iconMap[iconName] || HelpCircle;
};

export type ModuleStatus = 'enabled' | 'disabled' | 'syncing' | 'error';

interface ModuleCardProps {
  moduleType: DbModuleType;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
  status?: ModuleStatus;
}

const statusConfig: Record<ModuleStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
  dotClassName: string;
  pulse?: boolean;
}> = {
  enabled: {
    label: 'Enabled',
    icon: CheckCircle2,
    className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    dotClassName: 'bg-emerald-500',
  },
  disabled: {
    label: 'Disabled',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
  syncing: {
    label: 'Syncing',
    icon: Loader2,
    className: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    dotClassName: 'bg-amber-500',
    pulse: true,
  },
  error: {
    label: 'Error',
    icon: AlertTriangle,
    className: 'bg-destructive/15 text-destructive border-destructive/30',
    dotClassName: 'bg-destructive',
    pulse: true,
  },
};

export function ModuleCard({ moduleType, enabled, onToggle, loading, status }: ModuleCardProps) {
  const info = MODULE_INFO[moduleType];
  const IconComponent = getIcon(info.icon);

  const resolvedStatus: ModuleStatus =
    status ?? (loading ? 'syncing' : enabled ? 'enabled' : 'disabled');
  const statusInfo = statusConfig[resolvedStatus];
  const StatusIcon = statusInfo.icon;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 animate-fade-in',
        enabled
          ? 'border-primary/30 shadow-glow'
          : 'border-border hover:border-muted-foreground/30',
        resolvedStatus === 'error' && 'border-destructive/40'
      )}
    >
      {enabled && resolvedStatus !== 'error' && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
              enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-card-foreground">{info.name}</h3>
              <Badge
                variant="outline"
                className={cn('gap-1.5 px-2 py-0.5 text-xs font-medium', statusInfo.className)}
                aria-live="polite"
              >
                <span className="relative flex h-2 w-2">
                  {statusInfo.pulse && (
                    <span
                      className={cn(
                        'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                        statusInfo.dotClassName
                      )}
                    />
                  )}
                  <span className={cn('relative inline-flex h-2 w-2 rounded-full', statusInfo.dotClassName)} />
                </span>
                <StatusIcon className={cn('h-3 w-3', resolvedStatus === 'syncing' && 'animate-spin')} />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {info.commandCount} commands
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={loading}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );
}
