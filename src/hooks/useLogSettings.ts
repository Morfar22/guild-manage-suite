import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface LogSettings {
  id: string;
  guild_id: string;
  log_channel_id: string | null;
  boost_channel_id: string | null;
  log_member_join: boolean;
  log_member_leave: boolean;
  log_member_ban: boolean;
  log_member_unban: boolean;
  log_member_kick: boolean;
  log_member_timeout: boolean;
  log_member_untimeout: boolean;
  log_message_delete: boolean;
  log_message_edit: boolean;
  log_message_bulk_delete: boolean;
  log_message_pin: boolean;
  log_message_unpin: boolean;
  log_role_create: boolean;
  log_role_delete: boolean;
  log_role_update: boolean;
  log_role_add: boolean;
  log_role_remove: boolean;
  log_channel_create: boolean;
  log_channel_delete: boolean;
  log_channel_update: boolean;
  log_voice_join: boolean;
  log_voice_leave: boolean;
  log_voice_move: boolean;
  log_voice_server_mute: boolean;
  log_voice_server_deafen: boolean;
  log_member_voice_move: boolean;
  log_screen_share_start: boolean;
  log_screen_share_stop: boolean;
  log_nickname_change: boolean;
  log_avatar_change: boolean;
  log_invite_create: boolean;
  log_invite_delete: boolean;
  log_emoji_create: boolean;
  log_emoji_delete: boolean;
  log_emoji_update: boolean;
  log_thread_create: boolean;
  log_thread_delete: boolean;
  log_thread_archive: boolean;
  log_server_boost: boolean;
  log_server_boost_remove: boolean;
  log_server_update: boolean;
  log_command_used: boolean;
  log_sticker_create: boolean;
  log_sticker_delete: boolean;
  created_at: string;
  updated_at: string;
}

export type LogSettingKey = keyof Omit<LogSettings, 'id' | 'guild_id' | 'log_channel_id' | 'created_at' | 'updated_at'>;

