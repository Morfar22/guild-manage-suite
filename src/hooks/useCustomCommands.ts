import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

export interface CustomCommand {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger: string;
  response_type: string;
  response_content: string | null;
  response_embed: Record<string, unknown> | null;
  response_options: unknown[];
  role_id: string | null;
  enabled: boolean;
  cooldown_seconds: number;
  required_role_id: string | null;
  allowed_channels: string[];
  allowed_role_ids: string[];
  blocked_role_ids: string[];
  blocked_channel_ids: string[];
  conditions: Record<string, unknown>;
  response_buttons: unknown[];
  response_selects: unknown[];
  usage_count: number;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomCommand {
  name: string;
  description?: string;
  trigger_type?: string;
  trigger: string;
  response_type?: string;
  response_content?: string;
  response_embed?: Record<string, unknown>;
  response_options?: unknown[];
  role_id?: string;
  cooldown_seconds?: number;
  required_role_id?: string;
  allowed_channels?: string[];
  allowed_role_ids?: string[];
  blocked_role_ids?: string[];
  blocked_channel_ids?: string[];
  conditions?: Record<string, unknown>;
  response_buttons?: unknown[];
  response_selects?: unknown[];
}

export function useCustomCommands() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['custom-commands', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomCommand[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createCommand = useMutation({
    mutationFn: async (cmd: CreateCustomCommand) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { error } = await supabase
        .from('custom_commands')
        .insert({
          guild_id: selectedGuild.id,
          name: cmd.name,
          trigger: cmd.trigger,
          trigger_type: cmd.trigger_type ?? 'command',
          response_type: cmd.response_type ?? 'text',
          response_content: cmd.response_content ?? null,
          response_embed: cmd.response_embed ? JSON.parse(JSON.stringify(cmd.response_embed)) : null,
          cooldown_seconds: cmd.cooldown_seconds ?? 0,
          description: cmd.description ?? null,
          role_id: cmd.role_id ?? null,
          required_role_id: cmd.required_role_id ?? null,
          allowed_channels: cmd.allowed_channels ?? [],
          allowed_role_ids: cmd.allowed_role_ids ?? [],
          blocked_role_ids: cmd.blocked_role_ids ?? [],
          blocked_channel_ids: cmd.blocked_channel_ids ?? [],
          conditions: cmd.conditions ? JSON.parse(JSON.stringify(cmd.conditions)) : {},
          response_buttons: cmd.response_buttons ? JSON.parse(JSON.stringify(cmd.response_buttons)) : [],
          response_selects: cmd.response_selects ? JSON.parse(JSON.stringify(cmd.response_selects)) : [],
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-commands', selectedGuild?.id] });
      toast({ title: 'Kommando oprettet' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const updateCommand = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomCommand> & { id: string }) => {
      const cleanUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (k === 'response_embed' && v) {
          cleanUpdates[k] = JSON.parse(JSON.stringify(v));
        } else {
          cleanUpdates[k] = v;
        }
      }
      const { error } = await supabase
        .from('custom_commands')
        .update(cleanUpdates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-commands', selectedGuild?.id] });
      toast({ title: 'Kommando opdateret' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCommand = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_commands')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-commands', selectedGuild?.id] });
      toast({ title: 'Kommando slettet' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return {
    commands: query.data ?? [],
    isLoading: query.isLoading,
    createCommand,
    updateCommand,
    deleteCommand,
  };
}
