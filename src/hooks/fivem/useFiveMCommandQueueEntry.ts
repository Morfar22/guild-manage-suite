import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";

type QueueStatus = "pending" | "executed" | "failed";

export interface FiveMCommandQueueEntry {
  id: string;
  guild_id: string;
  command_name: string;
  status: QueueStatus;
  result: string | null;
  executed_at: string | null;
  created_at: string;
}

export function useFiveMCommandQueueEntry(commandId?: string | null) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ["fivem-command-queue-entry", selectedGuild?.id, commandId],
    enabled: !!selectedGuild?.id && !!commandId,
    queryFn: async () => {
      if (!selectedGuild?.id || !commandId) throw new Error("Missing guild/command id");

      const { data, error } = await supabase
        .from("fivem_command_queue")
        .select("id, guild_id, command_name, status, result, executed_at, created_at")
        .eq("guild_id", selectedGuild.id)
        .eq("id", commandId)
        .single();

      if (error) throw error;
      
      console.log("[useFiveMCommandQueueEntry] Fetched:", data?.status, data?.result);
      return data as FiveMCommandQueueEntry;
    },
    // Poll every second while pending - use staleTime 0 to always refetch
    staleTime: 0,
    refetchInterval: (query) => {
      const entry = query.state.data as FiveMCommandQueueEntry | undefined;
      // Keep polling while status is pending
      if (!entry) return 1000;
      if (entry.status === "pending") return 1000;
      return false;
    },
  });
}
