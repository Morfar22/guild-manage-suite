export const BOT_STATUS_POLL_INTERVAL_MS = 30_000;
// Four missed 30-second heartbeats use the same limit throughout the dashboard.
export const BOT_HEARTBEAT_MAX_AGE_MS = 2 * 60_000;

export type BotConnectionState =
  "loading" | "error" | "unknown" | "online" | "offline";

export interface BotHeartbeat {
  is_online: boolean;
  last_heartbeat: string | null;
}

export function getHeartbeatState(
  status: BotHeartbeat | null | undefined,
  now = Date.now(),
): "online" | "offline" | "unknown" {
  if (!status) return "unknown";
  if (!status.is_online) return "offline";
  if (!status.last_heartbeat) return "unknown";
  const heartbeat = Date.parse(status.last_heartbeat);
  if (!Number.isFinite(heartbeat)) return "unknown";
  return heartbeat > now - BOT_HEARTBEAT_MAX_AGE_MS ? "online" : "offline";
}

export function getBotConnectionLabel(
  state: BotConnectionState,
  language: "da" | "en" = "en",
) {
  const labels = {
    loading: language === "da" ? "Tjekker status..." : "Checking status...",
    error:
      language === "da" ? "Status kunne ikke hentes" : "Status unavailable",
    unknown: language === "da" ? "Ukendt status" : "Unknown status",
    online: "Online",
    offline: "Offline",
  };
  return labels[state];
}
