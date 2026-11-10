import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Guild } from "@/types/discord";
import {
  BOT_STATUS_POLL_INTERVAL_MS,
  getHeartbeatState,
} from "@/lib/bot-status";

export function useGuildSelectionData(
  userId: string | undefined,
  isAdmin: boolean | undefined,
) {
  const queryClient = useQueryClient();
  const enabled = !!userId && isAdmin !== undefined;
  // Scope cached lists to the account and permission level that fetched them.
  const guildsKey = ["guild-selection", userId, isAdmin];
  const guildsQuery = useQuery({
    queryKey: guildsKey,
    enabled,
    retry: false,
    queryFn: async (): Promise<Guild[]> => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("guilds")
          .select("*")
          .order("guild_name");
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase
        .from("user_guilds")
        .select("guild_id, has_admin_permission, guilds:guild_id (*)")
        .eq("user_id", userId!);
      if (error) throw error;
      return (
        data
          ?.filter((ug) => ug.guilds && ug.has_admin_permission)
          .map((ug) => ug.guilds as Guild)
          .sort((a, b) => a.guild_name.localeCompare(b.guild_name)) || []
      );
    },
  });
  const statusQuery = useQuery({
    queryKey: ["guild-selection-status", userId, isAdmin],
    enabled,
    retry: false,
    refetchInterval: BOT_STATUS_POLL_INTERVAL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_status")
        .select("guild_id, is_online, last_heartbeat");
      if (error) throw error;
      return data || [];
    },
  });

  const getGuildStatus = (guildId: string) => {
    if (statusQuery.isPending) return "loading" as const;
    if (statusQuery.error) return "error" as const;
    return getHeartbeatState(
      statusQuery.data?.find((status) => status.guild_id === guildId),
    );
  };

  return {
    guilds: guildsQuery.data || [],
    loading: guildsQuery.isPending,
    error: guildsQuery.error,
    statusError: statusQuery.error,
    statusLoading: statusQuery.isPending,
    refreshing: guildsQuery.isFetching || statusQuery.isFetching,
    hasLoadedGuilds: guildsQuery.data !== undefined,
    getGuildStatus,
    refetch: () => Promise.all([guildsQuery.refetch(), statusQuery.refetch()]),
    removeGuild: (guildId: string) =>
      queryClient.setQueryData<Guild[]>(guildsKey, (guilds) =>
        guilds?.filter((guild) => guild.id !== guildId),
      ),
  };
}
