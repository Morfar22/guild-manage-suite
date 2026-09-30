import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { invokeFunction } from '@/lib/functions-client';

const FIVEM_SETTINGS_PUBLIC_COLUMNS = [
  'id',
  'guild_id',
  'enabled',
  'server_name',
  'server_ip',
  'cfx_code',
  'whitelist_enabled',
  'auto_whitelist_role_id',
  'whitelisted_role_id',
  'sync_discord_roles',
  'sync_playtime',
  'log_channel_id',
  'whitelist_application_form_id',
  'status_webhook_url',
  'log_webhook_url',
  'staff_chat_channel_id',
  'announcement_channel_id',
  'staff_role_ids',
  'mod_role_ids',
  'admin_role_ids',
  'god_role_ids',
  'bridge_token_created_at',
  'bridge_last_seen_at',
  'bridge_version',
  'bridge_framework',
  'created_at',
  'updated_at',
].join(',');


export interface FiveMSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  server_name: string | null;
  server_ip: string | null;
  cfx_code: string | null;
  whitelist_enabled: boolean;
  auto_whitelist_role_id: string | null;
  whitelisted_role_id: string | null;
  sync_discord_roles: boolean;
  sync_playtime: boolean;
  log_channel_id: string | null;
  whitelist_application_form_id: string | null;
  status_webhook_url: string | null;
  log_webhook_url: string | null;
  staff_chat_channel_id: string | null;
  announcement_channel_id: string | null;
  staff_role_ids: string[] | null;
  mod_role_ids: string[] | null;
  admin_role_ids: string[] | null;
  god_role_ids: string[] | null;
  bridge_token_created_at: string | null;
  bridge_last_seen_at: string | null;
  bridge_version: string | null;
  bridge_framework: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiveMWhitelistEntry {
  id: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string | null;
  steam_hex: string | null;
  license: string | null;
  discord_id: string | null;
  fivem_id: string | null;
  ip_address: string | null;
  is_whitelisted: boolean;
  whitelist_reason: string | null;
  whitelisted_by: string | null;
  whitelisted_at: string | null;
  last_seen_at: string | null;
  playtime_minutes: number;
  priority_level: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiveMBan {
  id: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string | null;
  steam_hex: string | null;
  license: string | null;
  ip_address: string | null;
  reason: string;
  banned_by_discord_id: string;
  banned_by_name: string | null;
  banned_at: string;
  expires_at: string | null;
  is_active: boolean;
  unbanned_at: string | null;
  unbanned_by: string | null;
}

export interface FiveMOnlinePlayer {
  id: string;
  guild_id: string;
  server_id: string;
  player_id: number;
  discord_user_id: string | null;
  discord_username: string | null;
  steam_hex: string | null;
  license: string | null;
  character_name: string | null;
  ping: number | null;
  coords: { x: number; y: number; z: number } | null;
  joined_at: string;
  last_update: string;
}

export interface FiveMActionLog {
  id: string;
  guild_id: string;
  action_type: string;
  target_discord_id: string | null;
  target_name: string | null;
  moderator_discord_id: string;
  moderator_name: string | null;
  reason: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FiveMRolePermission {
  id: string;
  guild_id: string;
  discord_role_id: string;
  discord_role_name: string | null;
  permission_level: string;
  ace_permissions: string[] | null;
  created_at: string;
  updated_at: string;
}

// Settings hooks
export function useFiveMSettings() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('fivem_settings')
        .select(FIVEM_SETTINGS_PUBLIC_COLUMNS)
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as FiveMSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpdateFiveMSettings() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (settings: Partial<FiveMSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('fivem_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('fivem_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select(FIVEM_SETTINGS_PUBLIC_COLUMNS)
          .single();

        if (error) throw error;
        return data as FiveMSettings;
      } else {
        const { data, error } = await supabase
          .from('fivem_settings')
          .insert({ ...settings, guild_id: selectedGuild.id })
          .select(FIVEM_SETTINGS_PUBLIC_COLUMNS)
          .single();

        if (error) throw error;
        return data as FiveMSettings;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-settings', selectedGuild?.id] });
    },
  });
}

