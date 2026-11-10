import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuild } from "@/contexts/GuildContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  RoleUpdateError,
  retryAfterMilliseconds,
} from "@/lib/bulk-role-runner";

export interface DiscordMember {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    global_name: string | null;
  };
  nick: string | null;
  roles: string[];
  joined_at: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export function useDiscordMembers() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["discord-members", selectedGuild?.id, user?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return { members: [], roles: [] };

      const response = await fetch(
        `/api/public/discord-members?guildId=${selectedGuild.id}&limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch members");
      }

      const result = await response.json();
      return {
        members: (result.members || []) as DiscordMember[],
        roles: (result.roles || []) as DiscordRole[],
      };
    },
    enabled: !!selectedGuild?.id && !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const toggleRole = useMutation({
    mutationFn: async ({
      memberId,
      roleId,
      action,
      signal,
      guildId = selectedGuild?.id,
    }: {
      memberId: string;
      roleId: string;
      action: "add" | "remove";
      guildId?: string;
      signal?: AbortSignal;
      silent?: boolean;
    }) => {
      if (!guildId) throw new Error("Ingen server valgt");
      const response = await fetch(
        `/api/public/discord-members?guildId=${guildId}`,
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ memberId, roleId, action }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new RoleUpdateError(
          err.error || "Rollen kunne ikke ændres",
          response.status,
          response.status === 429
            ? retryAfterMilliseconds(response.headers.get("retry-after"), err)
            : 0,
        );
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      if (!variables.silent)
        toast.success(
          `Rolle ${variables.action === "add" ? "tilføjet" : "fjernet"}!`,
        );
      queryClient.invalidateQueries({
        queryKey: ["discord-members", variables.guildId ?? selectedGuild?.id],
        refetchType: variables.silent ? "none" : "active",
      });
    },
    onError: (error: Error, variables) => {
      if (!variables.silent && error.name !== "AbortError")
        toast.error(error.message);
    },
  });

  return {
    scopeKey: `${user?.id}:${selectedGuild?.id}`,
    guildId: selectedGuild?.id,
    members: membersQuery.data?.members || [],
    roles: membersQuery.data?.roles || [],
    loading: membersQuery.isLoading,
    error: membersQuery.error,
    toggleRole,
    refetch: membersQuery.refetch,
  };
}
