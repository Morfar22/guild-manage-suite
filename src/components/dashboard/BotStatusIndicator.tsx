import { useBotStatus } from "@/hooks/useBotStatus";
import { cn } from "@/lib/utils";
import { getBotConnectionLabel } from "@/lib/bot-status";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BotStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function BotStatusIndicator({
  className,
  showLabel = false,
}: BotStatusIndicatorProps) {
  const { status, connectionState, error, refreshing, refetch } =
    useBotStatus();
  const { language } = useLanguage();

  // Determine status: online, slow, offline
  const getStatusInfo = () => {
    if (connectionState === "loading") {
      return {
        color: "bg-muted-foreground",
        label: getBotConnectionLabel(connectionState, language),
        pulse: false,
      };
    }

    if (connectionState === "error" || connectionState === "unknown") {
      return {
        color: "bg-yellow-500",
        label: getBotConnectionLabel(connectionState, language),
        pulse: false,
      };
    }

    if (connectionState === "offline") {
      return {
        color: "bg-destructive",
        label: "Offline",
        pulse: false,
      };
    }

    // Check latency for slow status
    if (status?.latency_ms && status.latency_ms > 500) {
      return {
        color: "bg-yellow-500",
        label: `${language === "da" ? "Langsom" : "Slow"} (${status.latency_ms}ms)`,
        pulse: true,
      };
    }

    return {
      color: "bg-green-500",
      label: status?.latency_ms ? `Online (${status.latency_ms}ms)` : "Online",
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
                  statusInfo.color,
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                statusInfo.color,
              )}
            />
          </span>
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {statusInfo.label}
            </span>
          )}
          {error && (
            <button
              type="button"
              className="text-xs underline underline-offset-2 disabled:opacity-50"
              disabled={refreshing}
              onClick={() => void refetch()}
            >
              {language === "da" ? "Prøv igen" : "Try again"}
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Bot Status: {statusInfo.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
