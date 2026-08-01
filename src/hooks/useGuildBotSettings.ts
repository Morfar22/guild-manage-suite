import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface GuildBotSettings {
  id: string;
  guild_id: string;
  is_custom_bot: boolean;
  bot_token_masked?: string;
  bot_client_id?: string;
  bot_public_key?: string;
  bot_name?: string;
  bot_avatar_url?: string;
  bot_status?: string;
  bot_activity_type?: string;
  bot_activity_text?: string;
  is_active: boolean;
  last_connected_at?: string;
  global_ban_opt_out?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateBotSettingsData {
  is_custom_bot?: boolean;
  bot_token?: string;
  bot_client_id?: string;
  bot_public_key?: string;
  bot_name?: string;
  bot_avatar_url?: string;
  bot_status?: string;
  bot_activity_type?: string;
  bot_activity_text?: string;
  is_active?: boolean;
  global_ban_opt_out?: boolean;
}

export interface BotTestResult {
  valid: boolean;
  error?: string;
  details?: string;
  bot?: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    avatar_url: string | null;
  };
}

export interface ActiveBot {
  guild_id: string;
  guild_name: string;
  guild_icon?: string;
  is_online: boolean;
  latency_ms: number;
  member_count: number;
  last_heartbeat?: string;
  is_custom_bot: boolean;
  bot_name: string;
  bot_avatar_url?: string;
}

export function useGuildBotSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild-bot-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config?guild_id=${selectedGuild.id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch bot settings');
      }

      const result = await response.json();
      return result.settings as GuildBotSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateBotSettingsData) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config?guild_id=${selectedGuild.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update bot settings');
      }

      const result = await response.json();
      return result.settings as GuildBotSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-bot-settings', selectedGuild?.id] });
      toast.success('Bot indstillinger gemt');
    },
    onError: (error) => {
      console.error('Error updating bot settings:', error);
      toast.error('Kunne ikke gemme bot indstillinger');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config?guild_id=${selectedGuild.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete bot settings');
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-bot-settings', selectedGuild?.id] });
      toast.success('Custom bot indstillinger slettet');
    },
    onError: (error) => {
      console.error('Error deleting bot settings:', error);
      toast.error('Kunne ikke slette bot indstillinger');
    },
  });

  const testTokenMutation = useMutation({
    mutationFn: async (token: string): Promise<BotTestResult> => {
      const { data, error } = await supabase.functions.invoke('guild-bot-config', {
        body: { action: 'test_token', token },
      });

      if (error) throw error;
      return data as BotTestResult;
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings: updateMutation.mutate,
    deleteSettings: deleteMutation.mutate,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    testToken: testTokenMutation.mutateAsync,
    isTestingToken: testTokenMutation.isPending,
    testResult: testTokenMutation.data,
  };
}

// Hook to get all active bots status
export function useActiveBots() {
  return useQuery({
    queryKey: ['active-bots'],
    queryFn: async (): Promise<ActiveBot[]> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_status' }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to fetch active bots';
        try {
          const errorData = await response.json();
          errorMsg = errorData?.error || errorMsg;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      return (result as { bots?: ActiveBot[] })?.bots || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Admin-only hook to get ALL bots across all guilds
export interface AdminBotStatus extends ActiveBot {
  discord_guild_id?: string;
  owner_id?: string;
  updated_at?: string;
  custom_bot_active?: boolean;
}

export interface AdminBotStats {
  total: number;
  online: number;
  offline: number;
}

export function useAdminAllBots() {
  return useQuery({
    queryKey: ['admin-all-bots'],
    queryFn: async (): Promise<{ bots: AdminBotStatus[]; stats: AdminBotStats }> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'admin_get_all_bots' }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to fetch all bots';
        try {
          const errorData = await response.json();
          errorMsg = errorData?.error || errorMsg;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      return {
        bots: result.bots || [],
        stats: result.stats || { total: 0, online: 0, offline: 0 },
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Admin: Leave a guild (remove bot from server)
export function useAdminLeaveGuild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guildId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/guild-bot-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'admin_leave_guild', guild_id: guildId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to leave guild');
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-bots'] });
      toast.success('Botten er fjernet fra serveren');
    },
    onError: (error) => {
      console.error('Error leaving guild:', error);
      toast.error('Kunne ikke fjerne botten fra serveren');
    },
  });
}
