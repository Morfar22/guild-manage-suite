import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HardDrive, Cpu, MemoryStick, Server, Wifi, WifiOff, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

interface ResourceRow {
  guild_id: string;
  is_online: boolean | null;
  latency_ms: number | null;
  last_heartbeat: string | null;
  member_count: number | null;
  cpu_percent: number | null;
  load_avg_1m: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  process_memory_mb: number | null;
  disk_used_gb: number | null;
  disk_total_gb: number | null;
  uptime_seconds: number | null;
  host_name: string | null;
  bot_version: string | null;
  guilds: { name: string | null; icon: string | null; guild_id: string } | null;
}

const ONLINE_WINDOW_MS = 120_000;

function pct(used: number | null, total: number | null) {
  if (!used || !total || total <= 0) return null;
  return Math.min(100, Math.round((used / total) * 100));
}

function barTone(value: number | null) {
  if (value === null) return 'bg-muted';
  if (value >= 90) return 'bg-destructive';
  if (value >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatUptime(seconds: number | null) {
  if (!seconds || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}t`;
  if (h > 0) return `${h}t ${m}m`;
  return `${m}m`;
}

function MetricBar({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Cpu;
  label: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </span>
        <span className="font-medium tabular-nums">{value === null ? '—' : `${value}%`}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barTone(value)}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function Resources() {
  const { data, isLoading } = useQuery({
    queryKey: ['resource-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_status')
        .select(
          'guild_id, is_online, latency_ms, last_heartbeat, member_count, cpu_percent, load_avg_1m, memory_used_mb, memory_total_mb, process_memory_mb, disk_used_gb, disk_total_gb, uptime_seconds, host_name, bot_version, guilds!inner(name, icon, guild_id)'
        )
        .order('last_heartbeat', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ResourceRow[];
    },
    refetchInterval: 30_000,
  });

  const rows = data ?? [];
  const onlineCount = rows.filter(
    (r) => r.is_online && r.last_heartbeat && new Date(r.last_heartbeat).getTime() > Date.now() - ONLINE_WINDOW_MS
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="h-8 w-8" /> Ressourceoversigt
        </h1>
        <p className="text-muted-foreground">
          Diskplads, CPU/RAM og botstatus pr. server — opdateres hvert 30. sekund via bottens heartbeat.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Servere</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Bots online</p>
            <p className="text-2xl font-bold text-emerald-500">{onlineCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Bots offline</p>
            <p className="text-2xl font-bold text-destructive">{rows.length - onlineCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ingen serverdata endnu. Botten sender ressourcedata med sit heartbeat, når den kører.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const online =
              !!row.is_online &&
              !!row.last_heartbeat &&
              new Date(row.last_heartbeat).getTime() > Date.now() - ONLINE_WINDOW_MS;
            const memPct = pct(row.memory_used_mb, row.memory_total_mb);
            const diskPct = pct(row.disk_used_gb, row.disk_total_gb);

            return (
              <Card key={row.guild_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{row.guilds?.name ?? 'Ukendt server'}</CardTitle>
                      <CardDescription>
                        {row.host_name ? `Vært: ${row.host_name}` : 'Vært ukendt'}
                        {row.bot_version ? ` · v${row.bot_version}` : ''}
                      </CardDescription>
                    </div>
                    <Badge variant={online ? 'default' : 'destructive'} className="gap-1">
                      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricBar
                    icon={Cpu}
                    label="CPU"
                    value={row.cpu_percent === null ? null : Math.round(row.cpu_percent)}
                    detail={row.load_avg_1m !== null ? `Load (1m): ${row.load_avg_1m}` : 'Load ukendt'}
                  />
                  <MetricBar
                    icon={MemoryStick}
                    label="RAM"
                    value={memPct}
                    detail={
                      row.memory_total_mb
                        ? `${row.memory_used_mb} MB / ${row.memory_total_mb} MB${
                            row.process_memory_mb ? ` · bot: ${row.process_memory_mb} MB` : ''
                          }`
                        : 'Ingen data'
                    }
                  />
                  <MetricBar
                    icon={HardDrive}
                    label="Diskplads"
                    value={diskPct}
                    detail={
                      row.disk_total_gb
                        ? `${row.disk_used_gb} GB / ${row.disk_total_gb} GB brugt`
                        : 'Ingen data'
                    }
                  />

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Oppetid
                      </p>
                      <p className="font-medium">{formatUptime(row.uptime_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wifi className="h-3 w-3" /> Latency
                      </p>
                      <p className="font-medium">{row.latency_ms != null ? `${row.latency_ms} ms` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Medlemmer
                      </p>
                      <p className="font-medium">{row.member_count ?? '—'}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Sidste heartbeat:{' '}
                    {row.last_heartbeat
                      ? formatDistanceToNow(new Date(row.last_heartbeat), { addSuffix: true, locale: da })
                      : 'aldrig'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
