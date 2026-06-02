import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface WarningThreshold {
  points: number;
  action: 'mute' | 'kick' | 'ban';
  duration_hours?: number;
}

export interface WarningSettings {
  id: string;
  guild_id: string;
  enabled: boolean;
  points_per_warn: number;
  decay_days: number | null;
  thresholds: WarningThreshold[];
  created_at: string;
  updated_at: string;
}

export interface Warning {
  id: string;
  guild_id: string;
  user_id: string;
  user_name: string | null;
  moderator_id: string;
  moderator_name: string | null;
  reason: string | null;
  points: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export function useWarningSettings() {
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['warning-settings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data, error } = await supabase
        .from('warning_settings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        thresholds: data.thresholds as unknown as WarningThreshold[],
      } as WarningSettings;
    },
    enabled: !!selectedGuild?.id,
  });

  const warningsQuery = useQuery({
    queryKey: ['warnings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Warning[];
    },
    enabled: !!selectedGuild?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<WarningSettings>) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Convert thresholds to Json type for Supabase
      const dbSettings = {
        ...settings,
        thresholds: settings.thresholds as unknown as Json,
      };

      const { data: existing } = await supabase
        .from('warning_settings')
        .select('id')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('warning_settings')
          .update(dbSettings)
          .eq('guild_id', selectedGuild.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warning_settings')
          .insert({ guild_id: selectedGuild.id, ...dbSettings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warning-settings', selectedGuild?.id] });
      toast({ title: 'Warning-indstillinger gemt' });
    },
    onError: (error) => {
      toast({ title: 'Fejl', description: error.message, variant: 'destructive' });
    },
  });

  const deactivateWarning = useMutation({
    mutationFn: async (warningId: string) => {
      const { error } = await supabase
        .from('warnings')
        .update({ active: false })
        .eq('id', warningId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warnings', selectedGuild?.id] });
      toast({ title: 'Advarsel deaktiveret' });
    },
  });

  // Group warnings by user
  const warningsByUser = warningsQuery.data?.reduce((acc, warning) => {
    if (!acc[warning.user_id]) {
      acc[warning.user_id] = {
        user_id: warning.user_id,
        user_name: warning.user_name,
        warnings: [],
        total_points: 0,
      };
    }
    acc[warning.user_id].warnings.push(warning);
    acc[warning.user_id].total_points += warning.points;
    return acc;
  }, {} as Record<string, { user_id: string; user_name: string | null; warnings: Warning[]; total_points: number }>);

  return {
    settings: settingsQuery.data,
    warnings: warningsQuery.data ?? [],
    warningsByUser: Object.values(warningsByUser ?? {}),
    isLoading: settingsQuery.isLoading,
    updateSettings,
    deactivateWarning,
  };
}
