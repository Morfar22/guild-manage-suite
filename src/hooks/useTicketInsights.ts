import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

export interface TicketRating {
  id: string;
  ticket_id: string;
  guild_id: string;
  rated_by_id: string;
  staff_id: string | null;
  staff_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  tickets_handled: number;
  avg_rating: number | null;
  ratings_count: number;
  avg_resolution_hours: number | null;
}

export interface DailyStat {
  date: string;
  count: number;
}

export function useTicketRatings() {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['ticket-ratings', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('ticket_ratings' as any)
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) as TicketRating[];
    },
    enabled: !!selectedGuild?.id,
  });
}

export function useTicketInsights() {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['ticket-insights', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;

      const [ticketsRes, ratingsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, status, created_at, closed_at, closed_by_id, closed_by_name, claimed_by_id, claimed_by_name, ticket_type')
          .eq('guild_id', selectedGuild.id)
          .eq('ticket_type', 'support'),
        supabase.from('ticket_ratings' as any).select('*').eq('guild_id', selectedGuild.id),
      ]);
      if (ticketsRes.error) throw ticketsRes.error;
      if (ratingsRes.error) throw ratingsRes.error;

      const tickets = ticketsRes.data || [];
      const ratings = (ratingsRes.data as any[]) as TicketRating[];

      // Daily volume - last 30 days
      const daysMap = new Map<string, number>();
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        daysMap.set(d.toISOString().slice(0, 10), 0);
      }
      tickets.forEach((t: any) => {
        const key = new Date(t.created_at).toISOString().slice(0, 10);
        if (daysMap.has(key)) daysMap.set(key, (daysMap.get(key) || 0) + 1);
      });
      const daily: DailyStat[] = Array.from(daysMap.entries()).map(([date, count]) => ({ date, count }));

      // Staff perf
      const staffMap = new Map<string, StaffPerformance & { _totalMs: number; _closedCount: number; _ratingSum: number }>();
      tickets.forEach((t: any) => {
        const sid = t.closed_by_id || t.claimed_by_id;
        const sname = t.closed_by_name || t.claimed_by_name;
        if (!sid) return;
        const existing = staffMap.get(sid) || {
          staff_id: sid, staff_name: sname || sid, tickets_handled: 0,
          avg_rating: null, ratings_count: 0, avg_resolution_hours: null,
          _totalMs: 0, _closedCount: 0, _ratingSum: 0,
        };
        existing.tickets_handled += 1;
        if (t.closed_at) {
          existing._totalMs += new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
          existing._closedCount += 1;
        }
        staffMap.set(sid, existing);
      });
      ratings.forEach((r) => {
        if (!r.staff_id) return;
        const existing = staffMap.get(r.staff_id);
        if (existing) {
          existing._ratingSum += r.rating;
          existing.ratings_count += 1;
        }
      });
      const staff: StaffPerformance[] = Array.from(staffMap.values()).map((s) => ({
        staff_id: s.staff_id,
        staff_name: s.staff_name,
        tickets_handled: s.tickets_handled,
        ratings_count: s.ratings_count,
        avg_rating: s.ratings_count ? +(s._ratingSum / s.ratings_count).toFixed(2) : null,
        avg_resolution_hours: s._closedCount ? +(s._totalMs / s._closedCount / 3600000).toFixed(1) : null,
      })).sort((a, b) => b.tickets_handled - a.tickets_handled);

      const avgRating = ratings.length ? +(ratings.reduce((a, r) => a + r.rating, 0) / ratings.length).toFixed(2) : null;

      return { daily, staff, ratings, avgRating, totalRatings: ratings.length };
    },
    enabled: !!selectedGuild?.id,
  });
}
