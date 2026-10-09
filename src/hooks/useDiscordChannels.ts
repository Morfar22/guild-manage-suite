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

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(
        `/api/public/discord-channels?guildId=${selectedGuild.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch channels');
      }

      const payload = await response.json();
      if (!Array.isArray(payload.channels) || !Array.isArray(payload.categories)) {
        throw new Error('Invalid channels response from server');
      }
      return payload;
    },
    enabled: !!selectedGuild?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: (count, error) => count < 2 && !/Unauthorized|Forbidden|session|bot token|not a member/i.test(error.message),
  });
}
