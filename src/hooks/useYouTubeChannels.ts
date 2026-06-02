import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface YouTubeChannel {
  id: string;
  guild_id: string;
  youtube_channel_id: string;
  channel_name: string | null;
  channel_url: string | null;
  profile_image_url: string | null;
  notification_channel_id: string;
  live_channel_id: string | null;
  mention_role_id: string | null;
  enabled: boolean;
  custom_message: string | null;
  last_video_id: string | null;
  last_check_at: string | null;
  is_live: boolean;
  last_live_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface YouTubeSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  new_video_message: string | null;
  live_message: string | null;
  offline_message: string | null;
  embed_color: string | null;
  live_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface YouTubeNotificationLog {
  id: string;
  guild_id: string;
  youtube_channel_db_id: string | null;
  youtube_channel_name: string | null;
  video_id: string | null;
  video_url: string | null;
  video_title: string | null;
  notification_type: string;
  channel_id: string | null;
  message_id: string | null;
  created_at: string;
}

export function useYouTubeChannels() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [settings, setSettings] = useState<YouTubeSettings | null>(null);
  const [logs, setLogs] = useState<YouTubeNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchChannels = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setChannels((data as unknown as YouTubeChannel[]) || []);
    } catch (error) {
      console.error('Error fetching YouTube channels:', error);
    }
  }, [selectedGuild?.id]);

  const fetchSettings = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('youtube_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      setSettings(data as unknown as YouTubeSettings | null);
    } catch (error) {
      console.error('Error fetching YouTube settings:', error);
    }
  }, [selectedGuild?.id]);

  const fetchLogs = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('youtube_notification_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs((data as unknown as YouTubeNotificationLog[]) || []);
    } catch (error) {
      console.error('Error fetching YouTube logs:', error);
    }
  }, [selectedGuild?.id]);

  useEffect(() => {
    if (!selectedGuild?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchChannels(), fetchSettings(), fetchLogs()]).finally(() => setLoading(false));
  }, [selectedGuild?.id, fetchChannels, fetchSettings, fetchLogs]);

  const addChannel = async (youtubeChannelId: string, channelName: string, notificationChannelId: string, mentionRoleId?: string, liveChannelId?: string): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('youtube_channels')
        .insert({
          guild_id: selectedGuild.id,
          youtube_channel_id: youtubeChannelId,
          channel_name: channelName || null,
          channel_url: `https://www.youtube.com/channel/${youtubeChannelId}`,
          notification_channel_id: notificationChannelId,
          live_channel_id: liveChannelId || null,
          mention_role_id: mentionRoleId || null,
        } as any);
      if (error) throw error;
      toast({ title: 'YouTube kanal tilføjet', description: `${channelName || youtubeChannelId} vil nu blive tracket.` });
      await fetchChannels();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunne ikke tilføje kanal';
      toast({
        title: 'Fejl',
        description: message.includes('duplicate') ? 'Denne YouTube kanal er allerede tilføjet.' : message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeChannel = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('youtube_channels').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'YouTube kanal fjernet', description: 'Kanalen vil ikke længere blive tracket.' });
      await fetchChannels();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke fjerne kanal.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateChannel = async (id: string, updates: Partial<YouTubeChannel>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('youtube_channels').update(updates as any).eq('id', id);
      if (error) throw error;
      toast({ title: 'Opdateret', description: 'YouTube kanal indstillinger blev gemt.' });
      await fetchChannels();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke opdatere kanal.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (newSettings: Partial<YouTubeSettings>): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase.from('youtube_settings').update(newSettings as any).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('youtube_settings').insert({ guild_id: selectedGuild.id, ...newSettings } as any);
        if (error) throw error;
      }
      toast({ title: 'Gemt', description: 'YouTube indstillinger blev gemt.' });
      await fetchSettings();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke gemme indstillinger.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    channels,
    settings,
    logs,
    loading,
    saving,
    addChannel,
    removeChannel,
    updateChannel,
    saveSettings,
    refetch: () => Promise.all([fetchChannels(), fetchSettings(), fetchLogs()]),
  };
}
