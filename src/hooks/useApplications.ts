import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useAuth } from '@/contexts/AuthContext';
import { invokeFunction } from '@/lib/functions-client';

export type ApplicationStatus = 'pending' | 'approved' | 'denied';

export interface Application {
  id: string;
  guild_id: string;
  ticket_id: string | null;
  discord_user_id: string;
  discord_username: string | null;
  application_type: string;
  status: ApplicationStatus;
  answers: { question: string; answer: string }[];
  reviewer_discord_id: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  granted_role_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  approvalRate: number;
  todayCount: number;
  weekCount: number;
}

export function useApplications(status?: ApplicationStatus) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['applications', selectedGuild?.id, status],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      let query = supabase
        .from('applications')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((app: any) => ({
        ...app,
        answers: Array.isArray(app.answers) ? app.answers : [],
      })) as Application[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useApplicationStats() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-stats', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const { data: applications, error } = await supabase
        .from('applications')
        .select('status, created_at')
        .eq('guild_id', selectedGuild.id);

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const pending = applications.filter(a => a.status === 'pending').length;
      const approved = applications.filter(a => a.status === 'approved').length;
      const denied = applications.filter(a => a.status === 'denied').length;
      const total = applications.length;

      const stats: ApplicationStats = {
        total,
        pending,
        approved,
        denied,
        approvalRate: total > 0 ? Math.round((approved / (approved + denied || 1)) * 100) : 0,
        todayCount: applications.filter(a => new Date(a.created_at) >= today).length,
        weekCount: applications.filter(a => new Date(a.created_at) >= weekAgo).length,
      };

      return stats;
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes,
      sendDm,
      roleId,
    }: { 
      id: string; 
      status: 'approved' | 'denied'; 
      notes?: string;
      sendDm?: boolean;
      roleId?: string;
    }) => {
      // Use backend function so we can also sync Discord actions (whitelist role / DM)
      const { data, error } = await invokeFunction('review-application', {
        body: {
          applicationId: id,
          status,
          notes: notes || '',
          sendDm: sendDm === true,
          closeTicket: true,
          roleId: roleId || null,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['application-stats', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-stats', selectedGuild?.id] });
    },
  });
}

export function useApplicationByTicketId(ticketId?: string) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['application-by-ticket', selectedGuild?.id, ticketId],
    queryFn: async () => {
      if (!selectedGuild?.id || !ticketId) return null;

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        answers: Array.isArray((data as any).answers) ? (data as any).answers : [],
      } as Application;
    },
    enabled: !!selectedGuild?.id && !!ticketId,
  });
}
