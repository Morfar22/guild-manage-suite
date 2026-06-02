import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface TemplateStep {
  points_threshold: number;
  action: 'mute' | 'kick' | 'ban';
  duration_hours?: number;
  reason?: string;
}

export interface ModerationTemplate {
  id: string;
  guild_id: string;
  name: string;
  steps: TemplateStep[];
  created_at: string;
  updated_at: string;
}

export interface CreateModerationTemplate {
  name: string;
  steps: TemplateStep[];
}

export function useModerationTemplates() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['moderation-templates', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('moderation_templates')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((t) => ({
        ...t,
        steps: t.steps as unknown as TemplateStep[],
      })) as ModerationTemplate[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: CreateModerationTemplate) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('moderation_templates')
        .insert({
          guild_id: selectedGuild.id,
          name: template.name,
          steps: template.steps as unknown as Json,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-templates', selectedGuild?.id] });
      toast({ title: 'Template oprettet' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ModerationTemplate> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.steps) {
        dbUpdates.steps = updates.steps as unknown as Json;
      }

      const { error } = await supabase
        .from('moderation_templates')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-templates', selectedGuild?.id] });
      toast({ title: 'Template opdateret' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('moderation_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-templates', selectedGuild?.id] });
      toast({ title: 'Template slettet' });
    },
  });

  return {
    templates: templatesQuery.data ?? [],
    isLoading: templatesQuery.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
