import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Shield, Users, Server, Bot, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

// Combines recent activity from multiple tables into a unified log view
interface AuditEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  icon: typeof Shield;
  color: string;
}

export function AuditLogViewer() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: async (): Promise<AuditEntry[]> => {
      const results: AuditEntry[] = [];

      // Recent moderation actions
      const { data: modLogs } = await supabase
        .from('moderation_logs')
        .select('id, action_type, target_name, moderator_name, created_at')
        .order('created_at', { ascending: false })
        .limit(15);

      modLogs?.forEach(l => {
        results.push({
          id: `mod-${l.id}`,
          type: 'Moderation',
          description: `${l.moderator_name || 'Moderator'} udførte ${l.action_type} på ${l.target_name || 'bruger'}`,
          timestamp: l.created_at,
          icon: Shield,
          color: 'text-red-500',
        });
      });

      // Recent user role changes
      const { data: roleChanges } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      roleChanges?.forEach(r => {
        results.push({
          id: `role-${r.id}`,
          type: 'Rolle',
          description: `Bruger ${r.user_id.slice(0, 8)}... fik rollen ${r.role}`,
          timestamp: r.created_at,
          icon: Users,
          color: 'text-blue-500',
        });
      });

      // Recent guild additions
      const { data: recentGuilds } = await supabase
        .from('guilds')
        .select('id, guild_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      recentGuilds?.forEach(g => {
        results.push({
          id: `guild-${g.id}`,
          type: 'Server',
          description: `Server "${g.guild_name}" tilføjet`,
          timestamp: g.created_at,
          icon: Server,
          color: 'text-emerald-500',
        });
      });

      // Sort all by timestamp
      return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30);
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Aktivitetslog
        </CardTitle>
        <CardDescription>Seneste handlinger på tværs af systemet</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <entry.icon className={`h-4 w-4 mt-0.5 shrink-0 ${entry.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: da })}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{entry.type}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Ingen aktivitet fundet</p>
        )}
      </CardContent>
    </Card>
  );
}
