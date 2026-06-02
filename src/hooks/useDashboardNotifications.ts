import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useEffect } from 'react';

export interface DashboardNotification {
  id: string;
  guild_id: string;
  type: string;
  title: string;
  message: string | null;
  source: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

export function useDashboardNotifications() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-notifications', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('dashboard_notifications')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DashboardNotification[];
    },
    enabled: !!selectedGuild?.id,
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedGuild?.id) return;
    const channel = supabase
      .channel('dashboard-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dashboard_notifications',
        filter: `guild_id=eq.${selectedGuild.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-notifications', selectedGuild.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGuild?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dashboard_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-notifications'] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!selectedGuild?.id) return;
      const { error } = await supabase
        .from('dashboard_notifications')
        .update({ is_read: true })
        .eq('guild_id', selectedGuild.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-notifications'] }),
  });

  const unreadCount = query.data?.filter(n => !n.is_read).length ?? 0;

  return {
    notifications: query.data ?? [],
    unreadCount,
    isLoading: query.isLoading,
    markAsRead,
    markAllAsRead,
  };
}
