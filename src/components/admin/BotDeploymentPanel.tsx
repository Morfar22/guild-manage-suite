import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCw, Play, Square, RotateCw, Download, Rocket, Terminal, GitBranch, AlertTriangle,
} from 'lucide-react';
import { invokeFunction } from '@/lib/functions-client';

type Action = 'status' | 'logs' | 'pull' | 'restart' | 'start' | 'stop' | 'deploy';
type AgentPayload = Record<string, unknown>;

interface AgentResponse {
  ok: boolean;
  status: number;
  data: AgentPayload;
}

async function callAgent(action: Action, lines?: number): Promise<AgentResponse> {
  const { data, error } = await invokeFunction('bot-deploy', {
    body: { action, ...(lines ? { lines } : {}) },
  });
  if (error) throw error;
  return data as AgentResponse;
}

function asPayload(value: unknown): AgentPayload | null {
  return value && typeof value === 'object' ? (value as AgentPayload) : null;
}

function getAgentError(data: unknown, fallback: string) {
  const payload = asPayload(data);
  if (!payload) return fallback;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.stderr === 'string') return payload.stderr;
  for (const step of ['restart', 'install', 'pull']) {
    const stepPayload = asPayload(payload[step]);
    if (typeof stepPayload?.stderr === 'string') return stepPayload.stderr;
  }
  return fallback;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function BotDeploymentPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['bot-deploy-status'],
    queryFn: () => callAgent('status'),
    refetchInterval: 10_000,
    retry: 1,
  });

  const runAction = useMutation({
    mutationFn: (action: Action) => callAgent(action),
    onSuccess: (res, action) => {
      if (res.ok) {
        toast({ title: 'Udført', description: `${action} kørt OK` });
      } else {
        toast({
          title: 'Agent fejl',
          description: getAgentError(res.data, `Status ${res.status}`),
          variant: 'destructive',
        });
      }
      qc.invalidateQueries({ queryKey: ['bot-deploy-status'] });
    },
    onError: (err: unknown) => {
      toast({ title: 'Fejl', description: err instanceof Error ? err.message : 'Kunne ikke nå agent', variant: 'destructive' });
    },
  });

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await callAgent('logs', 200);
      if (!res.ok) throw new Error(getAgentError(res.data, 'Failed'));
      const out = textValue(res.data?.out) || textValue(res.data?.logs);
      const err = textValue(res.data?.err);
      setLogs([out, err].filter(Boolean).join('\n--- STDERR ---\n') || '(ingen logs)');
    } catch (e: unknown) {
      toast({ title: 'Fejl', description: e instanceof Error ? e.message : 'Kunne ikke hente logs', variant: 'destructive' });
    } finally {
      setLogsLoading(false);
    }
  };

  const status = statusQuery.data;
  const agentReachable = status?.ok === true;
  const agentData = status?.data ?? {};
  const isOnline = agentData.online === true;
  const branch = textValue(agentData.branch);
  const commit = textValue(agentData.commit);
  const pm2Name = textValue(agentData.pm2_name);

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Bot Deployment
              </CardTitle>
              <CardDescription>
                Genstart bot, pull seneste kode fra GitHub eller se logs fra VPS'en.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${statusQuery.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : !agentReachable ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">Kan ikke nå deploy-agent</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Tjek at agenten kører på VPS'en, og at <code>DEPLOY_AGENT_URL</code> + <code>DEPLOY_AGENT_TOKEN</code> er korrekte.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">Bot status</div>
                <div className="flex items-center gap-2">
                  <Badge variant={isOnline ? 'default' : 'secondary'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Badge>
                  {pm2Name && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {pm2Name}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" /> Git
                </div>
                <div className="text-sm font-mono truncate">
                  {branch || commit ? `${branch || '?'} @ ${commit || '?'}` : 'Ikke et git-repo'}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              onClick={() => runAction.mutate('deploy')}
              disabled={runAction.isPending}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" /> Fuld Deploy (pull + restart)
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction.mutate('pull')}
              disabled={runAction.isPending}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Git Pull
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction.mutate('restart')}
              disabled={runAction.isPending}
              className="gap-2"
            >
              <RotateCw className="h-4 w-4" /> Restart
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction.mutate('start')}
              disabled={runAction.isPending}
              className="gap-2"
            >
              <Play className="h-4 w-4" /> Start
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction.mutate('stop')}
              disabled={runAction.isPending}
              className="gap-2"
            >
              <Square className="h-4 w-4" /> Stop
            </Button>
            <Button
              variant="outline"
              onClick={fetchLogs}
              disabled={logsLoading}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" /> Hent Logs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      {logs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" /> PM2 Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[500px] overflow-auto rounded-lg bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">
              {logs}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
