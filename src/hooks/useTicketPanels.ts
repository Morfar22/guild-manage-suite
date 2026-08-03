import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { invokeFunction } from '@/lib/functions-client';

export interface OperatingHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}
export interface OperatingHours {
  enabled: boolean;
  timezone?: string;
  closed_message?: string;
  days?: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', OperatingHoursDay>;
}

export interface TicketPanel {
  id: string;
  guild_id: string;
  name: string;
  channel_id: string | null;
  message_id: string | null;
  embed_title: string;
  embed_description: string;
  embed_color: number;
  embed_image_url: string | null;
  embed_thumbnail_url: string | null;
  embed_footer_text: string | null;
  component_style: 'select' | 'buttons';
  button_label: string;
  button_emoji: string;
  button_style: number;
  category_ids: string[];
  enabled: boolean;
  operating_hours: OperatingHours;
  created_at: string;
  updated_at: string;
}

export type PanelInput = Partial<Omit<TicketPanel, 'id' | 'guild_id' | 'created_at' | 'updated_at'>> & { name: string };

function transformPanel(row: any): TicketPanel {
  return {
    ...row,
    category_ids: Array.isArray(row.category_ids) ? row.category_ids : [],
    operating_hours: row.operating_hours || { enabled: false },
  };
}

export function useTicketPanels() {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['ticket-panels', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('ticket_panels' as any)
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[] || []).map(transformPanel);
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useCreatePanel() {
  const qc = useQueryClient();
  const { selectedGuild } = useGuild();
  return useMutation({
    mutationFn: async (input: PanelInput) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { data, error } = await supabase
        .from('ticket_panels' as any)
        .insert({ ...input, guild_id: selectedGuild.id } as any)
        .select()
        .single();
      if (error) throw error;
      return transformPanel(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-panels', selectedGuild?.id] }),
  });
}

export function useUpdatePanel() {
  const qc = useQueryClient();
  const { selectedGuild } = useGuild();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PanelInput & { id: string }) => {
      const { data, error } = await supabase
        .from('ticket_panels' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return transformPanel(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-panels', selectedGuild?.id] }),
  });
}

export function useDeletePanel() {
  const qc = useQueryClient();
  const { selectedGuild } = useGuild();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_panels' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-panels', selectedGuild?.id] }),
  });
}

export function useSendPanel() {
  const qc = useQueryClient();
  const { selectedGuild } = useGuild();
  return useMutation({
    mutationFn: async (panelId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { data, error } = await invokeFunction('send-ticket-panel', {
        body: { guild_id: selectedGuild.id, panel_id: panelId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-panels', selectedGuild?.id] }),
  });
}
