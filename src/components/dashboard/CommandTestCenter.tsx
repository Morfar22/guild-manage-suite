import { useMemo, useState } from 'react';
import { CheckCircle2, CircleSlash2, Gauge, HeartPulse, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CommandHealth } from '@/hooks/useOperationsCenter';
import { useCommands } from '@/hooks/useCommands';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { getCommandSlashPath } from '@/lib/commandGrouping';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type HealthStatus = 'healthy' | 'warning' | 'slow' | 'disabled' | 'no_data';

const statusMeta: Record<HealthStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  healthy: { label: 'Healthy', variant: 'default' },
  warning: { label: 'High errors', variant: 'destructive' },
  slow: { label: 'Slow', variant: 'secondary' },
  disabled: { label: 'Disabled', variant: 'outline' },
  no_data: { label: 'No data', variant: 'outline' },
};

export function CommandTestCenter({ health }: { health: CommandHealth[] }) {
  const { commandSettings, loading } = useCommands();
  const [filter, setFilter] = useState<HealthStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const healthMap = new Map(health.map((item) => [item.command_name, item]));
    const commands = Object.entries(COMMANDS_BY_CATEGORY).flatMap(([category, items]) =>
      items.map((item) => ({ ...item, category }))
    );

    return commands.map((command) => {
      const settings = commandSettings[command.name];
      const runtime = healthMap.get(command.name);
      let status: HealthStatus = 'healthy';

      if (settings?.enabled === false) {
        status = 'disabled';
      } else if (!runtime || Number(runtime.executions ?? 0) === 0) {
        status = 'no_data';
      } else if (Number(runtime.error_rate ?? 0) >= 20 && Number(runtime.executions ?? 0) >= 3) {
        status = 'warning';
      } else if (Number(runtime.avg_latency_ms ?? 0) >= 5000) {
        status = 'slow';
      }

      return {
        ...command,
        slashPath: getCommandSlashPath(command.name),
        settings,
        runtime,
        status,
      };
    });
  }, [commandSettings, health]);

  const filtered = rows.filter((row) => {
    if (filter !== 'all' && row.status !== filter) return false;
    if (!query.trim()) return true;
    const needle = query.toLowerCase();
    return (
      row.name.toLowerCase().includes(needle) ||
      row.slashPath.toLowerCase().includes(needle) ||
      row.description.toLowerCase().includes(needle)
    );
  });

  const counts = rows.reduce<Record<HealthStatus, number>>(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { healthy: 0, warning: 0, slow: 0, disabled: 0, no_data: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Command Test Center
            </CardTitle>
            <CardDescription>
              Sikker certificering af catalog, enable-state og runtime health. Den udfører ikke command-handlers.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />{counts.healthy} healthy</Badge>
            <Badge variant="destructive"><TriangleAlert className="mr-1 h-3 w-3" />{counts.warning} errors</Badge>
            <Badge variant="secondary"><Gauge className="mr-1 h-3 w-3" />{counts.slow} slow</Badge>
            <Badge variant="outline"><CircleSlash2 className="mr-1 h-3 w-3" />{counts.disabled} disabled</Badge>
            <Badge variant="outline"><HeartPulse className="mr-1 h-3 w-3" />{counts.no_data} no data</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg command..."
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">High errors</SelectItem>
              <SelectItem value="slow">Slow</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="no_data">No data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[520px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Command</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Error</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-mono text-xs">{row.slashPath}</TableCell>
                  <TableCell className="capitalize">{row.category}</TableCell>
                  <TableCell>
                    <Badge variant={statusMeta[row.status].variant}>{statusMeta[row.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.runtime?.executions ?? 0}</TableCell>
                  <TableCell className="text-right">{Number(row.runtime?.error_rate ?? 0).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{row.runtime?.avg_latency_ms ?? 0} ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {loading && <p className="text-xs text-muted-foreground">Command settings indlæses...</p>}
      </CardContent>
    </Card>
  );
}
