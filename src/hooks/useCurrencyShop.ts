import type { TablesUpdate } from "@/integrations/supabase/types";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";
import { toast } from "sonner";

export interface ShopOrder {
  id: string;
  user_id: string;
  user_name: string | null;
  item_name: string;
  price: number;
  status:
    | "rejected"
    | "pending"
    | "processing"
    | "delivered"
    | "refunded"
    | "manual_review";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
}

export function useCurrencyShop() {
  const { selectedGuild } = useGuild();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id;
  const [orderCursor, setOrderCursor] = useState<{
    guildId: string | undefined;
    page: number;
    filter: "attention" | "all";
  }>({ guildId, page: 0, filter: "attention" });
  const cursor =
    orderCursor.guildId === guildId
      ? orderCursor
      : { guildId, page: 0, filter: "attention" as const };
  const ordersQuery = useQuery({
    queryKey: ["shop-orders", guildId, cursor.page, cursor.filter],
    queryFn: async () => {
      // New migration-owned table: regenerate the Supabase types after rollout.
      const client = supabase as unknown as SupabaseClient;
      let query = client
        .from("bot_shop_orders")
        .select(
          "id,user_id,user_name,item_name,price,status,attempt_count,last_error,created_at",
          { count: "exact" },
        )
        .eq("guild_id", guildId!)
        .order("created_at", { ascending: false });
      if (cursor.filter === "attention")
        query = query.in("status", ["pending", "processing", "manual_review"]);
      const { data, count, error } = await query.range(
        cursor.page * 25,
        cursor.page * 25 + 24,
      );
      if (error) throw error;
      return { rows: (data || []) as ShopOrder[], count: count || 0 };
    },
    enabled: !!guildId,
    refetchInterval: 15000,
  });

  const itemsQuery = useQuery({
    queryKey: ["shop-items", guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from("economy_shop_items")
        .select("*")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const purchasesQuery = useQuery({
    queryKey: ["shop-purchases", guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from("economy_purchases")
        .select("*, economy_shop_items(name, price)")
        .eq("guild_id", guildId)
        .order("purchased_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!guildId,
  });

  const createItem = useMutation({
    mutationFn: async (item: {
      name: string;
      description?: string;
      price: number;
      role_id?: string;
      stock?: number;
    }) => {
      if (!guildId) throw new Error("No guild");
      const { error } = await supabase
        .from("economy_shop_items")
        .insert({ guild_id: guildId, ...item });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-items", guildId] });
      toast.success("Vare oprettet");
    },
    onError: () => toast.error("Kunne ikke oprette"),
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & TablesUpdate<"economy_shop_items">) => {
      const { error } = await supabase
        .from("economy_shop_items")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-items", guildId] });
      toast.success("Vare opdateret");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("economy_shop_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-items", guildId] });
      toast.success("Vare slettet");
    },
  });

  return {
    items: itemsQuery.data || [],
    purchases: purchasesQuery.data || [],
    orders: ordersQuery.data?.rows || [],
    ordersCount: ordersQuery.data?.count || 0,
    ordersPage: cursor.page,
    ordersFilter: cursor.filter,
    setOrdersPage: (page: number) => setOrderCursor({ ...cursor, page }),
    setOrdersFilter: (filter: "attention" | "all") =>
      setOrderCursor({ guildId, page: 0, filter }),
    ordersLoading: ordersQuery.isLoading,
    ordersError: ordersQuery.isError,
    refreshOrders: ordersQuery.refetch,
    isLoading: itemsQuery.isLoading,
    createItem,
    updateItem,
    deleteItem,
  };
}
