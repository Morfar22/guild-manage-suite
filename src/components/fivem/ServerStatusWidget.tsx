import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Server, 
  Users, 
  Clock, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Activity,
  HardDrive,
  Globe
} from 'lucide-react';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ServerStatus {
  id: string;
  guild_id: string;
  server_id: string;
  server_name: string | null;
  max_players: number;
  player_count: number;
  uptime_seconds: number;
  server_started_at: string | null;
  last_heartbeat: string | null;
  game_type: string;
  map_name: string | null;
  resources_count: number;
  txadmin_version: string | null;
  fxserver_version: string | null;
  server_ip: string | null;
  server_port: number;
  is_online: boolean;
  metadata: Record<string, unknown>;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function getStatusBadge(isOnline: boolean, lastHeartbeat: string | null) {
  if (!lastHeartbeat) {
    return <Badge variant="secondary">Aldrig forbundet</Badge>;
  }
  
  const lastBeat = new Date(lastHeartbeat);
  const now = new Date();
  const diffMs = now.getTime() - lastBeat.getTime();
  const diffSeconds = diffMs / 1000;
  
  if (isOnline && diffSeconds < 120) {
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Online</Badge>;
  } else if (diffSeconds < 300) {
    return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Forbinder...</Badge>;
  } else {
    return <Badge variant="destructive">Offline</Badge>;
  }
}

export default function ServerStatusWidget() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: serverStatus, isLoading } = useQuery({
    queryKey: ['fivem-server-status', selectedGuild?.id],
    enabled: !!selectedGuild?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fivem_server_status')
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ServerStatus | null;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedGuild?.id) return;

    const channel = supabase
      .channel('fivem-server-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fivem_server_status',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fivem-server-status', selectedGuild.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild?.id, queryClient]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['fivem-server-status', selectedGuild?.id] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!serverStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Server Status
          </CardTitle>
          <CardDescription>
            Ingen server forbundet endnu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Din FiveM server har ikke sendt status data endnu.</p>
            <p className="text-sm mt-2">
              Åbn fanen Opsætning, installér guild_manage_bridge og kopiér server.cfg-blokken.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isActuallyOnline = serverStatus.is_online && 
    serverStatus.last_heartbeat && 
    (new Date().getTime() - new Date(serverStatus.last_heartbeat).getTime()) < 120000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              {serverStatus.server_name || 'FiveM Server'}
              {getStatusBadge(serverStatus.is_online, serverStatus.last_heartbeat)}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              {serverStatus.server_ip && (
                <>
                  <Globe className="h-3 w-3" />
                  {serverStatus.server_ip}:{serverStatus.server_port}
                </>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Player Count */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Spillere</span>
            </div>
            <div className="text-2xl font-bold">
              {serverStatus.player_count}
              <span className="text-sm font-normal text-muted-foreground">
                /{serverStatus.max_players}
              </span>
            </div>
          </div>

          {/* Uptime */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Uptime</span>
            </div>
            <div className="text-2xl font-bold">
              {formatUptime(serverStatus.uptime_seconds)}
            </div>
          </div>

          {/* Status */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {isActuallyOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs">Status</span>
            </div>
            <div className={`text-2xl font-bold ${isActuallyOnline ? 'text-green-500' : 'text-red-500'}`}>
              {isActuallyOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          {/* Resources */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-4 w-4" />
              <span className="text-xs">Resources</span>
            </div>
            <div className="text-2xl font-bold">
              {serverStatus.resources_count}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {(serverStatus.fxserver_version || serverStatus.map_name || serverStatus.metadata?.framework || serverStatus.metadata?.bridgeVersion) && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
            {serverStatus.fxserver_version && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                FXServer: {serverStatus.fxserver_version}
              </div>
            )}
            {serverStatus.map_name && (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Map: {serverStatus.map_name}
              </div>
            )}
            {typeof serverStatus.metadata?.framework === 'string' && (
              <Badge variant="outline">Framework: {serverStatus.metadata.framework}</Badge>
            )}
            {typeof serverStatus.metadata?.bridgeVersion === 'string' && (
              <Badge variant="outline">Bridge v{serverStatus.metadata.bridgeVersion}</Badge>
            )}
            {serverStatus.last_heartbeat && (
              <div className="flex items-center gap-1 ml-auto">
                Sidst opdateret: {new Date(serverStatus.last_heartbeat).toLocaleTimeString('da-DK')}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
