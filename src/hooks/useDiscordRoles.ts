import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export function useDiscordRoles() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['discord-roles', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-roles?guildId=${selectedGuild.id}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch roles');
      }

      const result = await response.json();
      return (result.roles || []) as DiscordRole[];
    },
    enabled: !!selectedGuild?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
