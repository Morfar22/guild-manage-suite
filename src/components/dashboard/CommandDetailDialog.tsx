import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ban,
  Clock3,
  Gauge,
  History,
  Loader2,
  Settings2,
  ShieldCheck,
  UserRound,
  Hash,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CommandInfo } from '@/types/discord';
import { GuildCommandSettings } from '@/lib/commands';
import { getCommandSlashPath } from '@/lib/commandGrouping';
import { useCommandDetail } from '@/hooks/useCommandDetail';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordMembers } from '@/hooks/useDiscordMembers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: CommandInfo;
  settings?: GuildCommandSettings;
  updating?: boolean;
  onToggle: (commandName: string, enabled: boolean) => Promise<void> | void;
  onEditSettings: (command: CommandInfo) => void;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ukendt';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function actionLabel(action: string) {
  switch (action) {
    case 'command_enabled_changed': return 'Aktivering ændret';
    case 'command_settings_changed': return 'Regler ændret';
    case 'command_bulk_settings_changed': return 'Bulk-regler ændret';
    case 'command_category_enabled_changed': return 'Kategori-status ændret';
    default: return action;
  }
}

function detailsSummary(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return 'Ingen detaljer';
  const value = details as Record<string, unknown>;
  const changes = value.changes;
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const keys = Object.keys(changes as Record<string, unknown>);
    if (keys.length) return keys.join(', ');
  }

  const before = value.before;
  const after = value.after;
  if (before && after) return 'Før/efter gemt';
  return 'Ændring registreret';
}

