import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";
import {
  BOT_STATUS_POLL_INTERVAL_MS,
  getHeartbeatState,
  type BotConnectionState,
} from "@/lib/bot-status";

interface BotStatus {
  id: string;
  guild_id: string;
  is_online: boolean;
  latency_ms: number | null;
  last_heartbeat: string | null;
  member_count: number | null;
  message_count_today: number | null;
}

export function useBotStatus() {
  const { selectedGuild } = useGuild();
  const guildId = selectedGuild?.id;
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const requestId = useRef(0);
  const invalidateRequest = useCallback(() => {
    requestId.current++;
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!guildId) return;
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("bot_status")
        .select("*")
        .eq("guild_id", guildId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (currentRequest !== requestId.current) return;
      setNow(Date.now());
      setStatus(data);
      setError(null);
    } catch (fetchError) {
      if (currentRequest !== requestId.current) return;
      console.error("Error fetching bot status:", fetchError);
      setError(
        fetchError instanceof Error ? fetchError.message : "Status unavailable",
      );
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [guildId]);

  useEffect(() => {
    let active = true;
    setStatus(null);
    setError(null);
    if (!guildId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Initial fetch
    setLoading(true);
    void fetchStatus();

    // Set up polling interval as backup
    const pollInterval = setInterval(() => {
      setNow(Date.now());
      void fetchStatus();
    }, BOT_STATUS_POLL_INTERVAL_MS);

    // Supabase reuses channels with the same topic. Each effect needs its own
    // channel so concurrent consumers and remounts cannot reuse a subscribed one.
    const channel = supabase
      .channel(`bot_status_${guildId}_${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_status",
          filter: `guild_id=eq.${guildId}`,
        },
        (payload) => {
          if (!active) return;
          // A newer realtime event supersedes an in-flight snapshot request.
          invalidateRequest();
          setError(null);
          setLoading(false);
          setRefreshing(false);
          setNow(Date.now());
          if (payload.eventType === "DELETE") {
            setStatus(null);
          } else {
            setStatus(payload.new as BotStatus);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      invalidateRequest();
      clearInterval(pollInterval);
      void supabase.removeChannel(channel);
    };
  }, [guildId, fetchStatus, invalidateRequest]);

  const connectionState: BotConnectionState = loading
    ? "loading"
    : error
      ? "error"
      : getHeartbeatState(status, now);
  const isOnline = connectionState === "online";

  return {
    status,
    isOnline,
    connectionState,
    loading,
    refreshing,
    error,
    refetch: fetchStatus,
  };
}
