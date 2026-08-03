import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface AIChatSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  channel_id: string | null;
  system_prompt: string;
  max_history_messages: number;
  created_at: string;
  updated_at: string;
}

export interface AIChatHistory {
  id: string;
  guild_id: string;
  channel_id: string;
  user_id: string;
  user_name: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function useAIChatSettings() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-chat-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      
      const { data, error } = await supabase
        .from('ai_chat_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      return data as AIChatSettings | null;
    },
    enabled: !!selectedGuild?.id
  });

  const { data: history = [], refetch: refetchHistory, isRefetching: isRefetchingHistory } = useQuery({
    queryKey: ['ai-chat-history', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      
      const response = await fetch(
        `/api/public/ai-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_history',
            guildId: selectedGuild.id
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI chat history');
      }

      const data = await response.json();
      return data.history as AIChatHistory[];
    },
    enabled: !!selectedGuild?.id
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<AIChatSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const response = await fetch(
        `/api/public/ai-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_settings',
            guildId: selectedGuild.id,
            newSettings
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-settings', selectedGuild?.id] });
      toast.success('AI Chat indstillinger gemt!');
    },
    onError: (error) => {
      console.error('Error saving AI chat settings:', error);
      toast.error('Kunne ikke gemme indstillinger');
    }
  });

  const clearHistory = useMutation({
    mutationFn: async (channelId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const response = await fetch(
        `/api/public/ai-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'clear_history',
            guildId: selectedGuild.id,
            channelId
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history', selectedGuild?.id] });
      toast.success('Samtalehistorik slettet!');
    },
    onError: (error) => {
      console.error('Error clearing history:', error);
      toast.error('Kunne ikke slette historik');
    }
  });

  return {
    settings,
    history,
    isLoading,
    updateSettings,
    clearHistory,
    refetchHistory,
    isRefetchingHistory
  };
}
