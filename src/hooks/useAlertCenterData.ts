import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";
import { useAuth } from "@/contexts/AuthContext";

export const ALERT_PAGE_SIZE = 40;
export type AlertStatusFilter =
  "active" | "open" | "acknowledged" | "resolved" | "all";

// PostgREST quoted values keep commas/parentheses in search text as data.
export function alertSearchFilter(input: string) {
  const escaped = input
    .trim()
    .slice(0, 200)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const value = '"%' + escaped + '%"';
  return ["title", "message", "source"]
    .map((column) => `${column}.ilike.${value}`)
    .join(",");
}

export function useAlertCenterData() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id,
    userId = user?.id,
    scope = `${userId}:${guildId}`;
  const [selection, setSelection] = useState({
    scope,
    status: "active" as AlertStatusFilter,
    search: "",
    page: 0,
  });
  const current =
    selection.scope === scope
      ? selection
      : { scope, status: "active" as AlertStatusFilter, search: "", page: 0 };
  const enabled = !!guildId && !!userId;
  const setStatus = (status: AlertStatusFilter) =>
    setSelection({ ...current, status, page: 0 });
  const setSearch = (search: string) =>
    setSelection({ ...current, search: search.slice(0, 200), page: 0 });
  const setPage = (page: number) =>
    setSelection({ ...current, page: Math.max(0, page) });
  const query = useQuery({
    queryKey: [
      "ops-alerts",
      guildId,
      userId,
      current.status,
      current.search,
      current.page,
    ],
    enabled,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      let request = supabase
        .from("dashboard_notifications")
        .select("*", { count: "exact" })
        .eq("guild_id", guildId!);
      if (current.status === "active")
        request = request.neq("status", "resolved");
      else if (current.status !== "all")
        request = request.eq("status", current.status);
      if (current.search.trim())
        request = request.or(alertSearchFilter(current.search));
      const from = current.page * ALERT_PAGE_SIZE;
      const { data, error, count } = await request
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + ALERT_PAGE_SIZE - 1)
        .abortSignal(signal);
      if (error) throw error;
      if (count == null) throw new Error("Alertoptælling er ikke tilgængelig");
      return { rows: data ?? [], count };
    },
  });
  const counts = useQuery({
    queryKey: ["ops-alert-counts", guildId, userId],
    enabled,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const count = async (critical: boolean) => {
        let request = supabase
          .from("dashboard_notifications")
          .select("id", { count: "exact", head: true })
          .eq("guild_id", guildId!)
          .neq("status", "resolved");
        if (critical) request = request.eq("severity", "critical");
        const { count, error } = await request.abortSignal(signal);
        if (error) throw error;
        if (count == null)
          throw new Error("Alertoptælling er ikke tilgængelig");
        return count;
      };
      const [active, critical] = await Promise.all([count(false), count(true)]);
      return { active, critical };
    },
  });
  const preview = useQuery({
    queryKey: ["ops-alert-preview", guildId, userId],
    enabled,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("dashboard_notifications")
        .select("*")
        .eq("guild_id", guildId!)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(6)
        .abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
  });
  const pageCount = Math.max(
    1,
    Math.ceil((query.data?.count ?? 0) / ALERT_PAGE_SIZE),
  );
  useEffect(() => {
    if (query.data)
      setSelection((previous) =>
        previous.scope === scope && previous.page >= pageCount
          ? { ...previous, page: pageCount - 1 }
          : previous,
      );
  }, [query.data, pageCount, scope]);
  const retry = () => {
    void query.refetch();
    void counts.refetch();
    void preview.refetch();
  };
  const refresh = (targetGuildId = guildId) => {
    for (const key of [
      "ops-alerts",
      "ops-alert-counts",
      "ops-alert-preview",
      "operations-summary",
      "dashboard-notifications",
      "dashboard-unread-count",
    ])
      void qc.invalidateQueries({ queryKey: [key, targetGuildId] });
  };
  return {
    query,
    counts,
    preview,
    status: current.status,
    search: current.search,
    page: current.page,
    pageCount,
    setStatus,
    setSearch,
    setPage,
    retry,
    refresh,
  };
}
