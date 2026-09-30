import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export type TicketStatus = 'open' | 'claimed' | 'closed';
export type TicketType = 'support' | 'application';
export type TicketAttention = 'normal' | 'watch' | 'urgent';

export interface Ticket {
  id: string;
  guild_id: string;
  category_id: string | null;
  channel_id: string;
  creator_id: string;
  creator_name: string | null;
  claimed_by_id: string | null;
  claimed_by_name: string | null;
  status: TicketStatus;
  ticket_type: TicketType;
  subject: string | null;
  closed_at: string | null;
  closed_by_id: string | null;
  closed_by_name: string | null;
  created_at: string;
  updated_at: string;
  ticket_categories?: TicketCategory | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  content: string;
  attachments: unknown[];
  created_at: string;
}

export interface CategoryQuestion {
  label: string;
  placeholder: string;
  required: boolean;
  style: 'short' | 'paragraph' | 'select';
  options?: string[];
  multi?: boolean;
}

export interface TicketCategory {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  ticket_type: TicketType;
  emoji: string;
  welcome_message: string;
  staff_role_id: string | null;
  questions: CategoryQuestion[];
  created_at: string;
  updated_at: string;
}

// Helper to transform DB response to typed category
function transformCategory(cat: any): TicketCategory {
  return {
    ...cat,
    questions: Array.isArray(cat.questions) ? cat.questions : [],
  };
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  claimedTickets: number;
  closedTickets: number;
  unclaimedTickets: number;
  needsAttention: number;
  avgResponseTime: number | null;
  avgResolutionTime: number | null;
  oldestOpenHours: number | null;
  ticketsToday: number;
  ticketsThisWeek: number;
}

export function getTicketAgeHours(ticket: Pick<Ticket, 'created_at'>, now = Date.now()) {
  return Math.max(0, (now - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60));
}

export function getTicketAttention(ticket: Pick<Ticket, 'status' | 'claimed_by_id' | 'created_at'>, now = Date.now()): TicketAttention {
  if (ticket.status === 'closed') return 'normal';

  const ageHours = getTicketAgeHours(ticket, now);
  if (!ticket.claimed_by_id) {
    if (ageHours >= 6) return 'urgent';
    if (ageHours >= 1) return 'watch';
    return 'normal';
  }

  if (ageHours >= 24) return 'urgent';
  if (ageHours >= 12) return 'watch';
  return 'normal';
}

export function useTickets(status?: TicketStatus, excludeApplications: boolean = true) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['tickets', selectedGuild?.id, status, excludeApplications],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      let query = supabase
        .from('tickets')
        .select('*, ticket_categories(*)')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      // Filter out application tickets if requested (default behavior for Tickets page)
      if (excludeApplications) {
        query = query.eq('ticket_type', 'support');
      }

      const { data, error } = await query;
      if (error) throw error;
      // Transform ticket_categories to handle questions
      return (data || []).map((ticket: any) => ({
        ...ticket,
        ticket_categories: ticket.ticket_categories ? transformCategory(ticket.ticket_categories) : null,
      })) as Ticket[];
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15_000,
  });
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      const { data, error } = await supabase
        .from('tickets')
        .select('*, ticket_categories(*)')
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        ticket_categories: data.ticket_categories ? transformCategory(data.ticket_categories) : null,
      } as Ticket;
    },
    enabled: !!ticketId,
    refetchInterval: 15_000,
  });
}

export function useTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!ticketId,
    refetchInterval: 10_000,
  });
}