export const LOG_CATEGORIES = {
  members: {
    label: 'Medlemmer',
    icon: 'Users',
    settings: [
      { key: 'log_member_join' as LogSettingKey, label: 'Medlem joiner', description: 'Log når nye medlemmer joiner serveren' },
      { key: 'log_member_leave' as LogSettingKey, label: 'Medlem forlader', description: 'Log når medlemmer forlader serveren (viser roller)' },
      { key: 'log_member_ban' as LogSettingKey, label: 'Medlem bannet', description: 'Log når medlemmer bliver bannet (viser moderator)' },
      { key: 'log_member_unban' as LogSettingKey, label: 'Medlem unbanned', description: 'Log når medlemmer bliver unbanned (viser moderator)' },
      { key: 'log_member_kick' as LogSettingKey, label: 'Medlem kicket', description: 'Log når medlemmer bliver kicket (viser moderator)' },
      { key: 'log_member_timeout' as LogSettingKey, label: 'Medlem timet ud', description: 'Log når medlemmer får timeout (viser varighed og moderator)' },
      { key: 'log_member_untimeout' as LogSettingKey, label: 'Timeout fjernet', description: 'Log når timeout fjernes fra et medlem' },
      { key: 'log_nickname_change' as LogSettingKey, label: 'Nickname ændring', description: 'Log når nicknames ændres (viser hvem der ændrede)' },
      { key: 'log_avatar_change' as LogSettingKey, label: 'Avatar ændring', description: 'Log når medlemmer ændrer avatar' },
    ],
  },
  messages: {
    label: 'Beskeder',
    icon: 'MessageSquare',
    settings: [
      { key: 'log_message_delete' as LogSettingKey, label: 'Besked slettet', description: 'Log slettede beskeder (viser hvem der slettede)' },
      { key: 'log_message_edit' as LogSettingKey, label: 'Besked redigeret', description: 'Log redigerede beskeder med link til original' },
      { key: 'log_message_bulk_delete' as LogSettingKey, label: 'Bulk sletning', description: 'Log når flere beskeder slettes på en gang' },
      { key: 'log_message_pin' as LogSettingKey, label: 'Besked pinned', description: 'Log når beskeder pinnes i en kanal' },
      { key: 'log_message_unpin' as LogSettingKey, label: 'Besked unpinned', description: 'Log når beskeder unpinnes fra en kanal' },
    ],
  },
  roles: {
    label: 'Roller',
    icon: 'Shield',
    settings: [
      { key: 'log_role_create' as LogSettingKey, label: 'Rolle oprettet', description: 'Log nye roller (viser hvem der oprettede)' },
      { key: 'log_role_delete' as LogSettingKey, label: 'Rolle slettet', description: 'Log slettede roller (viser hvem der slettede)' },
      { key: 'log_role_update' as LogSettingKey, label: 'Rolle opdateret', description: 'Log rolleændringer (navn, farve, tilladelser)' },
      { key: 'log_role_add' as LogSettingKey, label: 'Rolle tildelt', description: 'Log rolletildelinger (viser hvem der tildelte)' },
      { key: 'log_role_remove' as LogSettingKey, label: 'Rolle fjernet', description: 'Log rollefjerninger (viser hvem der fjernede)' },
    ],
  },
  channels: {
    label: 'Kanaler',
    icon: 'Hash',
    settings: [
      { key: 'log_channel_create' as LogSettingKey, label: 'Kanal oprettet', description: 'Log nye kanaler (viser hvem der oprettede)' },
      { key: 'log_channel_delete' as LogSettingKey, label: 'Kanal slettet', description: 'Log slettede kanaler (viser hvem der slettede)' },
      { key: 'log_channel_update' as LogSettingKey, label: 'Kanal opdateret', description: 'Log kanalændringer (navn, emne, slowmode)' },
    ],
  },
  voice: {
    label: 'Voice',
    icon: 'Mic',
    settings: [
      { key: 'log_voice_join' as LogSettingKey, label: 'Voice join', description: 'Log når medlemmer joiner voice kanaler' },
      { key: 'log_voice_leave' as LogSettingKey, label: 'Voice leave', description: 'Log når medlemmer forlader voice kanaler' },
      { key: 'log_voice_move' as LogSettingKey, label: 'Voice move', description: 'Log når medlemmer skifter voice kanal' },
      { key: 'log_member_voice_move' as LogSettingKey, label: 'Medlem flyttet', description: 'Log når en moderator flytter en bruger i voice' },
      { key: 'log_voice_server_mute' as LogSettingKey, label: 'Server mute', description: 'Log når en bruger bliver server mutet/unmutet' },
      { key: 'log_voice_server_deafen' as LogSettingKey, label: 'Server deafen', description: 'Log når en bruger bliver server deafened/undeafened' },
      { key: 'log_screen_share_start' as LogSettingKey, label: 'Skærmdeling start', description: 'Log når skærmdeling startes' },
      { key: 'log_screen_share_stop' as LogSettingKey, label: 'Skærmdeling stop', description: 'Log når skærmdeling stoppes' },
    ],
  },
  threads: {
    label: 'Tråde',
    icon: 'MessageCircle',
    settings: [
      { key: 'log_thread_create' as LogSettingKey, label: 'Tråd oprettet', description: 'Log når nye tråde oprettes' },
      { key: 'log_thread_delete' as LogSettingKey, label: 'Tråd slettet', description: 'Log når tråde slettes' },
      { key: 'log_thread_archive' as LogSettingKey, label: 'Tråd arkiveret', description: 'Log når tråde arkiveres' },
    ],
  },
  emojis: {
    label: 'Emojis & Stickers',
    icon: 'Smile',
    settings: [
      { key: 'log_emoji_create' as LogSettingKey, label: 'Emoji oprettet', description: 'Log når nye emojis oprettes' },
      { key: 'log_emoji_delete' as LogSettingKey, label: 'Emoji slettet', description: 'Log når emojis slettes' },
      { key: 'log_emoji_update' as LogSettingKey, label: 'Emoji opdateret', description: 'Log når emojis ændres' },
      { key: 'log_sticker_create' as LogSettingKey, label: 'Sticker oprettet', description: 'Log når nye stickers oprettes' },
      { key: 'log_sticker_delete' as LogSettingKey, label: 'Sticker slettet', description: 'Log når stickers slettes' },
    ],
  },
  server: {
    label: 'Server',
    icon: 'Settings',
    settings: [
      { key: 'log_server_update' as LogSettingKey, label: 'Server ændringer', description: 'Log ændringer til serverindstillinger (navn, ikon, etc.)' },
      { key: 'log_server_boost' as LogSettingKey, label: 'Server boost', description: 'Log når en bruger booster serveren' },
      { key: 'log_server_boost_remove' as LogSettingKey, label: 'Boost fjernet', description: 'Log når en bruger stopper med at booste' },
      { key: 'log_invite_create' as LogSettingKey, label: 'Invite oprettet', description: 'Log når nye invites oprettes' },
      { key: 'log_invite_delete' as LogSettingKey, label: 'Invite slettet', description: 'Log når invites slettes' },
      { key: 'log_command_used' as LogSettingKey, label: 'Kommando brugt', description: 'Log når slash-kommandoer bruges' },
    ],
  },
};

export function useLogSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['log-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('log_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as LogSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<LogSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('log_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('log_settings')
          .update(settings)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('log_settings')
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
      queryClient.invalidateQueries({ queryKey: ['log-settings', selectedGuild?.id] });
      toast({ title: 'Indstillinger gemt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, updateSettings };
}
