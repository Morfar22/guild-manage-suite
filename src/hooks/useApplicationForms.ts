import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface ApplicationQuestion {
  id: string;
  label: string;
  type: 'short' | 'long' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface ApplicationForm {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  questions: ApplicationQuestion[];
  required_role_id: string | null;
  granted_role_id: string | null;
  approval_channel_id: string | null;
  denial_channel_id: string | null;
  enabled: boolean;
  allow_reapply: boolean;
  reapply_cooldown_hours: number | null;
  created_at: string;
  updated_at: string;
}

export function useApplicationForms() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-forms', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('application_forms')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        questions: (d.questions || []) as unknown as ApplicationQuestion[],
      })) as ApplicationForm[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useApplicationForm(formId: string | undefined) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-form', formId],
    queryFn: async () => {
      if (!formId || !selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('application_forms')
        .select('*')
        .eq('id', formId)
        .eq('guild_id', selectedGuild.id)
        .single();

      if (error) throw error;
      return {
        ...data,
        questions: (data.questions || []) as unknown as ApplicationQuestion[],
      } as ApplicationForm;
    },
    enabled: !!formId && !!selectedGuild?.id,
  });
}

export function useCreateApplicationForm() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (form: Partial<Omit<ApplicationForm, 'id' | 'guild_id' | 'created_at' | 'updated_at'>>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await supabase
        .from('application_forms')
        .insert({
          name: form.name || 'Untitled',
          description: form.description,
          emoji: form.emoji,
          enabled: form.enabled,
          guild_id: selectedGuild.id,
          questions: (form.questions || []) as unknown as any,
          granted_role_id: form.granted_role_id,
          approval_channel_id: form.approval_channel_id,
          denial_channel_id: form.denial_channel_id,
          allow_reapply: form.allow_reapply,
          reapply_cooldown_hours: form.reapply_cooldown_hours,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-forms', selectedGuild?.id] });
      toast.success('Application form created');
    },
    onError: (error) => {
      toast.error('Failed to create form: ' + error.message);
    },
  });
}

export function useUpdateApplicationForm() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<ApplicationForm> & { id: string }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const updateData: Record<string, any> = {};
      if (form.name !== undefined) updateData.name = form.name;
      if (form.description !== undefined) updateData.description = form.description;
      if (form.emoji !== undefined) updateData.emoji = form.emoji;
      if (form.enabled !== undefined) updateData.enabled = form.enabled;
      if (form.questions !== undefined) updateData.questions = form.questions as unknown as any;
      if (form.granted_role_id !== undefined) updateData.granted_role_id = form.granted_role_id;
      if (form.approval_channel_id !== undefined) updateData.approval_channel_id = form.approval_channel_id;
      if (form.denial_channel_id !== undefined) updateData.denial_channel_id = form.denial_channel_id;
      if (form.allow_reapply !== undefined) updateData.allow_reapply = form.allow_reapply;
      if (form.reapply_cooldown_hours !== undefined) updateData.reapply_cooldown_hours = form.reapply_cooldown_hours;

      const { data, error } = await supabase
        .from('application_forms')
        .update(updateData)
        .eq('id', id)
        .eq('guild_id', selectedGuild.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['application-forms', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['application-form', data.id] });
      toast.success('Application form updated');
    },
    onError: (error) => {
      toast.error('Failed to update form: ' + error.message);
    },
  });
}

export function useDeleteApplicationForm() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (formId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { error } = await supabase
        .from('application_forms')
        .delete()
        .eq('id', formId)
        .eq('guild_id', selectedGuild.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-forms', selectedGuild?.id] });
      toast.success('Application form deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete form: ' + error.message);
    },
  });
}