export function useTicketCategories() {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['ticket-categories', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];

      const { data, error } = await supabase
        .from('ticket_categories')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('name');

      if (error) throw error;
      return (data || []).map(transformCategory) as TicketCategory[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useTicketStats(excludeApplications: boolean = true) {
  const { selectedGuild } = useGuild();

  return useQuery({
    queryKey: ['ticket-stats', selectedGuild?.id, excludeApplications],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      let query = supabase
        .from('tickets')
        .select('status, created_at, closed_at, ticket_type, claimed_by_id')
        .eq('guild_id', selectedGuild.id);

      // Filter out application tickets if requested
      if (excludeApplications) {
        query = query.eq('ticket_type', 'support');
      }

      const { data: tickets, error } = await query;

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats: TicketStats = {
        totalTickets: tickets.length,
        openTickets: tickets.filter(t => t.status === 'open').length,
        claimedTickets: tickets.filter(t => t.status === 'claimed').length,
        closedTickets: tickets.filter(t => t.status === 'closed').length,
        unclaimedTickets: tickets.filter(t => t.status === 'open' && !t.claimed_by_id).length,
        needsAttention: tickets.filter(t => getTicketAttention(t as Ticket, now.getTime()) !== 'normal').length,
        avgResponseTime: null,
        avgResolutionTime: null,
        oldestOpenHours: null,
        ticketsToday: tickets.filter(t => new Date(t.created_at) >= today).length,
        ticketsThisWeek: tickets.filter(t => new Date(t.created_at) >= weekAgo).length,
      };

      // Calculate average response time for closed tickets
      const closedWithTime = tickets.filter(t => t.status === 'closed' && t.closed_at);
      if (closedWithTime.length > 0) {
        const totalMs = closedWithTime.reduce((acc, t) => {
          const created = new Date(t.created_at).getTime();
          const closed = new Date(t.closed_at!).getTime();
          return acc + (closed - created);
        }, 0);
        const avgHours = totalMs / closedWithTime.length / (1000 * 60 * 60);
        // Kept for backwards compatibility. This metric is ticket resolution time,
        // not true first-response time.
        stats.avgResponseTime = avgHours;
        stats.avgResolutionTime = avgHours;
      }

      const activeTickets = tickets.filter(t => t.status !== 'closed');
      if (activeTickets.length > 0) {
        stats.oldestOpenHours = Math.max(
          ...activeTickets.map(t => Math.max(0, (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60)))
        );
      }

      return stats;
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15_000,
  });
}

// Define a simple type for the category input to avoid strict typing issues
interface CategoryInput {
  name: string;
  description?: string | null;
  ticket_type?: 'support' | 'application';
  emoji?: string;
  welcome_message?: string;
  staff_role_id?: string | null;
  questions?: CategoryQuestion[];
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (category: CategoryInput) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const insertData = {
        name: category.name,
        description: category.description || null,
        ticket_type: category.ticket_type || 'support',
        emoji: category.emoji || '🎫',
        welcome_message: category.welcome_message || 'Tak for din henvendelse!',
        staff_role_id: category.staff_role_id || null,
        questions: (category.questions || []) as unknown,
        guild_id: selectedGuild.id,
      };

      const { data, error } = await supabase
        .from('ticket_categories')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return transformCategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories', selectedGuild?.id] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CategoryInput> & { id: string }) => {
      // Build update object manually to handle questions properly
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.ticket_type !== undefined) updateData.ticket_type = updates.ticket_type;
      if (updates.emoji !== undefined) updateData.emoji = updates.emoji;
      if (updates.welcome_message !== undefined) updateData.welcome_message = updates.welcome_message;
      if (updates.staff_role_id !== undefined) updateData.staff_role_id = updates.staff_role_id;
      if (updates.questions !== undefined) updateData.questions = updates.questions;

      const { data, error } = await supabase
        .from('ticket_categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return transformCategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories', selectedGuild?.id] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('ticket_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories', selectedGuild?.id] });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  const { selectedGuild } = useGuild();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data: ticket, error: lookupError } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('id', ticketId)
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!ticket) throw new Error('Ticket not found');
      if (ticket.status !== 'closed') {
        throw new Error('Only closed tickets can be permanently deleted');
      }

      const { error: messageError } = await supabase
        .from('ticket_messages')
        .delete()
        .eq('ticket_id', ticketId);

      if (messageError) throw messageError;

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId)
        .eq('guild_id', selectedGuild.id)
        .eq('status', 'closed');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', selectedGuild?.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-stats', selectedGuild?.id] });
    },
  });
}
