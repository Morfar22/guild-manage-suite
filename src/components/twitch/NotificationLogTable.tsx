import React, { forwardRef } from 'react';
import { TwitchNotificationLog } from '@/hooks/useTwitchNotificationLogs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Twitch, Radio, BellOff, Eye, Gamepad2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { da } from 'date-fns/locale';

interface NotificationLogTableProps {
  logs: TwitchNotificationLog[];
  loading: boolean;
}

export const NotificationLogTable = forwardRef<HTMLDivElement, NotificationLogTableProps>(
  function NotificationLogTable({ logs, loading }, ref) {
  if (loading) {
    return (
      <div ref={ref} className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div ref={ref} className="text-center py-12 text-muted-foreground">
        <Twitch className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Ingen notifikationer sendt endnu</p>
        <p className="text-sm">Når en streamer går live, vil notifikationen blive logget her</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Streamer</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="hidden md:table-cell">Detaljer</TableHead>
            <TableHead className="hidden sm:table-cell">Seere</TableHead>
            <TableHead className="text-right">Tidspunkt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={log.streamer_avatar || undefined} />
                    <AvatarFallback>
                      <Twitch className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate max-w-[100px]">
                    {log.streamer_name || 'Ukendt'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {log.event_type === 'live' ? (
                  <Badge variant="destructive" className="gap-1">
                    <Radio className="h-3 w-3" />
                    Live
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <BellOff className="h-3 w-3" />
                    Offline
                  </Badge>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="space-y-1 max-w-[200px]">
                  {log.stream_title && (
                    <p className="text-sm truncate">{log.stream_title}</p>
                  )}
                  {log.game_name && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Gamepad2 className="h-3 w-3" />
                      <span className="truncate">{log.game_name}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {log.viewer_count !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    {log.viewer_count.toLocaleString()}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="text-sm">
                  {formatDistanceToNow(new Date(log.sent_at), { 
                    addSuffix: true, 
                    locale: da 
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(log.sent_at), 'HH:mm', { locale: da })}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
