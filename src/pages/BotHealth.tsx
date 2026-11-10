import { useState } from "react";
import { hasFreshLogTelemetry, logCountDisplay } from "@/lib/log-observability";
import { useBotHealthData } from "@/hooks/useBotHealthData";
import { useBotStatus } from "@/hooks/useBotStatus";
import { getBotConnectionLabel } from "@/lib/bot-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Heart,
  Clock,
  Wifi,
  WifiOff,
  MessageSquare,
  Users,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const levelIcon: Record<string, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  debug: CheckCircle2,
};

const levelColor: Record<string, string> = {
  info: "text-blue-500",
  warn: "text-amber-500",
  error: "text-destructive",
  debug: "text-muted-foreground",
};

export default function BotHealth() {
  const {
    status,
    isOnline,
    connectionState,
    error: statusError,
    refreshing,
    refetch,
  } = useBotStatus();
  const offline = connectionState === "offline";
  const [logFilter, setLogFilter] = useState<string>("all");

  const {
    logs: logsQuery,
    counts: countsQuery,
    history: historyQuery,
  } = useBotHealthData(logFilter);
  const logs = logsQuery.data;
  const heartbeatHistory = historyQuery.data?.filter(
    (point) => point.latency !== null,
  );
  const telemetryFresh =
    !historyQuery.isError &&
    hasFreshLogTelemetry(historyQuery.data?.at(-1)?.observedAt);
  const errorCount = logCountDisplay(
    countsQuery.data?.errors,
    countsQuery.isError,
    telemetryFresh,
  );
  const warnCount = logCountDisplay(
    countsQuery.data?.warnings,
    countsQuery.isError,
    telemetryFresh,
  );
  const logDataError =
    logsQuery.isError || countsQuery.isError || historyQuery.isError;
  // Uptime calculation
  const lastHeartbeat = status?.last_heartbeat
    ? formatDistanceToNow(new Date(status.last_heartbeat), {
        addSuffix: true,
        locale: da,
      })
    : "Ukendt";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" /> Bot Health
        </h1>
        <p className="text-muted-foreground">
          Overvåg bottens helbred og ydeevne
        </p>
      </div>

      {statusError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
        >
          <span>Botstatus kunne ikke hentes. Seneste data bevares.</span>
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void refetch()}
          >
            Prøv igen
          </Button>
        </div>
      )}
      {logDataError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
        >
          <span>
            Logdata kunne ikke hentes fuldstændigt. Manglende data tælles ikke
            som nul fejl.
          </span>
          <Button
            variant="outline"
            disabled={
              logsQuery.isFetching ||
              countsQuery.isFetching ||
              historyQuery.isFetching
            }
            onClick={() => {
              void logsQuery.refetch();
              void countsQuery.refetch();
              void historyQuery.refetch();
            }}
          >
            Prøv logdata igen
          </Button>
        </div>
      )}
      {!logDataError && !historyQuery.isPending && !telemetryFresh && (
        <p
          role="status"
          className="rounded-lg border border-warning/40 p-3 text-sm text-muted-foreground"
        >
          Der mangler nye logmålinger fra botten. Nul fejl vises først, når
          logforbindelsen er bekræftet.
        </p>
      )}
      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${isOnline ? "bg-emerald-500/10" : offline ? "bg-destructive/10" : "bg-warning/10"}`}
              >
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-emerald-500" />
                ) : offline ? (
                  <WifiOff className="h-5 w-5 text-destructive" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">
                  {getBotConnectionLabel(connectionState, "da")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Heartbeat: {lastHeartbeat}
                </p>
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
                <p className="text-2xl font-bold">
                  {status?.latency_ms ?? "—"} ms
                </p>
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
                <p className="text-2xl font-bold">
                  {status?.member_count?.toLocaleString() ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status?.message_count_today ?? 0} beskeder i dag
                </p>
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
                    <linearGradient
                      id="latencyGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    unit=" ms"
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="hsl(var(--primary))"
                    fill="url(#latencyGrad)"
                    name="Latency"
                  />
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
            {logsQuery.isPending ? (
              <p className="py-8 text-center text-muted-foreground">
                Henter logs...
              </p>
            ) : logsQuery.isError && !logs ? (
              <p className="py-8 text-center text-muted-foreground">
                Logs er ikke tilgængelige.
              </p>
            ) : logs && logs.length > 0 ? (
              logs.map((log) => {
                const Icon = levelIcon[log.level] || Info;
                const color = levelColor[log.level] || "text-muted-foreground";
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                  >
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString("da-DK")}
                    </span>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {log.source}
                    </Badge>
                    <span className="break-all">{log.message}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Ingen logs fundet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
