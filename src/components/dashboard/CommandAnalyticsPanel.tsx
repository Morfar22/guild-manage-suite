import { useState } from 'react';
import { Activity, AlertTriangle, Ban, Eye, Gauge, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCommandAnalytics } from '@/hooks/useCommandAnalytics';
import { getCommandSlashPath } from '@/lib/commandGrouping';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
}

function formatLastUsed(value: string | null) {
  if (!value) return 'Aldrig';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

interface Props {
  onInspect?: (commandName: string) => void;
}

export function CommandAnalyticsPanel({ onInspect }: Props) {
  const [days, setDays] = useState(7);
  const { commands, timeline, summary, recentErrors, isLoading, refetch } = useCommandAnalytics(days);

  const topCommand = commands[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Command Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Faktiske command-kørsler, fejl, blokeringer og svartider.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">I dag</SelectItem>
              <SelectItem value="7">Sidste 7 dage</SelectItem>
              <SelectItem value="30">Sidste 30 dage</SelectItem>
              <SelectItem value="90">Sidste 90 dage</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void refetch()} title="Opdater">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Kørsler</p>
                <p className="text-2xl font-bold">{summary.executions.toLocaleString('da-DK')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Success rate</p>
                <p className="text-2xl font-bold">{summary.success_rate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Fejl</p>
                <p className="text-2xl font-bold">{summary.errors.toLocaleString('da-DK')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Blokeret</p>
                <p className="text-2xl font-bold">{summary.blocked.toLocaleString('da-DK')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mest brugte</p>
                <p className="truncate text-lg font-bold">{topCommand ? getCommandSlashPath(topCommand.command_name) : 'Ingen data'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : commands.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium">Ingen execution-data endnu</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Data begynder at komme ind, når den opdaterede bot kører commands.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aktivitet over tid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="successes" stackId="a" fill="hsl(var(--chart-2))" name="Success" />
                    <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="Fejl" />
                    <Bar dataKey="blocked" stackId="a" fill="hsl(var(--muted-foreground))" name="Blokeret" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Gennemsnitlig svartid: <span className="font-medium text-foreground">{formatLatency(summary.avg_latency_ms)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Command</TableHead>
                    <TableHead>Tid</TableHead>
                    <TableHead>Kilde</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Fejl</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentErrors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Ingen command-fejl i perioden.
                      </TableCell>
                    </TableRow>
                  ) : recentErrors.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">{getCommandSlashPath(event.command_name)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatLastUsed(event.created_at)}
                      </TableCell>
                      <TableCell><Badge variant="outline">{event.source}</Badge></TableCell>
                      <TableCell>{formatLatency(Number(event.latency_ms || 0))}</TableCell>
                      <TableCell className="max-w-xl truncate font-mono text-xs text-destructive">
                        {event.error_message || 'Ukendt fejl'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onInspect?.(event.command_name)}
                          title="Åbn command"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commands</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Command</TableHead>
                    <TableHead className="text-right">Kørsler</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Fejl</TableHead>
                    <TableHead className="text-right">Blokeret</TableHead>
                    <TableHead className="text-right">Gns.</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Senest brugt</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.map((command) => (
                    <TableRow key={command.command_name}>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">{getCommandSlashPath(command.command_name)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{command.executions.toLocaleString('da-DK')}</TableCell>
                      <TableCell className="text-right">
                        <span className={command.success_rate < 90 ? 'text-destructive' : 'text-foreground'}>
                          {command.success_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{command.errors}</TableCell>
                      <TableCell className="text-right">{command.blocked}</TableCell>
                      <TableCell className="text-right">{formatLatency(command.avg_latency_ms)}</TableCell>
                      <TableCell className="text-right">{formatLatency(command.max_latency_ms)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatLastUsed(command.last_used_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onInspect?.(command.command_name)}
                          title="Åbn detaljer"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
