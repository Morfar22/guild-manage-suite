import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeFunction } from '@/lib/functions-client';

export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      // Check if user has admin OR staff role.
      // IMPORTANT: The DB enum may not include 'staff' yet in some environments;
      // use the database function that safely compares role::text.
      const { data, error } = await supabase.rpc('has_admin_or_staff_role', { _user_id: user.id });

      if (error) {
        console.error('Error checking admin/staff role:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id,
  });
}

export function useAllUsers() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // This requires admin role - the edge function will verify
      const { data, error } = await invokeFunction('admin-users', {
        body: { action: 'list' },
      });

      if (error) throw error;
      return data.users as Array<{ id: string; email: string; created_at: string }>;
    },
    enabled: !!user && !!isAdmin,
  });
}

export function useAllGuilds() {
  return useQuery({
    queryKey: ['all-guilds-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guilds')
        .select('*')
        .order('guild_name');

      if (error) throw error;
      return data;
    },
  });
}

export function useUserGuilds(userId: string | null) {
  return useQuery({
    queryKey: ['user-guilds-admin', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('user_guilds')
        .select(`
          *,
          guilds:guild_id (id, guild_name, guild_icon)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useAssignGuildToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, guildId, discordUserId }: { userId: string; guildId: string; discordUserId: string }) => {
      const { data, error } = await supabase
        .from('user_guilds')
        .upsert({
          user_id: userId,
          guild_id: guildId,
          discord_user_id: discordUserId,
          has_admin_permission: true,
        }, {
          onConflict: 'user_id,guild_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-guilds-admin', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-guilds-admin'] });
    },
  });
}

export function useRemoveGuildFromUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, guildId }: { userId: string; guildId: string }) => {
      const { error } = await supabase
        .from('user_guilds')
        .delete()
        .eq('user_id', userId)
        .eq('guild_id', guildId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-guilds-admin', variables.userId] });
    },
  });
}
