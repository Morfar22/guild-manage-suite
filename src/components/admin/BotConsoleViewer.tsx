import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Terminal, RefreshCw, Search, Download, AlertTriangle, Info, Bug, Zap } from 'lucide-react';

interface ConsoleLog {
  id: string;
  guild_id: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface BotConsoleViewerProps {
  guildId?: string;
  guildName?: string;
  showGuildFilter?: boolean;
}

export function BotConsoleViewer({ guildId, guildName, showGuildFilter = true }: BotConsoleViewerProps) {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedGuildId, setSelectedGuildId] = useState<string>(guildId || 'all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch guilds for filter dropdown
  const { data: guilds } = useQuery({
    queryKey: ['admin-guilds-for-console'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guilds')
        .select('id, guild_name')
        .order('guild_name');
      if (error) throw error;
      return data || [];
    },
    enabled: showGuildFilter && !guildId,
  });

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['bot-console-logs', levelFilter, selectedGuildId],
    queryFn: async () => {
      let query = supabase
        .from('bot_console_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }

      if (selectedGuildId && selectedGuildId !== 'all') {
        query = query.eq('guild_id', selectedGuildId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as ConsoleLog[]) || [];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    const channel = supabase
      .channel('bot-console-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_console_logs' }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const filteredLogs = logs?.filter(log =>
    searchTerm ? log.message.toLowerCase().includes(searchTerm.toLowerCase()) || log.source.toLowerCase().includes(searchTerm.toLowerCase()) : true
  ) || [];

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      case 'warn': return <Zap className="h-3.5 w-3.5 text-yellow-500" />;
      case 'debug': return <Bug className="h-3.5 w-3.5 text-purple-400" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-purple-400';
      default: return 'text-green-400';
    }
  };

  const handleExport = () => {
    if (!filteredLogs.length) return;
    const text = filteredLogs.map(l =>
      `[${new Date(l.created_at).toISOString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-logs-${selectedGuildId !== 'all' ? selectedGuildId.slice(0, 8) + '-' : ''}${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = logs?.filter(l => l.level === 'error').length || 0;
  const warnCount = logs?.filter(l => l.level === 'warn').length || 0;

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {guildName ? `Konsol — ${guildName}` : 'Bot Console'}
            </CardTitle>
            <CardDescription>
              {guildId ? 'Logs for denne server' : 'Live konsol-output fra alle bots'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-xs">{errorCount} fejl</Badge>
            )}
            {warnCount > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-500">{warnCount} advarsler</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søg i logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-8 text-sm"
            />
          </div>
          {showGuildFilter && !guildId && (
            <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Alle servere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle servere</SelectItem>
                {guilds?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.guild_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
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
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8" disabled={!filteredLogs.length}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Terminal */}
        <div
          ref={scrollRef}
          className="bg-[hsl(0,0%,5%)] rounded-lg border border-border font-mono text-xs overflow-y-auto max-h-[600px] min-h-[300px]"
        >
          {isLoading ? (
            <div className="p-4 text-muted-foreground animate-pulse">Indlæser logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-4 text-muted-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <span>Ingen logs fundet. Botten logger automatisk fejl og hændelser her.</span>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors ${
                    log.level === 'error' ? 'bg-red-500/5' : ''
                  }`}
                >
                  {getLevelIcon(log.level)}
                  <span className="text-gray-500 shrink-0 tabular-nums">
                    {new Date(log.created_at).toLocaleTimeString('da-DK', { hour12: false })}
                  </span>
                  <span className={`shrink-0 font-semibold uppercase w-12 ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-cyan-400 shrink-0">[{log.source}]</span>
                  <span className="text-gray-200 break-all">{log.message}</span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span className="text-gray-500 shrink-0" title={JSON.stringify(log.metadata, null, 2)}>
                      📎
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredLogs.length} log-linjer vist</span>
          <span>Auto-opdatering hvert 5. sekund</span>
        </div>
      </CardContent>
    </Card>
  );
}
