import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface AfkStatus {
  id: string;
  guild_id: string;
  user_discord_id: string;
  user_name: string | null;
  message: string | null;
  set_at: string;
}

export function useAfkStatus() {
  const { selectedGuild } = useGuild();

  const afkQuery = useQuery({
    queryKey: ['afk-status', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('afk_status')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('set_at', { ascending: false });

      if (error) throw error;
      return data as AfkStatus[];
    },
    enabled: !!selectedGuild?.id,
  });

  return {
    afkUsers: afkQuery.data ?? [],
    isLoading: afkQuery.isLoading,
  };
}
