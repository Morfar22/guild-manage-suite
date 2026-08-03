import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useDiscordRoles } from './useDiscordRoles';

export interface RoleDistribution {
  name: string;
  color: string;
  count: number;
}

export function useRoleAnalytics() {
  const { selectedGuild } = useGuild();
  const rolesQuery = useDiscordRoles();

  // Get member counts per role from discord-members edge function
  const memberRolesQuery = useQuery({
    queryKey: ['role-analytics-members', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const response = await fetch(
        `/api/public/discord-members?guildId=${selectedGuild.id}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) return [];
      const result = await response.json();
      return result.members || [];
    },
    enabled: !!selectedGuild?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate role distribution
  const distribution: RoleDistribution[] = (() => {
    const roles = rolesQuery.data || [];
    const members = memberRolesQuery.data || [];
    if (!roles.length || !members.length) return [];

    const roleCounts = new Map<string, number>();
    for (const member of members) {
      const memberRoles = (member as any).roles || [];
      for (const roleId of memberRoles) {
        roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1);
      }
    }

    return roles
      .map((role: any) => ({
        name: role.name,
        color: `#${(role.color || 0x808080).toString(16).padStart(6, '0')}`,
        count: roleCounts.get(role.id) || 0,
      }))
      .filter((r: RoleDistribution) => r.name !== '@everyone' && r.count > 0)
      .sort((a: RoleDistribution, b: RoleDistribution) => b.count - a.count);
  })();

  return {
    distribution,
    totalRoles: rolesQuery.data?.length ?? 0,
    totalMembers: memberRolesQuery.data?.length ?? 0,
    isLoading: rolesQuery.isLoading || memberRolesQuery.isLoading,
  };
}
