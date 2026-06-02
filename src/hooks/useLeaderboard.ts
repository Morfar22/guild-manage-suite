import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  discord_username: string | null;
  xp: number;
  level: number;
  total_messages: number;
  last_message_at: string | null;
}

export function useLeaderboard(limit = 50) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['leaderboard', selectedGuild?.id, limit],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('user_levels')
        .select('id, user_id, discord_username, xp, level, total_messages, last_message_at')
        .eq('guild_id', selectedGuild.id)
        .order('xp', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as LeaderboardEntry[];
    },
    enabled: !!selectedGuild?.id,
  });
}
