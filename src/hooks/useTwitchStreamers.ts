import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/lib/functions-client';

export interface TwitchStreamer {
  id: string;
  guild_id: string;
  twitch_username: string;
  twitch_user_id: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  notification_channel_id: string;
  mention_role_id: string | null;
  discord_user_id: string | null;
  is_live: boolean;
  last_stream_id: string | null;
  last_went_live_at: string | null;
  last_went_offline_at: string | null;
  // Partner quota fields
  is_partner?: boolean;
  quota_type?: 'streams' | 'hours' | 'both';
  quota_streams_per_week?: number;
  quota_hours_per_week?: number;
  current_week_streams?: number;
  current_week_minutes?: number;
  current_stream_started_at?: string | null;
  current_streak?: number;
  best_streak?: number;
  last_quota_reset_at?: string;
  warning_sent_this_week?: boolean;
  quota_met_this_week?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TwitchSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  live_message: string | null;
  offline_message: string | null;
  live_embed_color: string | null;
  offline_embed_color: string | null;
  show_game: boolean;
  show_viewers: boolean;
  show_thumbnail: boolean;
  notify_on_offline: boolean;
  live_role_id: string | null;
  clips_channel_id: string | null;
  vods_channel_id: string | null;
  highlights_channel_id: string | null;
  notify_clips: boolean;
  notify_vods: boolean;
  notify_highlights: boolean;
  clip_message: string | null;
  vod_message: string | null;
  highlight_message: string | null;
  // Partner tracking settings
  partner_tracking_enabled?: boolean;
  partner_staff_channel_id?: string | null;
  partner_warning_days_before?: number;
  partner_inactive_role_id?: string | null;
  partner_warning_dm?: string | null;
  partner_staff_alert_template?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export function useTwitchStreamers() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const [streamers, setStreamers] = useState<TwitchStreamer[]>([]);
  const [settings, setSettings] = useState<TwitchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStreamers = useCallback(async () => {
    if (!selectedGuild?.id) return;

    try {
      const { data, error } = await supabase
        .from('twitch_streamers')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStreamers((data as TwitchStreamer[]) || []);
    } catch (error) {
      console.error('Error fetching streamers:', error);
    }
  }, [selectedGuild?.id]);

  const fetchSettings = useCallback(async () => {
    if (!selectedGuild?.id) return;

    try {
      const { data, error } = await supabase
        .from('twitch_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data as TwitchSettings | null);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, [selectedGuild?.id]);

  useEffect(() => {
    if (!selectedGuild?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([fetchStreamers(), fetchSettings()]).finally(() => setLoading(false));

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`twitch-${selectedGuild.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'twitch_streamers',
        filter: `guild_id=eq.${selectedGuild.id}`,
      }, () => {
        fetchStreamers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, fetchStreamers, fetchSettings]);

  const lookupTwitchUser = async (username: string): Promise<TwitchUser | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await invokeFunction('twitch-handler', {
        body: { username },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data?.user || null;
    } catch (error) {
      console.error('Error looking up Twitch user:', error);
      return null;
    }
  };

  const addStreamer = async (
    twitchUsername: string,
    channelId: string,
    mentionRoleId?: string,
    discordUserId?: string
  ): Promise<boolean> => {
    if (!selectedGuild?.id) return false;

    setSaving(true);
    try {
      // Look up the Twitch user first
      const twitchUser = await lookupTwitchUser(twitchUsername);

      const { error } = await supabase
        .from('twitch_streamers')
        .insert({
          guild_id: selectedGuild.id,
          twitch_username: twitchUsername.toLowerCase(),
          twitch_user_id: twitchUser?.id || null,
          display_name: twitchUser?.display_name || null,
          profile_image_url: twitchUser?.profile_image_url || null,
          notification_channel_id: channelId,
          mention_role_id: mentionRoleId || null,
          discord_user_id: discordUserId || null,
        });

      if (error) throw error;

      toast({
        title: 'Streamer tilføjet',
        description: `${twitchUser?.display_name || twitchUsername} vil nu blive tracket.`,
      });

      await fetchStreamers();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunne ikke tilføje streamer';
      toast({
        title: 'Fejl',
        description: message.includes('duplicate') ? 'Denne streamer er allerede tilføjet.' : message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeStreamer = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('twitch_streamers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Streamer fjernet',
        description: 'Streameren vil ikke længere blive tracket.',
      });

      await fetchStreamers();
      return true;
    } catch (error) {
      toast({
        title: 'Fejl',
        description: 'Kunne ikke fjerne streamer.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateStreamer = async (id: string, updates: Partial<TwitchStreamer>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('twitch_streamers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Opdateret',
        description: 'Streamer indstillinger blev gemt.',
      });

      await fetchStreamers();
      return true;
    } catch (error) {
      toast({
        title: 'Fejl',
        description: 'Kunne ikke opdatere streamer.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (newSettings: Partial<TwitchSettings>): Promise<boolean> => {
    if (!selectedGuild?.id) return false;

    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('twitch_settings')
          .update(newSettings)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('twitch_settings')
          .insert({ guild_id: selectedGuild.id, ...newSettings });

        if (error) throw error;
      }

      toast({
        title: 'Gemt',
        description: 'Twitch indstillinger blev gemt.',
      });

      await fetchSettings();
      return true;
    } catch (error) {
      toast({
        title: 'Fejl',
        description: 'Kunne ikke gemme indstillinger.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    streamers,
    settings,
    loading,
    saving,
    addStreamer,
    removeStreamer,
    updateStreamer,
    saveSettings,
    lookupTwitchUser,
    refetch: () => Promise.all([fetchStreamers(), fetchSettings()]),
  };
}
