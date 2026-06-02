import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface SuggestionSettings {
  id: string;
  guild_id: string;
  channel_id: string | null;
  color: string;
  anonymous_mode: boolean;
  enabled: boolean;
}

export interface Suggestion {
  id: string;
  guild_id: string;
  message_id: string | null;
  channel_id: string | null;
  author_id: string;
  author_name: string | null;
  content: string;
  status: string;
  upvotes: number;
  downvotes: number;
  staff_response: string | null;
  responded_by: string | null;
  created_at: string;
}

export function useSuggestionSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['suggestion-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await supabase
        .from('suggestion_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SuggestionSettings | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Suggestion[];
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<SuggestionSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { data: existing } = await supabase
        .from('suggestion_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('suggestion_settings')
          .update(settings as any)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suggestion_settings')
          .insert({ guild_id: selectedGuild.id, ...settings } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion-settings'] });
      toast.success('Indstillinger gemt!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSuggestionStatus = useMutation({
    mutationFn: async ({ id, status, staff_response }: { id: string; status: string; staff_response?: string }) => {
      const { error } = await supabase
        .from('suggestions')
        .update({ status, staff_response } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Forslag opdateret!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    settings: settingsQuery.data,
    settingsLoading: settingsQuery.isLoading,
    suggestions: suggestionsQuery.data || [],
    suggestionsLoading: suggestionsQuery.isLoading,
    updateSettings,
    updateSuggestionStatus,
  };
}
