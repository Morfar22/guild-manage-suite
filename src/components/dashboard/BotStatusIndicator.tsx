import { useBotStatus } from '@/hooks/useBotStatus';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BotStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function BotStatusIndicator({ className, showLabel = false }: BotStatusIndicatorProps) {
  const { status, isOnline, loading } = useBotStatus();

  // Determine status: online, slow, offline
  const getStatusInfo = () => {
    if (loading) {
      return {
        color: 'bg-muted-foreground',
        label: 'Checking...',
        pulse: false,
      };
    }

    if (!isOnline) {
      return {
        color: 'bg-destructive',
        label: 'Offline',
        pulse: false,
      };
    }

    // Check latency for slow status
    if (status?.latency_ms && status.latency_ms > 500) {
      return {
        color: 'bg-yellow-500',
        label: `Slow (${status.latency_ms}ms)`,
        pulse: true,
      };
    }

    return {
      color: 'bg-green-500',
      label: status?.latency_ms ? `Online (${status.latency_ms}ms)` : 'Online',
      pulse: true,
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-2", className)}>
          <span className="relative flex h-2.5 w-2.5">
            {statusInfo.pulse && (
              <span 
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  statusInfo.color
                )} 
              />
            )}
            <span 
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                statusInfo.color
              )} 
            />
          </span>
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {statusInfo.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Bot Status: {statusInfo.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
