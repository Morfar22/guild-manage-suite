import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface UserLevel {
  id: string;
  guild_id: string;
  user_id: string;
  discord_username: string | null;
  xp: number;
  level: number;
  total_messages: number;
  last_message_at: string | null;
  created_at: string;
}

export interface LevelRole {
  id: string;
  guild_id: string;
  level_required: number;
  role_id: string;
  role_name: string | null;
  created_at: string;
}

export interface LevelingSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  xp_per_message_min: number;
  xp_per_message_max: number;
  cooldown_seconds: number;
  level_up_channel_id: string | null;
  level_up_message: string | null;
  blacklist_channels: string[];
  voice_xp_enabled: boolean;
  voice_xp_per_minute: number;
  voice_xp_cooldown_seconds: number;
}

export interface XPMultiplier {
  id: string;
  guild_id: string;
  name: string;
  multiplier_type: 'role' | 'channel' | 'global';
  target_id: string | null;
  multiplier: number;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface RankCardSettings {
  id: string;
  guild_id: string;
  user_id: string;
  background_color: string;
  accent_color: string;
  text_color: string;
  progress_bar_color: string;
  background_image_url: string | null;
  show_rank: boolean;
  show_level: boolean;
}

export function useLeaderboard() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['leaderboard', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('xp', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as UserLevel[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useLevelRoles() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['level-roles', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('level_roles')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('level_required', { ascending: true });

      if (error) throw error;
      return data as LevelRole[];
    },
    enabled: !!selectedGuild?.id,
  });

  const addLevelRole = useMutation({
    mutationFn: async ({ level_required, role_id, role_name }: { level_required: number; role_id: string; role_name: string }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('level_roles')
        .insert({
          guild_id: selectedGuild.id,
          level_required,
          role_id,
          role_name,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['level-roles', selectedGuild?.id] });
      toast({ title: 'Level rolle tilføjet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLevelRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('level_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['level-roles', selectedGuild?.id] });
      toast({ title: 'Level rolle slettet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, addLevelRole, deleteLevelRole };
}

export function useLevelingSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['leveling-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('leveling_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as LevelingSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<LevelingSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('leveling_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('leveling_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('leveling_settings')
          .insert({
            guild_id: selectedGuild.id,
            ...settings,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leveling-settings', selectedGuild?.id] });
      toast({ title: 'Indstillinger gemt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, updateSettings };
}
