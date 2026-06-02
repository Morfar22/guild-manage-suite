import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export type AutomodRuleType = 'spam' | 'links' | 'words' | 'mentions' | 'caps' | 'invites' | 'ai_toxicity';
export type AutomodAction = 'warn' | 'mute' | 'kick' | 'ban' | 'delete';

export interface AutomodRule {
  id: string;
  guild_id: string;
  rule_type: AutomodRuleType;
  enabled: boolean;
  config: Record<string, unknown>;
  action: AutomodAction;
  action_duration_seconds: number | null;
  exempt_roles: string[];
  exempt_channels: string[];
  created_at: string;
}

export interface AutomodLog {
  id: string;
  guild_id: string;
  rule_type: AutomodRuleType;
  user_id: string;
  user_name: string | null;
  channel_id: string | null;
  message_content: string | null;
  action_taken: AutomodAction;
  created_at: string;
}

export const RULE_TYPE_INFO: Record<AutomodRuleType, { label: string; description: string; defaultConfig: Record<string, unknown> }> = {
  spam: {
    label: 'Spam Detection',
    description: 'Detekter og fjern spam-beskeder (gentagne beskeder)',
    defaultConfig: { max_messages: 5, time_window_seconds: 5 },
  },
  links: {
    label: 'Link Filter',
    description: 'Bloker links til uønskede domæner',
    defaultConfig: { block_all: false, blocked_domains: [], allowed_domains: [] },
  },
  words: {
    label: 'Banned Words',
    description: 'Filtrer beskeder med forbudte ord',
    defaultConfig: { words: [], match_exact: false },
  },
  mentions: {
    label: 'Mention Spam',
    description: 'Begræns antallet af mentions i en besked',
    defaultConfig: { max_mentions: 5, max_role_mentions: 3 },
  },
  caps: {
    label: 'Caps Lock',
    description: 'Begræns brug af CAPS LOCK i beskeder',
    defaultConfig: { max_caps_percent: 70, min_length: 10 },
  },
  invites: {
    label: 'Discord Invites',
    description: 'Bloker Discord server invites',
    defaultConfig: { block_all: true, allowed_servers: [] },
  },
  ai_toxicity: {
    label: 'AI Toxicity Filter',
    description: 'AI-baseret analyse for toxicity, hate speech, spam og NSFW-indhold',
    defaultConfig: { sensitivity: 70 },
  },
};

export function useAutomodRules() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['automod-rules', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('automod_rules')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('rule_type', { ascending: true });

      if (error) throw error;
      return data as AutomodRule[];
    },
    enabled: !!selectedGuild?.id,
  });

  const upsertRule = useMutation({
    mutationFn: async (data: {
      rule_type: AutomodRuleType;
      enabled?: boolean;
      config?: Record<string, unknown>;
      action?: AutomodAction;
      action_duration_seconds?: number | null;
      exempt_roles?: string[];
      exempt_channels?: string[];
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Check if rule exists
      const { data: existing } = await supabase
        .from('automod_rules')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .eq('rule_type', data.rule_type)
        .maybeSingle();

      const configJson = data.config ? JSON.parse(JSON.stringify(data.config)) : undefined;

      if (existing) {
        const { data: result, error } = await supabase
          .from('automod_rules')
          .update({
            ...data,
            config: configJson,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return result;
      } else {
        const defaultConfig = JSON.parse(JSON.stringify(RULE_TYPE_INFO[data.rule_type].defaultConfig));
        const { data: result, error } = await supabase
          .from('automod_rules')
          .insert({
            guild_id: selectedGuild.id,
            rule_type: data.rule_type,
            enabled: data.enabled ?? true,
            config: configJson || defaultConfig,
            action: data.action || 'warn',
            action_duration_seconds: data.action_duration_seconds,
            exempt_roles: data.exempt_roles || [],
            exempt_channels: data.exempt_channels || [],
          })
          .select()
          .single();

        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automod-rules', selectedGuild?.id] });
      toast({ title: 'Regel gemt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('automod_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automod-rules', selectedGuild?.id] });
      toast({ title: 'Regel slettet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, upsertRule, deleteRule };
}

export function useAutomodLogs() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['automod-logs', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('automod_logs')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AutomodLog[];
    },
    enabled: !!selectedGuild?.id,
  });
}
