import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";
import { useAuth } from "@/contexts/AuthContext";

export function useBotHealthData(level: string) {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const guildId = selectedGuild?.id;
  const enabled = !!guildId && !!user?.id;
  const logs = useQuery({
    queryKey: ["bot-console-logs", guildId, user?.id, level],
    enabled,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      let query = supabase
        .from("bot_console_logs")
        .select("*")
        .eq("guild_id", guildId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (level !== "all") query = query.eq("level", level);
      const { data, error } = await query.abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
  });
  const counts = useQuery({
    queryKey: ["bot-console-counts", guildId, user?.id],
    enabled,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const count = async (severity: "error" | "warn") => {
        const { count: total, error } = await supabase
          .from("bot_console_logs")
          .select("id", { count: "exact", head: true })
          .eq("guild_id", guildId!)
          .gte("created_at", since)
          .eq("level", severity)
          .abortSignal(signal);
        if (error) throw error;
        if (total == null) throw new Error("Logoptælling er ikke tilgængelig");
        return total;
      };
      const [errors, warnings] = await Promise.all([
        count("error"),
        count("warn"),
      ]);
      return { errors, warnings };
    },
  });
  const history = useQuery({
    queryKey: ["bot-heartbeat-history", guildId, user?.id],
    enabled,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("bot_console_logs")
        .select("created_at,metadata")
        .eq("guild_id", guildId!)
        .eq("source", "heartbeat")
        .eq("level", "info")
        .order("created_at", { ascending: false })
        .limit(50)
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? [])
        .slice()
        .reverse()
        .map((entry) => {
          const metadata = entry.metadata as Record<string, unknown> | null;
          const latency = metadata?.latency_ms;
          return {
            time: new Date(entry.created_at).toLocaleTimeString("da-DK", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            latency:
              typeof latency === "number" && Number.isFinite(latency)
                ? latency
                : null,
            observedAt: entry.created_at,
          };
        });
    },
  });
  return { logs, counts, history };
}
