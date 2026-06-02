import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export type CharacterStatus = 'alive' | 'dead' | 'retired';

export interface Character {
  id: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string | null;
  name: string;
  age: number | null;
  background: string | null;
  faction: string | null;
  occupation: string | null;
  appearance: string | null;
  status: CharacterStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterStats {
  total: number;
  alive: number;
  dead: number;
  retired: number;
  uniquePlayers: number;
}

export function useCharacters(status?: CharacterStatus) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['characters', selectedGuild?.id, status],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      let query = supabase
        .from('characters')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Character[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useCharacterStats() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['character-stats', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data: characters, error } = await supabase
        .from('characters')
        .select('status, discord_user_id')
        .eq('guild_id', selectedGuild.id);

      if (error) throw error;

      const uniquePlayers = new Set(characters.map(c => c.discord_user_id)).size;

      const stats: CharacterStats = {
        total: characters.length,
        alive: characters.filter(c => c.status === 'alive').length,
        dead: characters.filter(c => c.status === 'dead').length,
        retired: characters.filter(c => c.status === 'retired').length,
        uniquePlayers,
      };

      return stats;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (character: Omit<Character, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('characters')
        .insert(character)
        .select()
        .single();

      if (error) throw error;
      return data as Character;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['character-stats', selectedGuild?.id] });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Character> & { id: string }) => {
      const { data, error } = await supabase
        .from('characters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Character;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['character-stats', selectedGuild?.id] });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['character-stats', selectedGuild?.id] });
    },
  });
}
