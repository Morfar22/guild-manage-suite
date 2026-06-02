import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModerationLogs, ModerationActionType } from '@/hooks/useModerationLogs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, UserX, VolumeX, AlertTriangle, Trash2, Clock, UserCheck, Volume2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';

const actionIcons: Record<ModerationActionType, typeof Ban> = {
  ban: Ban, kick: UserX, mute: VolumeX, warn: AlertTriangle, delete: Trash2, timeout: Clock, unban: UserCheck, unmute: Volume2,
};
const actionColors: Record<ModerationActionType, string> = {
  ban: 'bg-destructive text-destructive-foreground', kick: 'bg-orange-500 text-white', mute: 'bg-yellow-500 text-black',
  warn: 'bg-yellow-400 text-black', delete: 'bg-secondary text-secondary-foreground', timeout: 'bg-orange-400 text-black',
  unban: 'bg-green-500 text-white', unmute: 'bg-green-400 text-black',
};

export default function Logs() {
  const { selectedGuild } = useGuild();
  const { language } = useLanguage();
  const en = language === 'en';
  const dateLoc = en ? enUS : da;
  const [actionFilter, setActionFilter] = useState<ModerationActionType | 'all'>('all');
  const { logs, loading, error, totalCount } = useModerationLogs({ limit: 100, actionType: actionFilter === 'all' ? undefined : actionFilter });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{en ? 'Moderation Logs' : 'Moderations Logs'}</h1>
          <p className="mt-1 text-muted-foreground">{en ? `View all moderation actions for ${selectedGuild?.guild_name || 'your server'}` : `Se alle moderationshandlinger for ${selectedGuild?.guild_name || 'din server'}`}</p>
        </div>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ModerationActionType | 'all')}>
          <SelectTrigger className="w-40"><SelectValue placeholder={en ? 'Filter action' : 'Filtrer handling'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{en ? 'All actions' : 'Alle handlinger'}</SelectItem>
            <SelectItem value="ban">Bans</SelectItem>
            <SelectItem value="kick">Kicks</SelectItem>
            <SelectItem value="mute">Mutes</SelectItem>
            <SelectItem value="warn">Warnings</SelectItem>
            <SelectItem value="timeout">Timeouts</SelectItem>
            <SelectItem value="delete">Deletions</SelectItem>
            <SelectItem value="unban">Unbans</SelectItem>
            <SelectItem value="unmute">Unmutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Total: {totalCount} logs</span>
        {actionFilter !== 'all' && <Badge variant="secondary" className="capitalize">{actionFilter}</Badge>}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">{en ? 'No moderation logs' : 'Ingen moderations logs'}</h3>
            <p className="mt-2 text-muted-foreground">{actionFilter === 'all' ? (en ? 'No moderation actions have been logged yet.' : 'Ingen moderationshandlinger er logget endnu.') : (en ? `No ${actionFilter} actions found.` : `Ingen ${actionFilter}-handlinger fundet.`)}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">{en ? 'Action' : 'Handling'}</TableHead>
                <TableHead>{en ? 'Target' : 'Mål'}</TableHead>
                <TableHead>Moderator</TableHead>
                <TableHead>{en ? 'Reason' : 'Årsag'}</TableHead>
                <TableHead className="w-24">{en ? 'Duration' : 'Varighed'}</TableHead>
                <TableHead className="w-32 text-right">{en ? 'Time' : 'Tidspunkt'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const Icon = actionIcons[log.action_type];
                return (
                  <TableRow key={log.id}>
                    <TableCell><Badge className={actionColors[log.action_type]}><Icon className="mr-1 h-3 w-3" /><span className="capitalize">{log.action_type}</span></Badge></TableCell>
                    <TableCell><div><p className="font-medium text-foreground">{log.target_name || (en ? 'Unknown' : 'Ukendt')}</p><p className="text-xs text-muted-foreground font-mono">{log.target_id}</p></div></TableCell>
                    <TableCell><div><p className="font-medium text-foreground">{log.moderator_name || (en ? 'Unknown' : 'Ukendt')}</p><p className="text-xs text-muted-foreground font-mono">{log.moderator_id}</p></div></TableCell>
                    <TableCell><p className="text-sm text-muted-foreground max-w-xs truncate">{log.reason || (en ? 'No reason given' : 'Ingen årsag angivet')}</p></TableCell>
                    <TableCell>{formatDuration(log.duration_seconds) && <Badge variant="outline">{formatDuration(log.duration_seconds)}</Badge>}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLoc })}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
