import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import type { OperatingHours } from './useTicketPanels';

export interface TicketSettings {
  id: string;
  guild_id: string;
  panel_channel_id: string | null;
  thread_category_id: string | null;
  panel_message_id: string | null;
  transcript_channel_id: string | null;
  enable_ratings: boolean;
  enable_transcripts: boolean;
  dm_transcript_to_user: boolean;
  ratings_dm_prompt: string | null;
  operating_hours: OperatingHours;
  created_at: string;
  updated_at: string;
}

export function useTicketSettings() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['ticket-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('ticket_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        operating_hours: (data as any).operating_hours || { enabled: false },
      } as TicketSettings;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpsertTicketSettings() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<TicketSettings, 'id' | 'guild_id' | 'created_at' | 'updated_at'>>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: existing } = await supabase
        .from('ticket_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('ticket_settings')
          .update(settings as any)
          .eq('guild_id', selectedGuild.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('ticket_settings')
          .insert({ ...(settings as any), guild_id: selectedGuild.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-settings', selectedGuild?.id] });
    },
  });
}

// Legacy - kept for backward compat with PanelSettingsCard (deprecated)
export function useSendTicketPanel() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { data, error } = await supabase.functions.invoke('send-ticket-panel', {
        body: { guild_id: selectedGuild.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-settings', selectedGuild?.id] });
    },
  });
}
