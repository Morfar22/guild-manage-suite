import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TableInfo {
  name: string;
  count: number;
}

export function DatabaseOverview() {
  const { data: tables, isLoading } = useQuery({
    queryKey: ['admin-db-overview'],
    queryFn: async (): Promise<TableInfo[]> => {
      const tableNames = [
        'guilds', 'user_guilds', 'user_roles', 'bot_status',
        'tickets', 'warnings', 'moderation_logs', 'analytics_events',
        'auto_responders', 'guild_commands', 'suggestions',
        'giveaways', 'polls', 'reaction_roles',
      ];

      const results = await Promise.all(
        tableNames.map(async (name) => {
          const { count } = await supabase.from(name as any).select('*', { count: 'exact', head: true });
          return { name, count: count || 0 };
        })
      );

      return results.sort((a, b) => b.count - a.count);
    },
    refetchInterval: 60000,
  });

  const maxCount = Math.max(...(tables?.map(t => t.count) || [1]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Database Oversigt
        </CardTitle>
        <CardDescription>Antal rækker i de vigtigste tabeller</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : tables && tables.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {tables.map((t) => (
              <div key={t.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{t.name}</span>
                  <span className="text-muted-foreground text-xs">{t.count.toLocaleString()} rækker</span>
                </div>
                <Progress value={(t.count / maxCount) * 100} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">Ingen data</p>
        )}
      </CardContent>
    </Card>
  );
}
