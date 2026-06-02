import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useBotStatus } from '@/hooks/useBotStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, Heart, Clock, Wifi, WifiOff, MessageSquare, Users,
  AlertTriangle, AlertCircle, Info, CheckCircle2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const levelIcon: Record<string, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  debug: CheckCircle2,
};

const levelColor: Record<string, string> = {
  info: 'text-blue-500',
  warn: 'text-amber-500',
  error: 'text-destructive',
  debug: 'text-muted-foreground',
};

export default function BotHealth() {
  const { selectedGuild } = useGuild();
  const { status, isOnline } = useBotStatus();
  const [logFilter, setLogFilter] = useState<string>('all');

  // Fetch console logs
  const { data: logs } = useQuery({
    queryKey: ['bot-console-logs', selectedGuild?.id, logFilter],
    queryFn: async () => {
      let query = supabase
        .from('bot_console_logs')
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logFilter !== 'all') {
        query = query.eq('level', logFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 15000,
  });

  // Fetch heartbeat history for latency chart
  const { data: heartbeatHistory } = useQuery({
    queryKey: ['bot-heartbeat-history', selectedGuild?.id],
    queryFn: async () => {
      // Use console logs with source 'heartbeat' for history
      const { data, error } = await supabase
        .from('bot_console_logs')
        .select('created_at, metadata')
        .eq('guild_id', selectedGuild!.id)
        .eq('source', 'heartbeat')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data || []).map((entry) => {
        const meta = entry.metadata as Record<string, unknown> | null;
        return {
          time: new Date(entry.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
          latency: (meta?.latency_ms as number) || 0,
        };
      });
    },
    enabled: !!selectedGuild?.id,
    refetchInterval: 30000,
  });

  // Count errors in last 24h
  const errorCount = logs?.filter(l => l.level === 'error').length ?? 0;
  const warnCount = logs?.filter(l => l.level === 'warn').length ?? 0;

  // Uptime calculation
  const lastHeartbeat = status?.last_heartbeat
    ? formatDistanceToNow(new Date(status.last_heartbeat), { addSuffix: true, locale: da })
    : 'Ukendt';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" /> Bot Health
        </h1>
        <p className="text-muted-foreground">Overvåg bottens helbred og ydeevne</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isOnline ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                {isOnline ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-destructive" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">{isOnline ? 'Online' : 'Offline'}</p>
                <p className="text-xs text-muted-foreground">Heartbeat: {lastHeartbeat}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Latency</p>
                <p className="text-2xl font-bold">{status?.latency_ms ?? '—'} ms</p>
                <p className="text-xs text-muted-foreground">Discord API</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fejl (24t)</p>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-amber-500">{warnCount} advarsler</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Medlemmer</p>
                <p className="text-2xl font-bold">{status?.member_count?.toLocaleString() ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{status?.message_count_today ?? 0} beskeder i dag</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latency Chart */}
      {heartbeatHistory && heartbeatHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Latency over tid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heartbeatHistory}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit=" ms" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="latency" stroke="hsl(var(--primary))" fill="url(#latencyGrad)" name="Latency" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Console Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Konsol Logs
              </CardTitle>
              <CardDescription>Seneste logbeskeder fra botten</CardDescription>
            </div>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="error">Fejl</SelectItem>
                <SelectItem value="warn">Advarsler</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[400px] overflow-y-auto font-mono text-xs">
            {logs && logs.length > 0 ? (
              logs.map((log) => {
                const Icon = levelIcon[log.level] || Info;
                const color = levelColor[log.level] || 'text-muted-foreground';
                return (
                  <div key={log.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('da-DK')}
                    </span>
                    <Badge variant="outline" className="text-[9px] shrink-0">{log.source}</Badge>
                    <span className="break-all">{log.message}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">Ingen logs fundet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
