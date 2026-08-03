import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/lib/functions-client';

export interface ReactionRole {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string;
  emoji: string;
  role_id: string;
  role_name: string | null;
  description: string | null;
  created_at: string;
}

export interface ReactionRolePanel {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  title: string;
  description: string | null;
  color: string | null;
  created_at: string;
}

export function useReactionRoles() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['reaction-roles', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('reaction_roles')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReactionRole[];
    },
    enabled: !!selectedGuild?.id,
  });

  const addReactionRole = useMutation({
    mutationFn: async (data: {
      channel_id: string;
      message_id: string;
      emoji: string;
      role_id: string;
      role_name: string;
      description?: string;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: result, error } = await supabase
        .from('reaction_roles')
        .insert({
          guild_id: selectedGuild.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-roles', selectedGuild?.id] });
      toast({ title: 'Reaction rolle tilføjet' });
    },
    onError: (error: Error) => {
      const isDuplicate = error.message.includes('duplicate key') || error.message.includes('23505');
      toast({ 
        title: isDuplicate ? 'Findes allerede' : 'Fejl', 
        description: isDuplicate 
          ? 'Denne emoji er allerede tilknyttet denne besked. Vælg en anden emoji eller besked.' 
          : error.message, 
        variant: 'destructive' 
      });
    },
  });

  const deleteReactionRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('reaction_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-roles', selectedGuild?.id] });
      toast({ title: 'Reaction rolle slettet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, addReactionRole, deleteReactionRole };
}

export function useReactionRolePanels() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['reaction-role-panels', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('reaction_role_panels')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReactionRolePanel[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createPanel = useMutation({
    mutationFn: async (data: { title: string; description?: string; color?: string }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: result, error } = await supabase
        .from('reaction_role_panels')
        .insert({
          guild_id: selectedGuild.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-role-panels', selectedGuild?.id] });
      toast({ title: 'Panel oprettet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const updatePanel = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; channel_id?: string; message_id?: string; title?: string; description?: string; color?: string }) => {
      const { data: result, error } = await supabase
        .from('reaction_role_panels')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-role-panels', selectedGuild?.id] });
      toast({ title: 'Panel opdateret' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deletePanel = useMutation({
    mutationFn: async (panelId: string) => {
      const { error } = await supabase
        .from('reaction_role_panels')
        .delete()
        .eq('id', panelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-role-panels', selectedGuild?.id] });
      toast({ title: 'Panel slettet' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const sendPanel = useMutation({
    mutationFn: async ({ panelId, channelId }: { panelId: string; channelId: string }) => {
      const { data, error } = await invokeFunction('reaction-role-handler', {
        body: {
          action: 'send_panel',
          panel_id: panelId,
          channel_id: channelId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-role-panels', selectedGuild?.id] });
      toast({ title: 'Panel sendt!', description: 'Embed er blevet sendt til Discord-kanalen' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  return { ...query, createPanel, updatePanel, deletePanel, sendPanel };
}
