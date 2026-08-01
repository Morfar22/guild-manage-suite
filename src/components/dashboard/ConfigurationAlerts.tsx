import { Link } from '@tanstack/react-router';
import { AlertTriangle, Info, XCircle, ChevronRight, X } from 'lucide-react';
import { useConfigurationAlerts, ConfigurationAlert } from '@/hooks/useConfigurationAlerts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const severityConfig = {
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-500/30 bg-yellow-500/10',
    iconClassName: 'text-yellow-500',
  },
  info: {
    icon: Info,
    className: 'border-blue-500/30 bg-blue-500/10',
    iconClassName: 'text-blue-500',
  },
  error: {
    icon: XCircle,
    className: 'border-destructive/30 bg-destructive/10',
    iconClassName: 'text-destructive',
  },
};

function AlertItem({ alert, onDismiss }: { alert: ConfigurationAlert; onDismiss: (id: string) => void }) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div className={cn('relative rounded-lg border p-4', config.className)}>
      <button
        onClick={() => onDismiss(alert.id)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-background/50 transition-colors"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
      
      <div className="flex items-start gap-3 pr-6">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.iconClassName)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground text-sm">{alert.title}</h4>
            <span className="text-xs px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground">
              {alert.module}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
          <Link to={alert.link}>
            <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs gap-1">
              Konfigurer
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ConfigurationAlerts() {
  const { alerts, isLoading, hasAlerts } = useConfigurationAlerts();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  if (isLoading || !hasAlerts) return null;

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  
  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedAlerts(prev => new Set([...prev, id]));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Konfigurationsadvarsler ({visibleAlerts.length})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleAlerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}