// Whitelist hooks
export function useFiveMWhitelist() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-whitelist', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('fivem_whitelist')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FiveMWhitelistEntry[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useAddToWhitelist() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (entry: Omit<Partial<FiveMWhitelistEntry>, 'guild_id' | 'id'>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('fivem_whitelist')
        .insert({ 
          discord_user_id: entry.discord_user_id!,
          discord_username: entry.discord_username,
          steam_hex: entry.steam_hex,
          license: entry.license,
          discord_id: entry.discord_id,
          fivem_id: entry.fivem_id,
          ip_address: entry.ip_address,
          is_whitelisted: entry.is_whitelisted ?? false,
          whitelist_reason: entry.whitelist_reason,
          whitelisted_by: entry.whitelisted_by,
          whitelisted_at: entry.whitelisted_at,
          notes: entry.notes,
          priority_level: entry.priority_level,
          guild_id: selectedGuild.id 
        })
        .select()
        .single();

      if (error) throw error;
      return data as FiveMWhitelistEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-whitelist', selectedGuild?.id] });
    },
  });
}

export function useUpdateWhitelistEntry() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FiveMWhitelistEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('fivem_whitelist')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as FiveMWhitelistEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-whitelist', selectedGuild?.id] });
    },
  });
}

export function useRemoveFromWhitelist() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fivem_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-whitelist', selectedGuild?.id] });
    },
  });
}

// Bans hooks
export function useFiveMBans() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-bans', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('fivem_bans')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('banned_at', { ascending: false });

      if (error) throw error;
      return data as FiveMBan[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useAddBan() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (ban: Omit<FiveMBan, 'id' | 'guild_id' | 'banned_at' | 'is_active' | 'unbanned_at' | 'unbanned_by'>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('fivem_bans')
        .insert({
          ...ban,
          guild_id: selectedGuild.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as FiveMBan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-bans', selectedGuild?.id] });
    },
  });
}

export function useUnban() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({ id, unbannedBy }: { id: string; unbannedBy: string }) => {
      const { error } = await supabase
        .from('fivem_bans')
        .update({
          is_active: false,
          unbanned_at: new Date().toISOString(),
          unbanned_by: unbannedBy,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-bans', selectedGuild?.id] });
    },
  });
}

// Online players hooks
export function useFiveMOnlinePlayers() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-online-players', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      // Keep the player list on the same active FiveM instance the dashboard
      // command endpoint will target. This avoids duplicate player IDs from
      // multiple servers (e.g. main + event) under the same Discord guild.
      const { data: activeStatus } = await supabase
        .from('fivem_server_status')
        .select('server_id, last_heartbeat')
        .eq('guild_id', selectedGuild.id)
        .order('last_heartbeat', { ascending: false })
        .limit(1)
        .maybeSingle();

      const serverId = activeStatus?.server_id || 'main';
      const freshnessCutoff = new Date(Date.now() - 45_000).toISOString();
      const { data, error } = await supabase
        .from('fivem_online_players')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .eq('server_id', serverId)
        .gte('last_update', freshnessCutoff)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      return data as FiveMOnlinePlayer[];
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15000,
  });
}

// Action logs hooks
export function useFiveMActionLogs(limit = 50) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-action-logs', selectedGuild?.id, limit],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('fivem_action_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as FiveMActionLog[];
    },
    enabled: !!selectedGuild?.id,
  });
}

// Role permissions hooks
export function useFiveMRolePermissions() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-role-permissions', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('fivem_role_permissions')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('permission_level', { ascending: false });

      if (error) throw error;
      return data as FiveMRolePermission[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (permission: Omit<FiveMRolePermission, 'id' | 'guild_id' | 'created_at' | 'updated_at'>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('fivem_role_permissions')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .eq('discord_role_id', permission.discord_role_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('fivem_role_permissions')
          .update({
            ...permission,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as FiveMRolePermission;
      } else {
        const { data, error } = await supabase
          .from('fivem_role_permissions')
          .insert({
            ...permission,
            guild_id: selectedGuild.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data as FiveMRolePermission;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-role-permissions', selectedGuild?.id] });
    },
  });
}

export function useDeleteRolePermission() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fivem_role_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-role-permissions', selectedGuild?.id] });
    },
  });
}

