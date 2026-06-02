import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Manages the global "automod bypass" role list on a guild.
 * Members with any of these roles are ignored by ALL automod systems
 * (rules, AI toxicity, raid protection, alt detection).
 */
export function useAutomodBypassRoles() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['automod-bypass-roles', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [] as string[];
      const { data, error } = await supabase
        .from('guilds')
        .select('automod_bypass_role_ids')
        .eq('id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.automod_bypass_role_ids ?? []) as string[];
    },
    enabled: !!selectedGuild?.id,
  });

  const update = useMutation({
    mutationFn: async (roleIds: string[]) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { error } = await supabase
        .from('guilds')
        .update({ automod_bypass_role_ids: roleIds })
        .eq('id', selectedGuild.id);
      if (error) throw error;
      return roleIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automod-bypass-roles', selectedGuild?.id] });
      toast({ title: 'Bypass-roller opdateret' });
    },
    onError: (e: Error) => toast({ title: 'Fejl', description: e.message, variant: 'destructive' }),
  });

  return { ...query, update };
}
