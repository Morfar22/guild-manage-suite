import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['discord-members', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return { members: [], roles: [] };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-members?guildId=${selectedGuild.id}&limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch members');
      }

      const result = await response.json();
      return {
        members: (result.members || []) as DiscordMember[],
        roles: (result.roles || []) as DiscordRole[],
      };
    },
    enabled: !!selectedGuild?.id,
    staleTime: 2 * 60 * 1000,
  });

  const toggleRole = useMutation({
    mutationFn: async ({ memberId, roleId, action }: { memberId: string; roleId: string; action: 'add' | 'remove' }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-members?guildId=${selectedGuild?.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId, roleId, action }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update role');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast.success(`Rolle ${variables.action === 'add' ? 'tilføjet' : 'fjernet'}!`);
      queryClient.invalidateQueries({ queryKey: ['discord-members', selectedGuild?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    members: membersQuery.data?.members || [],
    roles: membersQuery.data?.roles || [],
    loading: membersQuery.isLoading,
    error: membersQuery.error,
    toggleRole,
    refetch: membersQuery.refetch,
  };
}
