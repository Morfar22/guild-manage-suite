import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TwitchScheduleEntry {
  id: string;
  guild_id: string;
  streamer_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  title: string | null;
  game_name: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  streamer_name?: string;
  streamer_avatar?: string;
  twitch_username?: string;
}

export interface TwitchScheduleSettings {
  id: string;
  guild_id: string;
  auto_post_enabled: boolean;
  post_channel_id: string | null;
  post_day: number;
  post_time: string;
  last_posted_at: string | null;
  fetch_from_twitch: boolean;
  created_at: string;
  updated_at: string;
}

export interface TwitchUpcomingSegment {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  category?: { id: string; name: string };
  is_recurring: boolean;
  canceled_until: string | null;
}

const DAY_NAMES = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

export { DAY_NAMES };

export function useTwitchSchedule() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TwitchScheduleEntry[]>([]);
  const [settings, setSettings] = useState<TwitchScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('twitch_stream_schedules')
        .select(`*, twitch_streamers (display_name, profile_image_url, twitch_username)`)
        .eq('guild_id', selectedGuild.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEntries(
        (data || []).map((e: any) => ({
          ...e,
          streamer_name: e.twitch_streamers?.display_name,
          streamer_avatar: e.twitch_streamers?.profile_image_url,
          twitch_username: e.twitch_streamers?.twitch_username,
        }))
      );
    } catch (err) {
      console.error('Error fetching schedule entries:', err);
    }
  }, [selectedGuild?.id]);

  const fetchSettings = useCallback(async () => {
    if (!selectedGuild?.id) return;
    try {
      const { data, error } = await supabase
        .from('twitch_schedule_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      setSettings(data as TwitchScheduleSettings | null);
    } catch (err) {
      console.error('Error fetching schedule settings:', err);
    }
  }, [selectedGuild?.id]);

  useEffect(() => {
    if (!selectedGuild?.id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchEntries(), fetchSettings()]).finally(() => setLoading(false));
  }, [selectedGuild?.id, fetchEntries, fetchSettings]);

  const addEntry = async (entry: {
    streamer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    title?: string;
    game_name?: string;
  }): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase.from('twitch_stream_schedules').insert({
        guild_id: selectedGuild.id,
        ...entry,
      });
      if (error) throw error;
      toast({ title: 'Tilføjet', description: 'Skema-indgang blev tilføjet.' });
      await fetchEntries();
      return true;
    } catch (err) {
      toast({ title: 'Fejl', description: 'Kunne ikke tilføje skema-indgang.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = async (id: string, updates: Partial<TwitchScheduleEntry>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('twitch_stream_schedules').update(updates).eq('id', id);
      if (error) throw error;
      toast({ title: 'Opdateret', description: 'Skema-indgang blev opdateret.' });
      await fetchEntries();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke opdatere.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from('twitch_stream_schedules').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Fjernet', description: 'Skema-indgang blev fjernet.' });
      await fetchEntries();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke fjerne.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (newSettings: Partial<TwitchScheduleSettings>): Promise<boolean> => {
    if (!selectedGuild?.id) return false;
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase.from('twitch_schedule_settings').update(newSettings).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('twitch_schedule_settings').insert({ guild_id: selectedGuild.id, ...newSettings });
        if (error) throw error;
      }
      toast({ title: 'Gemt', description: 'Skema-indstillinger blev gemt.' });
      await fetchSettings();
      return true;
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke gemme indstillinger.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { entries, settings, loading, saving, addEntry, updateEntry, removeEntry, saveSettings, refetch: () => Promise.all([fetchEntries(), fetchSettings()]) };
}
