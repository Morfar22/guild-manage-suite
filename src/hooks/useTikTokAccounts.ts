import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TikTokAccount {
  id: string;
  guild_id: string;
  tiktok_username: string;
  display_name: string | null;
  profile_image_url: string | null;
  notification_channel_id: string;
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

export interface TikTokSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  new_video_message: string | null;
  embed_color: string | null;
  auto_embed_links: boolean;
  live_notifications: boolean;
  live_message: string | null;
  offline_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TikTokNotificationLog {
  id: string;
  guild_id: string;
  tiktok_account_id: string;
  tiktok_username: string;
  video_id: string | null;
  video_url: string | null;
  video_title: string | null;
  notification_type: string;
  channel_id: string | null;
  message_id: string | null;
  created_at: string;
}

export function useTikTokAccounts() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [settings, setSettings] = useState<TikTokSettings | null>(null);
  const [logs, setLogs] = useState<TikTokNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('tiktok_accounts')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts((data as unknown as TikTokAccount[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok accounts:', error);
    }
  }, [selectedGuild?.id]);

  const fetchSettings = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('tiktok_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      setSettings(data as unknown as TikTokSettings | null);
    } catch (error) {
      console.error('Error fetching TikTok settings:', error);
    }
  }, [selectedGuild?.id]);

  const fetchLogs = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('tiktok_notification_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs((data as unknown as TikTokNotificationLog[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok logs:', error);
    }
  }, [selectedGuild?.id]);

  useEffect(() => {
    if (!selectedGuild?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchAccounts(), fetchSettings(), fetchLogs()]).finally(() => setLoading(false));
  }, [selectedGuild?.id, fetchAccounts, fetchSettings, fetchLogs]);

  const addAccount = async (username: string, channelId: string, mentionRoleId?: string): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tiktok_accounts')
        .insert({
          guild_id: selectedGuild.id,
          tiktok_username: username.toLowerCase().replace('@', ''),
          display_name: username,
          notification_channel_id: channelId,
          mention_role_id: mentionRoleId || null,
        } as any);
      if (error) throw error;
      toast({ title: 'TikTok konto tilføjet', description: `@${username} vil nu blive tracket.` });
      await fetchAccounts();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunne ikke tilføje konto';
      toast({
        title: 'Fejl',
        description: message.includes('duplicate') ? 'Denne TikTok konto er allerede tilføjet.' : message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('tiktok_accounts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'TikTok konto fjernet', description: 'Kontoen vil ikke længere blive tracket.' });
      await fetchAccounts();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke fjerne konto.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = async (id: string, updates: Partial<TikTokAccount>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('tiktok_accounts').update(updates as any).eq('id', id);
      if (error) throw error;
      toast({ title: 'Opdateret', description: 'TikTok konto indstillinger blev gemt.' });
      await fetchAccounts();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke opdatere konto.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (newSettings: Partial<TikTokSettings>): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase.from('tiktok_settings').update(newSettings as any).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tiktok_settings').insert({ guild_id: selectedGuild.id, ...newSettings } as any);
        if (error) throw error;
      }
      toast({ title: 'Gemt', description: 'TikTok indstillinger blev gemt.' });
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
    accounts,
    settings,
    logs,
    loading,
    saving,
    addAccount,
    removeAccount,
    updateAccount,
    saveSettings,
    refetch: () => Promise.all([fetchAccounts(), fetchSettings(), fetchLogs()]),
  };
}
