import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

export interface DiscordCategory {
  id: string;
  name: string;
  type: number;
}

interface ChannelsResponse {
  channels: DiscordChannel[];
  categories: DiscordCategory[];
}

export function useDiscordChannels() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['discord-channels', selectedGuild?.id],
    queryFn: async (): Promise<ChannelsResponse> => {
      if (!selectedGuild?.id) return { channels: [], categories: [] };

      const response = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/discord-channels?guildId=${selectedGuild.id}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch channels');
      }

      return response.json();
    },
    enabled: !!selectedGuild?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
