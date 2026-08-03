import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { invokeFunction } from '@/lib/functions-client';

export interface InviteLeaderboardEntry {
  id: string;
  username: string;
  real: number;
  fake: number;
  left: number;
  total: number;
}

export interface InviteUseRow {
  id: string;
  invite_code: string | null;
  inviter_discord_id: string | null;
  inviter_username: string | null;
  joined_user_id: string;
  joined_username: string | null;
  joined_account_created_at: string | null;
  is_fake: boolean;
  has_left: boolean;
  left_at: string | null;
  joined_at: string;
}

export function useInviteLeaderboard() {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['invite-leaderboard', selectedGuild?.guild_id],
    queryFn: async (): Promise<InviteLeaderboardEntry[]> => {
      if (!selectedGuild?.guild_id) return [];
      const { data, error } = await invokeFunction('invite-tracker', {
        body: { action: 'getLeaderboard', data: { guildId: selectedGuild.guild_id } },
      });
      if (error) throw error;
      return data?.leaderboard ?? [];
    },
    enabled: !!selectedGuild?.guild_id,
    refetchInterval: 30000,
  });
}

export function useRecentInvites(limit = 50) {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['invite-recent', selectedGuild?.guild_id, limit],
    queryFn: async (): Promise<InviteUseRow[]> => {
      if (!selectedGuild?.guild_id) return [];
      const { data, error } = await invokeFunction('invite-tracker', {
        body: { action: 'getRecent', data: { guildId: selectedGuild.guild_id, limit } },
      });
      if (error) throw error;
      return data?.recent ?? [];
    },
    enabled: !!selectedGuild?.guild_id,
    refetchInterval: 30000,
  });
}
