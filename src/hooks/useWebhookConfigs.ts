import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface WebhookConfig {
  id: string;
  guild_id: string;
  name: string;
  webhook_url: string;
  channel_id: string | null;
  channel_name: string | null;
  avatar_url: string | null;
  event_types: string[];
  enabled: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWebhookConfigs() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const key = ['webhook-configs', selectedGuild?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WebhookConfig[];
    },
    enabled: !!selectedGuild?.id,
  });

  const create = useMutation({
    mutationFn: async (config: Partial<WebhookConfig>) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('webhook_configs')
        .insert([{ ...config, guild_id: selectedGuild.id } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success('Webhook oprettet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<WebhookConfig> & { id: string }) => {
      const { error } = await supabase
        .from('webhook_configs')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success('Webhook opdateret');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success('Webhook slettet');
    },
    onError: (e) => toast.error(`Fejl: ${e.message}`),
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookUrl: string) => {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '✅ Test besked fra BotDash Dashboard!',
          username: 'BotDash Test',
        }),
      });
      if (!res.ok) throw new Error('Webhook test fejlede');
    },
    onSuccess: () => toast.success('Test besked sendt!'),
    onError: (e) => toast.error(`Test fejlede: ${e.message}`),
  });

  return {
    webhooks: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    testWebhook,
  };
}