export function CommandDetailDialog({
  open,
  onOpenChange,
  command,
  settings,
  updating,
  onToggle,
  onEditSettings,
}: Props) {
  const [days, setDays] = useState(7);
  const detail = useCommandDetail(command.name, days, open);
  const { data: channelData } = useDiscordChannels();
  const { members } = useDiscordMembers();

  const channelNames = useMemo(
    () => new Map((channelData?.channels ?? []).map((channel) => [channel.id, channel.name])),
    [channelData]
  );

  const memberNames = useMemo(
    () => new Map(
      members.map((member) => [
        member.user.id,
        member.nick || member.user.global_name || member.user.username,
      ])
    ),
    [members]
  );

  const isEnabled = settings?.enabled !== false;
  const restricted =
    (settings?.cooldown_seconds ?? 0) > 0 ||
    (settings?.allowed_role_ids?.length ?? 0) > 0 ||
    (settings?.allowed_channel_ids?.length ?? 0) > 0;

  const dailyChart = detail.daily.map((row) => ({
    day: row.day,
    success: Number(row.successes ?? 0),
    errors: Number(row.errors ?? 0),
    blocked: Number(row.blocked ?? 0),
    latency: Number(row.avg_latency_ms ?? 0),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 pr-8 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {getCommandSlashPath(command.name)}
                <Badge variant={isEnabled ? 'default' : 'destructive'}>
                  {isEnabled ? 'Aktiv' : 'Deaktiveret'}
                </Badge>
                {restricted && <Badge variant="outline">Har regler</Badge>}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {command.description}
              </DialogDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">I dag</SelectItem>
                  <SelectItem value="7">7 dage</SelectItem>
                  <SelectItem value="30">30 dage</SelectItem>
                  <SelectItem value="90">90 dage</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => onEditSettings(command)}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Regler
              </Button>
              <Button
                variant={isEnabled ? 'destructive' : 'default'}
                disabled={updating}
                onClick={() => void onToggle(command.name, !isEnabled)}
              >
                {isEnabled ? 'Deaktiver' : 'Aktiver'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-5">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="overview" className="gap-2">
                <Activity className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="errors" className="gap-2">
                <AlertTriangle className="h-4 w-4" /> Errors
                {detail.summary.errors > 0 && <Badge variant="destructive">{detail.summary.errors}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="blocked" className="gap-2">
                <Ban className="h-4 w-4" /> Blocked
                {detail.summary.blocked > 0 && <Badge variant="secondary">{detail.summary.blocked}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" /> History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  { label: 'Executions', value: detail.summary.executions, icon: Activity },
                  { label: 'Success', value: `${detail.summary.successRate}%`, icon: ShieldCheck },
                  { label: 'Errors', value: detail.summary.errors, icon: AlertTriangle },
                  { label: 'Blocked', value: detail.summary.blocked, icon: Ban },
                  { label: 'Avg latency', value: formatLatency(detail.summary.avgLatency), icon: Gauge },
                  { label: 'P95 latency', value: formatLatency(detail.summary.p95Latency), icon: Clock3 },
                ].map(({ label, value, icon: Icon }) => (
                  <Card key={label}>
                    <CardContent className="pt-5">
                      <Icon className="mb-2 h-4 w-4 text-primary" />
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Execution trend</p>
                      <p className="text-xs text-muted-foreground">Success, fejl og blokerede forsøg pr. dag</p>
                    </div>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="success" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.18)" />
                        <Area type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.12)" />
                        <Area type="monotone" dataKey="blocked" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.08)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 flex items-center gap-2 font-medium">
                      <Hash className="h-4 w-4 text-primary" /> Top-kanaler
                    </p>
                    <div className="space-y-2">
                      {detail.topChannels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen data endnu.</p>
                      ) : detail.topChannels.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">#{channelNames.get(item.id) || item.id}</span>
                          <Badge variant="secondary">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 flex items-center gap-2 font-medium">
                      <UserRound className="h-4 w-4 text-primary" /> Top-brugere
                    </p>
                    <div className="space-y-2">
                      {detail.topUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen data endnu.</p>
                      ) : detail.topUsers.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{memberNames.get(item.id) || item.id}</span>
                          <Badge variant="secondary">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-3 flex items-center gap-2 font-medium">
                      <Ban className="h-4 w-4 text-primary" /> Blocked reasons
                    </p>
                    <div className="space-y-2">
                      {detail.blockedReasons.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen blokeringer.</p>
                      ) : detail.blockedReasons.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="capitalize">{item.id}</span>
                          <Badge variant="secondary">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="errors">
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tid</TableHead>
                      <TableHead>Kilde</TableHead>
                      <TableHead>Bruger</TableHead>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Fejl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.recentErrors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          Ingen command-fejl i perioden.
                        </TableCell>
                      </TableRow>
                    ) : detail.recentErrors.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(event.created_at)}</TableCell>
                        <TableCell><Badge variant="outline">{event.source}</Badge></TableCell>
                        <TableCell className="max-w-36 truncate">{memberNames.get(event.user_id || '') || event.user_id || 'Ukendt'}</TableCell>
                        <TableCell className="max-w-36 truncate">#{channelNames.get(event.channel_id || '') || event.channel_id || 'ukendt'}</TableCell>
                        <TableCell>{formatLatency(event.latency_ms)}</TableCell>
                        <TableCell className="max-w-xl whitespace-normal break-words font-mono text-xs text-destructive">
                          {event.error_message || 'Ukendt fejl'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="blocked">
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tid</TableHead>
                      <TableHead>Årsag</TableHead>
                      <TableHead>Bruger</TableHead>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Kilde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.recentBlocked.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          Ingen blokerede forsøg i perioden.
                        </TableCell>
                      </TableRow>
                    ) : detail.recentBlocked.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(event.created_at)}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{event.blocked_reason || 'access'}</Badge></TableCell>
                        <TableCell>{memberNames.get(event.user_id || '') || event.user_id || 'Ukendt'}</TableCell>
                        <TableCell>#{channelNames.get(event.channel_id || '') || event.channel_id || 'ukendt'}</TableCell>
                        <TableCell><Badge variant="outline">{event.source}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-3">
                {detail.audit.length === 0 ? (
                  <div className="rounded-xl border border-border p-10 text-center text-muted-foreground">
                    Ingen Command Center-ændringer registreret endnu.
                  </div>
                ) : detail.audit.map((event) => (
                  <div key={event.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{actionLabel(event.action)}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.user_email || 'Ukendt bruger'} · {formatDate(event.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{detailsSummary(event.details)}</Badge>
                    </div>
                    {event.details && (
                      <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
