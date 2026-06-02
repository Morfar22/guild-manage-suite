import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Server, Bot, MessageSquare, Shield, Activity } from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  totalGuilds: number;
  totalBots: number;
  onlineBots: number;
  totalCommands: number;
  totalWarnings: number;
}

export function SystemStatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-system-stats'],
    queryFn: async (): Promise<SystemStats> => {
      const [usersRes, guildsRes, botsRes, commandsRes, warningsRes] = await Promise.all([
        supabase.from('user_roles').select('user_id', { count: 'exact', head: true }),
        supabase.from('guilds').select('*', { count: 'exact', head: true }),
        supabase.from('bot_status').select('is_online'),
        supabase.from('guild_commands').select('*', { count: 'exact', head: true }),
        supabase.from('warnings').select('*', { count: 'exact', head: true }),
      ]);

      const bots = botsRes.data || [];
      return {
        totalUsers: usersRes.count || 0,
        totalGuilds: guildsRes.count || 0,
        totalBots: bots.length,
        onlineBots: bots.filter(b => b.is_online).length,
        totalCommands: commandsRes.count || 0,
        totalWarnings: warningsRes.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const cards = [
    { label: 'Brugere', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Servere', value: stats?.totalGuilds ?? 0, icon: Server, color: 'text-emerald-500' },
    { label: 'Bots total', value: stats?.totalBots ?? 0, icon: Bot, color: 'text-purple-500' },
    { label: 'Bots online', value: stats?.onlineBots ?? 0, icon: Activity, color: 'text-green-500' },
    { label: 'Kommandoer', value: stats?.totalCommands ?? 0, icon: MessageSquare, color: 'text-orange-500' },
    { label: 'Advarsler', value: stats?.totalWarnings ?? 0, icon: Shield, color: 'text-red-500' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value.toLocaleString()}</p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
