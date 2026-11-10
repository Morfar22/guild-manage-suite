import type { Untyped } from "@/types/untyped";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGuild } from "@/contexts/GuildContext";
import { useEffect } from "react";

export interface DashboardNotification {
  id: string;
  guild_id: string;
  type: string;
  title: string;
  message: string | null;
  source: string;
  is_read: boolean;
  metadata: Untyped;
  severity: "info" | "warning" | "error" | "critical";
  status: "open" | "acknowledged" | "resolved";
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export function useDashboardNotifications() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dashboard-notifications", selectedGuild?.id, user?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from("dashboard_notifications")
        .select("*")
        .eq("guild_id", selectedGuild.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DashboardNotification[];
    },
    enabled: !!selectedGuild?.id && !!user?.id,
  });

  const unreadQuery = useQuery({
    queryKey: ["dashboard-unread-count", selectedGuild?.id, user?.id],
    enabled: !!selectedGuild?.id && !!user?.id,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("dashboard_notifications")
        .select("id", { head: true, count: "exact" })
        .eq("guild_id", selectedGuild!.id)
        .eq("is_read", false);
      if (error) throw error;
      if (count == null) throw new Error("Antallet af ulæste kan ikke hentes");
      return count;
    },
  });
  const refresh = (targetGuildId = selectedGuild?.id) => {
    for (const key of [
      "dashboard-notifications",
      "dashboard-unread-count",
      "operations-summary",
      "ops-alerts",
      "ops-alert-counts",
      "ops-alert-preview",
    ])
      void queryClient.invalidateQueries({
        queryKey: [key, targetGuildId],
      });
  };
  // Realtime subscription
  useEffect(() => {
    if (!selectedGuild?.id) return;
    const channel = supabase
      .channel(`dashboard-notifications_${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_notifications",
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        () => {
          for (const key of [
            "dashboard-notifications",
            "dashboard-unread-count",
            "operations-summary",
            "ops-alerts",
            "ops-alert-counts",
            "ops-alert-preview",
          ])
            void queryClient.invalidateQueries({
              queryKey: [key, selectedGuild.id],
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedGuild?.id) throw new Error("Ingen server valgt");
      const guildId = selectedGuild.id;
      const { data, error } = await supabase
        .from("dashboard_notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("guild_id", guildId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Notifikationen kunne ikke ændres. Kontrollér din adgang.",
        );
      return guildId;
    },
    onSuccess: refresh,
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) return;
      const { error } = await supabase
        .from("dashboard_notifications")
        .update({ is_read: true })
        .eq("guild_id", selectedGuild.id)
        .eq("is_read", false);
      if (error) throw error;
      return selectedGuild.id;
    },
    onSuccess: refresh,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "open" | "acknowledged" | "resolved";
    }) => {
      if (!selectedGuild?.id) return;
      const values: TablesUpdate<"dashboard_notifications"> = {
        status,
        is_read: true,
      };
      if (status === "acknowledged")
        values.acknowledged_at = new Date().toISOString();
      if (status === "resolved") values.resolved_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("dashboard_notifications")
        .update(values)
        .eq("id", id)
        .eq("guild_id", selectedGuild.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Notifikationen kunne ikke ændres. Kontrollér din adgang.",
        );
      return selectedGuild.id;
    },
    onSuccess: refresh,
  });

  const unreadCount = unreadQuery.isError ? null : (unreadQuery.data ?? null);

  return {
    notifications: query.data ?? [],
    unreadCount,
    error: query.error || unreadQuery.error,
    refetch: () => {
      void query.refetch();
      void unreadQuery.refetch();
    },
    isLoading: query.isLoading,
    markAsRead,
    markAllAsRead,
    updateStatus,
  };
}
