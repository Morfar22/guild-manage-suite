import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Activity, Users, Shield, MessageSquare, Zap, Bell, Hash } from 'lucide-react';
import { useRealtimeEvents, RealtimeEvent } from '@/hooks/useRealtimeEvents';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

const EVENT_CONFIG: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  member_join: { icon: Users, color: 'text-green-500', label: 'Medlem joined' },
  member_leave: { icon: Users, color: 'text-red-500', label: 'Medlem forlod' },
  message_delete: { icon: MessageSquare, color: 'text-orange-500', label: 'Besked slettet' },
  message_edit: { icon: MessageSquare, color: 'text-yellow-500', label: 'Besked redigeret' },
  mod_action: { icon: Shield, color: 'text-red-400', label: 'Mod handling' },
  command_used: { icon: Zap, color: 'text-blue-500', label: 'Kommando brugt' },
  role_change: { icon: Hash, color: 'text-purple-500', label: 'Rolle ændring' },
  channel_event: { icon: Hash, color: 'text-cyan-500', label: 'Kanal event' },
};

function EventRow({ event }: { event: RealtimeEvent }) {
  const config = EVENT_CONFIG[event.event_type] || { icon: Activity, color: 'text-muted-foreground', label: event.event_type };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.event_type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {event.user_name && <span className="font-medium text-foreground">{event.user_name}</span>}
          {event.channel_name && <span> i #{event.channel_name}</span>}
          {!!(event.event_data as Record<string, unknown>)?.description && (
            <span> — {String((event.event_data as Record<string, unknown>).description)}</span>
          )}
        </p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: da })}
      </span>
    </div>
  );
}

export default function RealtimeEventDashboard() {
  const { events, isLoading } = useRealtimeEvents(100);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const last5min = events.filter(e => (Date.now() - new Date(e.created_at).getTime()) < 5 * 60 * 1000).length;
  const typeCounts = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          Live Event Feed
        </h1>
        <p className="text-muted-foreground">Realtids-oversigt over alle bot-events — mission control</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
            <p className="text-2xl font-bold mt-1">{last5min}</p>
            <p className="text-xs text-muted-foreground">Events sidste 5 min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">Total events vist</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{Object.keys(typeCounts).length}</p>
            <p className="text-xs text-muted-foreground">Event typer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{typeCounts['mod_action'] || 0}</p>
            <p className="text-xs text-muted-foreground">Mod handlinger</p>
          </CardContent>
        </Card>
      </div>

      {/* Event Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Event Stream
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Ingen events endnu</p>
              <p className="text-sm text-muted-foreground">Events vises her i realtid når botten registrerer aktivitet</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