// Stats hook
export function useFiveMStats() {
  const { selectedGuild } = useGuild();
  const { data: whitelist } = useFiveMWhitelist();
  const { data: bans } = useFiveMBans();
  const { data: onlinePlayers } = useFiveMOnlinePlayers();

  const totalPlayers = whitelist?.length || 0;
  const whitelistedPlayers = whitelist?.filter(p => p.is_whitelisted).length || 0;
  const pendingPlayers = whitelist?.filter(p => !p.is_whitelisted).length || 0;
  const totalPlaytime = whitelist?.reduce((acc, p) => acc + (p.playtime_minutes || 0), 0) || 0;
  const activeBans = bans?.filter(b => b.is_active).length || 0;
  const onlineCount = onlinePlayers?.length || 0;

  return {
    totalPlayers,
    whitelistedPlayers,
    pendingPlayers,
    totalPlaytime,
    activeBans,
    onlineCount,
  };
}

// Register FiveM slash commands
export function useRegisterFiveMCommands() {
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (action: 'register' | 'unregister' | 'list') => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error('Not authenticated');

      const response = await invokeFunction('register-fivem-commands', {
        body: { guild_id: selectedGuild.id, action },
      });

      if (response.error) throw response.error;
      return response.data;
    },
  });
}

// Execute FiveM command from dashboard
export function useExecuteFiveMCommand() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (command: {
      name: string;
      targetPlayerId?: number;
      targetDiscordId?: string;
      targetName?: string;
      reason?: string;
      duration?: string;
      message?: string;
      coords?: { x: number; y: number; z: number };
      location?: string;
      amount?: number;
      type?: string;
      item?: string;
      count?: number;
      weather?: string;
      hour?: number;
      vehicleCode?: string;
      plate?: string;
      job?: string;
      gang?: string;
      grade?: number;
      resource?: string;
      resourceName?: string;
      permission?: string;
      action?: string;
      discordId?: string;
      weapon?: string;
      ammo?: number;
      model?: string;
      title?: string;
      color?: string;
      time?: number;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error('Not authenticated');

      // Get user info for logging
      const moderatorName = session.session.user.user_metadata?.full_name || 
                           session.session.user.email || 
                           'Dashboard';
      const moderatorDiscordId = session.session.user.user_metadata?.provider_id || 'dashboard';

      // Execute command via FiveM handler
      const response = await invokeFunction('execute-fivem-command', {
        body: { 
          guild_id: selectedGuild.id, 
          command: command.name,
          data: {
            ...command,
            moderatorName,
            moderatorDiscordId,
          }
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-action-logs', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['fivem-online-players', selectedGuild?.id] });
    },
  });
}

// Get list of available FiveM commands
export function useFiveMCommandList() {
  return useQuery({
    queryKey: ['fivem-commands-list'],
    queryFn: async () => {
      // Return command definitions grouped by category
      return {
        standalone: [
          { name: 'announcement', description: 'Send announcement til alle spillere', permission: 'mod', params: ['message'] },
          { name: 'kick', description: 'Kick en spiller', permission: 'mod', params: ['id', 'reason?'] },
          { name: 'kickall', description: 'Kick alle spillere', permission: 'admin', params: ['reason'] },
          { name: 'kill', description: 'Dræb en spiller', permission: 'admin', params: ['id'] },
          { name: 'message', description: 'Send privat besked', permission: 'mod', params: ['id', 'message'] },
          { name: 'onlinecount', description: 'Vis antal online', permission: 'user', params: [] },
          { name: 'players', description: 'List alle online spillere', permission: 'mod', params: [] },
          { name: 'teleport', description: 'Teleporter en spiller', permission: 'mod', params: ['id', 'coords/location'] },
          { name: 'teleport-all', description: 'Teleporter alle spillere', permission: 'god', params: ['coords/location'] },
          { name: 'screenshot', description: 'Tag screenshot af spiller', permission: 'god', params: ['id'] },
          { name: 'server', description: 'Vis server info', permission: 'user', params: [] },
          { name: 'whitelist', description: 'Administrer whitelist', permission: 'god', params: ['action', 'value?'] },
          { name: 'resource', description: 'Administrer resources', permission: 'god', params: ['action', 'name?'] },
          { name: 'embed', description: 'Send embed besked', permission: 'god', params: ['channel', 'message', 'title?'] },
          { name: 'identifiers', description: 'Vis spiller identifiers', permission: 'admin', params: ['id'] },
        ],
        qbcore: [
          { name: 'ban', description: 'Ban en spiller', permission: 'admin', params: ['id', 'duration', 'reason'] },
          { name: 'revive', description: 'Genopliv en spiller', permission: 'admin', params: ['id'] },
          { name: 'revive-all', description: 'Genopliv alle', permission: 'god', params: [] },
          { name: 'money', description: 'Administrer penge', permission: 'admin', params: ['action', 'id', 'type', 'amount'] },
          { name: 'inventory', description: 'Administrer inventory', permission: 'admin', params: ['action', 'id', 'item?', 'count?'] },
          { name: 'job', description: 'Administrer job', permission: 'admin', params: ['action', 'id', 'job?', 'grade?'] },
          { name: 'gang', description: 'Administrer gang', permission: 'admin', params: ['action', 'id', 'gang?', 'grade?'] },
          { name: 'jail', description: 'Sæt spiller i fængsel', permission: 'mod', params: ['action', 'id', 'time?'] },
          { name: 'vehicle', description: 'Spawn køretøj', permission: 'god', params: ['action', 'id?', 'spawncode?', 'plate?'] },
          { name: 'weather', description: 'Sæt vejr', permission: 'admin', params: ['action', 'weather?'] },
          { name: 'time', description: 'Sæt server tid', permission: 'admin', params: ['hour'] },
          { name: 'logout', description: 'Tving logout', permission: 'admin', params: ['id'] },
          { name: 'clothing-menu', description: 'Åbn tøjmenu', permission: 'admin', params: ['id'] },
          { name: 'permissions', description: 'Administrer permissions', permission: 'god', params: ['action', 'id', 'permission?'] },
        ],
      };
    },
    staleTime: Infinity,
  });
}

export interface FiveMBridgeStatus {
  configured: boolean;
  enabled: boolean;
  tokenCreatedAt: string | null;
  lastSeenAt: string | null;
  bridgeVersion: string | null;
  framework: string | null;
  discordGuildId: string;
  guildName: string;
  apiBase: string;
}

export interface FiveMBridgeKeyResult {
  success: boolean;
  token: string;
  discordGuildId: string;
  guildName: string;
  apiBase: string;
  warning: string;
}

export function useFiveMBridgeStatus() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['fivem-bridge-status', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await invokeFunction<FiveMBridgeStatus>('fivem-setup-key', {
        body: { guild_id: selectedGuild.id, action: 'status' },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15_000,
  });
}

export function useRotateFiveMBridgeKey() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { data, error } = await invokeFunction<FiveMBridgeKeyResult>('fivem-setup-key', {
        body: { guild_id: selectedGuild.id, action: 'rotate' },
      });
      if (error) throw error;
      if (!data?.token) throw new Error('Bridge key was not returned');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-bridge-status', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['fivem-settings', selectedGuild?.id] });
    },
  });
}

export function useRevokeFiveMBridgeKey() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { data, error } = await invokeFunction<{ success: boolean }>('fivem-setup-key', {
        body: { guild_id: selectedGuild.id, action: 'revoke' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fivem-bridge-status', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['fivem-settings', selectedGuild?.id] });
    },
  });
}

