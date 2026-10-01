import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export const DEFAULT_DASHBOARD_WIDGETS = [
  'operations',
  'bot_status',
  'activity',
  'growth',
  'server_stats',
  'recent_activity',
] as const;

export type DashboardWidgetId = typeof DEFAULT_DASHBOARD_WIDGETS[number];

export function useDashboardPreferences() {
  const { user } = useAuth();
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-preferences', selectedGuild?.id, user?.id],
    enabled: !!selectedGuild?.id && !!user?.id,
    queryFn: async () => {
      if (!selectedGuild?.id || !user?.id) {
        return { widgets: [...DEFAULT_DASHBOARD_WIDGETS], compact_mode: false };
      }

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('widgets, compact_mode')
        .eq('guild_id', selectedGuild.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const widgets = Array.isArray(data?.widgets)
        ? data.widgets.filter((item): item is string => typeof item === 'string')
        : [...DEFAULT_DASHBOARD_WIDGETS];

      return {
        widgets: widgets.length ? widgets : [...DEFAULT_DASHBOARD_WIDGETS],
        compact_mode: Boolean(data?.compact_mode),
      };
    },
  });

  const save = useMutation({
    mutationFn: async ({
      widgets,
      compactMode,
    }: {
      widgets: string[];
      compactMode: boolean;
    }) => {
      if (!selectedGuild?.id || !user?.id) throw new Error('Bruger eller guild mangler');

      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert(
          {
            guild_id: selectedGuild.id,
            user_id: user.id,
            widgets,
            compact_mode: compactMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id,user_id' },
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['dashboard-preferences', selectedGuild?.id, user?.id],
      });
      toast.success('Dashboard-layout gemt');
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    widgets: query.data?.widgets ?? [...DEFAULT_DASHBOARD_WIDGETS],
    compactMode: query.data?.compact_mode ?? false,
    isLoading: query.isLoading,
    save,
  };
}
