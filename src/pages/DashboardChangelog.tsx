import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Trash2, Plus, Pencil, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

interface AuditLog {
  id: string;
  guild_id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const actionIcons: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  enable: Bell,
  disable: Bell,
};

const targetColors: Record<string, string> = {
  settings: 'text-primary',
  module: 'text-blue-500',
  moderation: 'text-destructive',
  ticket: 'text-amber-500',
  role: 'text-emerald-500',
};

export default function DashboardChangelog() {
  const { selectedGuild } = useGuild();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['dashboard-audit-log', selectedGuild?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_audit_log' as any)
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as AuditLog[];
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" /> Dashboard Changelog
        </h1>
        <p className="text-muted-foreground">Se alle ændringer foretaget i dashboardet</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seneste ændringer</CardTitle>
          <CardDescription>Hvem ændrede hvad og hvornår</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {logs.map((log) => {
                const ActionIcon = actionIcons[log.action] || Pencil;
                const color = targetColors[log.target_type] || 'text-muted-foreground';

                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <ActionIcon className={`h-4 w-4 mt-1 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.user_email?.split('@')[0] || 'Bruger'}</span>
                        {' '}
                        <span className="text-muted-foreground">
                          {log.action === 'create' && 'oprettede'}
                          {log.action === 'update' && 'opdaterede'}
                          {log.action === 'delete' && 'slettede'}
                          {log.action === 'enable' && 'aktiverede'}
                          {log.action === 'disable' && 'deaktiverede'}
                        </span>
                        {' '}
                        <span className="font-medium">{log.target_type}</span>
                        {log.target_id && <span className="text-muted-foreground"> ({log.target_id})</span>}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {JSON.stringify(log.details).slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px]">{log.target_type}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: da })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Ingen ændringer registreret endnu. Ændringer logges automatisk når indstillinger opdateres.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
