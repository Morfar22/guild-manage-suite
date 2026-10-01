import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  FileSearch,
  GitBranch,
  HeartPulse,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  UserRoundSearch,
  Users,
  Workflow as WorkflowIcon,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOperationsCenter, useCaseEvidence, ModerationCase } from '@/hooks/useOperationsCenter';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { CommandTestCenter } from '@/components/dashboard/CommandTestCenter';
import { getCommandSlashPath } from '@/lib/commandGrouping';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { ScrollArea } from '@/components/ui/scroll-area';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const severityVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'outline',
  low: 'outline',
  warning: 'secondary',
  medium: 'secondary',
  high: 'destructive',
  error: 'destructive',
  critical: 'destructive',
};

const BUILT_IN_PRESETS = [
  {
    name: 'FiveM Server',
    description: 'Moderation, utility, tickets, admin, economy, fun og FiveM.',
    categories: ['moderation', 'utility', 'tickets', 'admin', 'economy', 'fun', 'reactionroles'],
  },
  {
    name: 'Support Server',
    description: 'Fokus på moderation, tickets, utility og reaction roles.',
    categories: ['moderation', 'utility', 'tickets', 'admin', 'reactionroles'],
  },
  {
    name: 'Community',
    description: 'Engagement, moderation, levels, economy, giveaways og utility.',
    categories: ['moderation', 'utility', 'fun', 'leveling', 'economy', 'giveaway', 'reactionroles'],
  },
  {
    name: 'Minimal',
    description: 'Kun de vigtigste moderation, utility og ticket-funktioner.',
    categories: ['moderation', 'utility', 'tickets'],
  },
];

export default function OperationsCenter() {
  const ops = useOperationsCenter();
  const { user } = useAuth();
  const { data: roles = [] } = useDiscordRoles();
  const { data: channelData } = useDiscordChannels();
  const channels = channelData?.channels ?? [];

  const [caseOpen, setCaseOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ModerationCase | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState<'note' | 'link' | 'message' | 'attachment'>('note');
  const [evidenceLabel, setEvidenceLabel] = useState('');
  const [evidenceValue, setEvidenceValue] = useState('');

  const [userQuery, setUserQuery] = useState('');

  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [triggerType, setTriggerType] = useState('member_join');
  const [triggerValue, setTriggerValue] = useState('');
  const [workflowAction, setWorkflowAction] = useState('dashboard_alert');
  const [workflowChannel, setWorkflowChannel] = useState('');
  const [workflowRole, setWorkflowRole] = useState('');
  const [workflowMessage, setWorkflowMessage] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileCategory, setProfileCategory] = useState('moderation');
  const [profileCooldown, setProfileCooldown] = useState('0');

  const evidence = useCaseEvidence(selectedCase?.id ?? null);

  const casesByStatus = useMemo(() => ({
    open: ops.cases.filter((item) => item.status === 'open').length,
    investigating: ops.cases.filter((item) => item.status === 'investigating').length,
    resolved: ops.cases.filter((item) => ['resolved', 'dismissed'].includes(item.status)).length,
  }), [ops.cases]);

  const openCase = (moderationCase: ModerationCase) => {
    setSelectedCase(moderationCase);
    setCaseOpen(true);
  };

  const createEvidence = async () => {
    if (!selectedCase || !user?.id || !evidenceValue.trim()) return;
    await ops.addEvidence.mutateAsync({
      case_id: selectedCase.id,
      evidence_type: evidenceType,
      label: evidenceLabel || undefined,
      content: evidenceType === 'note' ? evidenceValue : undefined,
      url: ['link', 'attachment'].includes(evidenceType) ? evidenceValue : undefined,
      message_id: evidenceType === 'message' ? evidenceValue : undefined,
      added_by_id: user.id,
      added_by_name: user.email ?? undefined,
    });
    setEvidenceValue('');
    setEvidenceLabel('');
    setEvidenceOpen(false);
  };

  const createWorkflow = async () => {
    if (!workflowName.trim()) return;
    const triggerConfig =
      triggerType === 'message_keyword' ? { keyword: triggerValue, case_sensitive: false } : {};

    const action: Record<string, unknown> = { type: workflowAction };
    if (workflowChannel) action.channel_id = workflowChannel;
    if (workflowRole) action.role_id = workflowRole;
    if (workflowMessage) action.message = workflowMessage;

    await ops.createWorkflow.mutateAsync({
      name: workflowName,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      actions: [action],
    });
    setWorkflowName('');
    setTriggerValue('');
    setWorkflowMessage('');
    setWorkflowChannel('');
    setWorkflowRole('');
    setWorkflowOpen(false);
  };

  const createProfile = async () => {
    if (!profileName.trim() || !profileRole) return;
    const commandNames = (COMMANDS_BY_CATEGORY[profileCategory] ?? []).map((item) => item.name);
    await ops.createProfile.mutateAsync({
      name: profileName,
      description: `Adgang til ${profileCategory}`,
      role_ids: [profileRole],
      command_names: commandNames,
      cooldown_seconds: Number(profileCooldown) || 0,
    });
    setProfileName('');
    setProfileRole('');
    setProfileCooldown('0');
    setProfileOpen(false);
  };

  const applyBuiltInPreset = (preset: typeof BUILT_IN_PRESETS[number]) => {
    const enabledCommands = preset.categories.flatMap((category) =>
      (COMMANDS_BY_CATEGORY[category] ?? []).map((item) => item.name)
    );
    const allCommands = Object.values(COMMANDS_BY_CATEGORY).flat().map((item) => item.name);
    const enabledSet = new Set(enabledCommands);
    const disabledCommands = allCommands.filter((name) => !enabledSet.has(name));
    ops.applyPresetRules.mutate({
      name: preset.name,
      enabledCommands,
      disabledCommands,
    });
  };

  if (ops.isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Siren className="h-4 w-4" />
            Platform V3
          </div>
          <h1 className="text-3xl font-bold">Operations Center</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Cases, appeals, alerts, workflows, staff-performance, command health og brugerhistorik samlet i ét kontrolrum.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Åbne cases" value={ops.openCases.length} icon={<Shield className="h-4 w-4" />} danger={ops.openCases.length > 0} />
        <Metric label="Pending appeals" value={ops.pendingAppeals.length} icon={<FileSearch className="h-4 w-4" />} danger={ops.pendingAppeals.length > 0} />
        <Metric label="Aktive alerts" value={ops.openAlerts.length} icon={<Bell className="h-4 w-4" />} danger={ops.openAlerts.some((item) => item.severity === 'critical')} />
        <Metric label="Workflows" value={ops.workflows.filter((item) => item.enabled).length} icon={<WorkflowIcon className="h-4 w-4" />} />
        <Metric label="Command issues" value={ops.unhealthyCommands.length} icon={<HeartPulse className="h-4 w-4" />} danger={ops.unhealthyCommands.length > 0} />
        <Metric label="Planlagte mod-actions" value={ops.scheduledModeration.filter((item) => item.status === 'pending').length} icon={<Clock3 className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="users">User 360</TabsTrigger>
          <TabsTrigger value="appeals">Appeals</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="health">Health & Staff</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <QuickLink to="/dashboard/automod" title="AutoMod V2" description="Spam, links, invites, mentions, caps, ord og AI toxicity." icon={<ShieldCheck className="h-5 w-5" />} />
            <QuickLink to="/dashboard/raid-protection" title="Anti-Raid Center" description="Mass joins, lockdown, kick, ban og quarantine." icon={<Siren className="h-5 w-5" />} />
            <QuickLink to="/dashboard/tickets" title="Tickets V3" description="Priority, SLA, tags, escalation og interne noter." icon={<Ticket className="h-5 w-5" />} />
            <QuickLink to="/dashboard/custom-commands" title="Command Builder" description="Custom responses, permissions, conditions og interaktioner." icon={<Bot className="h-5 w-5" />} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Seneste kritiske signaler</CardTitle>
                <CardDescription>Åbne alerts med højeste severity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {ops.openAlerts.filter((item) => ['critical', 'error', 'warning'].includes(item.severity)).slice(0, 6).map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={severityVariant[alert.severity] ?? 'outline'}>{alert.severity}</Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(alert.created_at)}</span>
                  </div>
                ))}
                {!ops.openAlerts.length && <Empty text="Ingen aktive alerts." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Command health</CardTitle>
                <CardDescription>Commands der kræver opmærksomhed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {ops.unhealthyCommands.slice(0, 8).map((command) => (
                  <div key={command.command_name} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-mono text-sm">{getCommandSlashPath(command.command_name || '')}</div>
                      <div className="text-xs text-muted-foreground">{command.executions ?? 0} executions · {command.avg_latency_ms ?? 0} ms avg</div>
                    </div>
                    <Badge variant={Number(command.error_rate ?? 0) >= 30 ? 'destructive' : 'secondary'}>
                      {Number(command.error_rate ?? 0).toFixed(1)}% fejl
                    </Badge>
                  </div>
                ))}
                {!ops.unhealthyCommands.length && <Empty text="Alle målte commands ser sunde ud." />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cases" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Open" value={casesByStatus.open} icon={<AlertTriangle className="h-4 w-4" />} />
            <Metric label="Investigating" value={casesByStatus.investigating} icon={<Search className="h-4 w-4" />} />
            <Metric label="Resolved" value={casesByStatus.resolved} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Case Center</CardTitle>
              <CardDescription>Moderation-sager med status, severity, assignment, notes og evidence.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Bruger</TableHead>
                    <TableHead>Handling</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Tid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.cases.slice(0, 150).map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => openCase(item)}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                      <TableCell>{item.target_name || item.target_id}</TableCell>
                      <TableCell><Badge variant="outline">{item.action_type}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                      <TableCell><Badge variant={severityVariant[item.severity] ?? 'outline'}>{item.severity}</Badge></TableCell>
                      <TableCell>{item.assigned_to_name || 'Ikke assigned'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>User 360</CardTitle>
              <CardDescription>Søg på Discord-ID eller navn og få samlet moderation/ticket/note-historik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Discord ID eller brugernavn..." />
                <Button onClick={() => ops.searchUser.mutate(userQuery)} disabled={!userQuery.trim() || ops.searchUser.isPending}>
                  {ops.searchUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundSearch className="mr-2 h-4 w-4" />}
                  Søg
                </Button>
              </div>
            </CardContent>
          </Card>

          {ops.searchUser.data && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <Metric label="Risk score" value={ops.searchUser.data.summary.riskScore} icon={<Siren className="h-4 w-4" />} danger={ops.searchUser.data.summary.riskScore >= 10} />
                <Metric label="Risk" value={ops.searchUser.data.summary.riskLabel} icon={<Shield className="h-4 w-4" />} />
                <Metric label="Cases" value={ops.searchUser.data.summary.totalCases} icon={<FileSearch className="h-4 w-4" />} />
                <Metric label="Aktive cases" value={ops.searchUser.data.summary.activeCases} icon={<AlertTriangle className="h-4 w-4" />} />
                <Metric label="Warnings" value={ops.searchUser.data.summary.warnings} icon={<AlertTriangle className="h-4 w-4" />} />
                <Metric label="Tickets" value={ops.searchUser.data.summary.tickets} icon={<Ticket className="h-4 w-4" />} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{ops.searchUser.data.displayName || ops.searchUser.data.userId || 'Bruger'}</CardTitle>
                  <CardDescription>
                    Smart Assist: {ops.searchUser.data.summary.riskLabel} risiko baseret på nyere cases, severity, åbne sager og warnings. Det er et signal til staff, ikke en automatisk straf.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {ops.searchUser.data.cases.slice(0, 15).map((item) => (
                      <button key={item.id} onClick={() => openCase(item)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/30">
                        <div>
                          <div className="font-medium">{item.action_type} · {item.reason || 'Ingen årsag'}</div>
                          <div className="text-xs text-muted-foreground">{item.moderator_name || item.moderator_id} · {formatDate(item.created_at)}</div>
                        </div>
                        <Badge variant={severityVariant[item.severity] ?? 'outline'}>{item.severity}</Badge>
                      </button>
                    ))}
                    {!ops.searchUser.data.cases.length && <Empty text="Ingen moderation-cases fundet." />}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="appeals">
          <Card>
            <CardHeader>
              <CardTitle>Appeals</CardTitle>
              <CardDescription>Review bans/warnings og bed om mere information uden at miste case-kontekst.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ops.appeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{appeal.appellant_name || appeal.appellant_discord_id}</span>
                        <Badge variant="outline">{appeal.status}</Badge>
                        {appeal.case_id && <Badge variant="secondary">Case {appeal.case_id.slice(0, 8)}</Badge>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{appeal.message}</p>
                      {appeal.staff_response && <p className="mt-2 text-sm"><strong>Staff:</strong> {appeal.staff_response}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => ops.updateAppeal.mutate({ id: appeal.id, status: 'needs_info', staff_response: 'Vi mangler mere information før sagen kan afgøres.' })}>Mere info</Button>
                      <Button size="sm" onClick={() => ops.updateAppeal.mutate({ id: appeal.id, status: 'accepted', staff_response: 'Appeal accepteret.' })}>Accept</Button>
                      <Button size="sm" variant="destructive" onClick={() => ops.updateAppeal.mutate({ id: appeal.id, status: 'rejected', staff_response: 'Appeal afvist.' })}>Reject</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!ops.appeals.length && <Empty text="Ingen appeals endnu." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alert Center</CardTitle>
              <CardDescription>Raid, command-health, workflow-fejl, SLA og andre driftssignaler.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ops.alerts.map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityVariant[alert.severity] ?? 'outline'}>{alert.severity}</Badge>
                      <Badge variant="outline">{alert.status}</Badge>
                      <span className="font-medium">{alert.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.source} · {formatDate(alert.created_at)}</p>
                  </div>
                  {alert.status !== 'resolved' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => ops.updateAlert.mutate({ id: alert.id, status: 'acknowledged' })}>Acknowledge</Button>
                      <Button size="sm" onClick={() => ops.updateAlert.mutate({ id: alert.id, status: 'resolved' })}>Resolve</Button>
                    </div>
                  )}
                </div>
              ))}
              {!ops.alerts.length && <Empty text="Ingen alerts." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setWorkflowOpen(true)}><Plus className="mr-2 h-4 w-4" />Nyt workflow</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {ops.workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{workflow.name}</CardTitle>
                      <CardDescription>{workflow.trigger_type}</CardDescription>
                    </div>
                    <Switch checked={workflow.enabled} onCheckedChange={(enabled) => ops.updateWorkflow.mutate({ id: workflow.id, updates: { enabled } })} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{workflow.description || 'Ingen beskrivelse'}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{workflow.run_count} runs</span>
                    <span>{workflow.last_run_at ? formatDate(workflow.last_run_at) : 'Ikke kørt'}</span>
                  </div>
                  <Button className="mt-4 w-full" variant="destructive" size="sm" onClick={() => ops.deleteWorkflow.mutate(workflow.id)}>Slet workflow</Button>
                </CardContent>
              </Card>
            ))}
            {!ops.workflows.length && <Card><CardContent className="py-12"><Empty text="Ingen workflows endnu." /></CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Permission Profiles</CardTitle>
                    <CardDescription>Genbrug samme command-adgang på roller og kategorier.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setProfileOpen(true)}><Plus className="mr-1 h-4 w-4" />Ny</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {ops.profiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">{profile.command_names.length} commands · {profile.role_ids.length} roller</div>
                    </div>
                    <Button size="sm" onClick={() => ops.applyProfile.mutate(profile)}>Anvend</Button>
                  </div>
                ))}
                {!ops.profiles.length && <Empty text="Ingen permission profiles." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Command Presets</CardTitle>
                <CardDescription>Aktiver relevante command-pakker med ét klik.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {BUILT_IN_PRESETS.map((preset) => (
                  <div key={preset.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => applyBuiltInPreset(preset)}>Anvend</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-5">
          <CommandTestCenter health={ops.commandHealth} />
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Command Health</CardTitle><CardDescription>7-dages signaler fra faktisk execution-data.</CardDescription></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Command</TableHead><TableHead>Runs</TableHead><TableHead>Error</TableHead><TableHead>Latency</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {ops.commandHealth.map((item) => (
                        <TableRow key={item.command_name}>
                          <TableCell className="font-mono text-xs">{getCommandSlashPath(item.command_name || '')}</TableCell>
                          <TableCell>{item.executions ?? 0}</TableCell>
                          <TableCell><Badge variant={Number(item.error_rate ?? 0) >= 20 ? 'destructive' : 'outline'}>{Number(item.error_rate ?? 0).toFixed(1)}%</Badge></TableCell>
                          <TableCell>{item.avg_latency_ms ?? 0} ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Staff Performance</CardTitle><CardDescription>30 dage, baseret på moderation og lukkede tickets.</CardDescription></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Mod</TableHead><TableHead>Tickets</TableHead><TableHead>Senest</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ops.staff.map((item) => (
                      <TableRow key={item.staff_id}>
                        <TableCell>{item.staff_name || item.staff_id}</TableCell>
                        <TableCell>{item.moderation_actions ?? 0}</TableCell>
                        <TableCell>{item.tickets_closed ?? 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(item.last_activity_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Audit & Undo</CardTitle><CardDescription>Dashboard-ændringer med rollback hvor der findes undo-data.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {ops.audit.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{entry.action}</Badge>
                      <span className="font-medium">{entry.target_type}</span>
                      {entry.target_id && <span className="font-mono text-xs text-muted-foreground">{entry.target_id.slice(0, 16)}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.user_email || entry.user_id} · {formatDate(entry.created_at)}</div>
                  </div>
                  {entry.undo_payload && !entry.undone_at ? (
                    <Button size="sm" variant="outline" onClick={() => ops.undoAudit.mutate(entry)}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />Undo
                    </Button>
                  ) : entry.undone_at ? (
                    <Badge variant="secondary">Rullet tilbage</Badge>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={caseOpen} onOpenChange={setCaseOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <DialogTitle>Case {selectedCase.id.slice(0, 8)} · {selectedCase.target_name || selectedCase.target_id}</DialogTitle>
                <DialogDescription>{selectedCase.reason || 'Ingen årsag'}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Status</Label>
                  <Select value={selectedCase.status} onValueChange={(status) => ops.updateCase.mutate({ id: selectedCase.id, updates: { status } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                      <SelectItem value="appealed">Appealed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select value={selectedCase.severity} onValueChange={(severity) => ops.updateCase.mutate({ id: selectedCase.id, updates: { severity } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assigned</Label>
                  <Input
                    defaultValue={selectedCase.assigned_to_name || ''}
                    placeholder="Staff navn"
                    onBlur={(event) => ops.updateCase.mutate({
                      id: selectedCase.id,
                      updates: { assigned_to_name: event.target.value || null },
                    })}
                  />
                </div>
              </div>

              <div>
                <Label>Resolution</Label>
                <Textarea
                  defaultValue={selectedCase.resolution || ''}
                  placeholder="Hvordan blev sagen afsluttet?"
                  onBlur={(event) => ops.updateCase.mutate({
                    id: selectedCase.id,
                    updates: { resolution: event.target.value || null },
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Evidence</h3>
                <Button size="sm" onClick={() => setEvidenceOpen(true)}><Plus className="mr-1 h-4 w-4" />Tilføj</Button>
              </div>
              <div className="space-y-2">
                {(evidence.data ?? []).map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2"><Badge variant="outline">{item.evidence_type}</Badge><span className="font-medium">{item.label || 'Evidence'}</span></div>
                    <p className="mt-2 break-all text-sm text-muted-foreground">{item.content || item.url || item.message_id}</p>
                  </div>
                ))}
                {!evidence.data?.length && <Empty text="Ingen evidence tilknyttet." />}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tilføj evidence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={evidenceType} onValueChange={(value) => setEvidenceType(value as typeof evidenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="message">Message ID</SelectItem>
                <SelectItem value="attachment">Attachment URL</SelectItem>
              </SelectContent>
            </Select>
            <Input value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder="Label..." />
            <Textarea value={evidenceValue} onChange={(event) => setEvidenceValue(event.target.value)} placeholder="Indhold / URL / message ID..." />
            <Button className="w-full" onClick={createEvidence} disabled={!evidenceValue.trim() || ops.addEvidence.isPending}>Gem evidence</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nyt workflow</DialogTitle><DialogDescription>Trigger → action uden kode.</DialogDescription></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Navn</Label><Input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} /></div>
            <div>
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member_join">Member join</SelectItem>
                  <SelectItem value="message_keyword">Message keyword</SelectItem>
                  <SelectItem value="ticket_created">Ticket created</SelectItem>
                  <SelectItem value="command_error">Command error</SelectItem>
                  <SelectItem value="raid_detected">Raid detected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {triggerType === 'message_keyword' && <div><Label>Keyword</Label><Input value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} /></div>}
            <div>
              <Label>Action</Label>
              <Select value={workflowAction} onValueChange={setWorkflowAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard_alert">Dashboard alert</SelectItem>
                  <SelectItem value="send_message">Send message</SelectItem>
                  <SelectItem value="dm">DM bruger</SelectItem>
                  <SelectItem value="add_role">Add role</SelectItem>
                  <SelectItem value="remove_role">Remove role</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {['send_message'].includes(workflowAction) && (
              <div><Label>Kanal</Label><Select value={workflowChannel} onValueChange={setWorkflowChannel}><SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger><SelectContent>{channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>)}</SelectContent></Select></div>
            )}
            {['add_role', 'remove_role'].includes(workflowAction) && (
              <div><Label>Rolle</Label><Select value={workflowRole} onValueChange={setWorkflowRole}><SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger><SelectContent>{roles.filter((role) => role.name !== '@everyone').map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
            )}
            <div className="md:col-span-2"><Label>Message</Label><Textarea value={workflowMessage} onChange={(e) => setWorkflowMessage(e.target.value)} placeholder="Understøtter {user}, {username}, {server}..." /></div>
          </div>
          <Button onClick={createWorkflow} disabled={!workflowName.trim() || ops.createWorkflow.isPending}>Opret workflow</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny permission profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Navn</Label><Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Moderator" /></div>
            <div><Label>Rolle</Label><Select value={profileRole} onValueChange={setProfileRole}><SelectTrigger><SelectValue placeholder="Vælg rolle" /></SelectTrigger><SelectContent>{roles.filter((role) => role.name !== '@everyone').map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Command kategori</Label><Select value={profileCategory} onValueChange={setProfileCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(COMMANDS_BY_CATEGORY).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Cooldown</Label><Input type="number" min={0} max={86400} value={profileCooldown} onChange={(e) => setProfileCooldown(e.target.value)} /></div>
            <Button className="w-full" onClick={createProfile} disabled={!profileName || !profileRole}>Opret profil</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, icon, danger = false }: { label: string; value: string | number; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Card className={danger ? 'border-destructive/30' : ''}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className={danger ? 'text-destructive' : 'text-primary'}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, title, description, icon }: { to: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <Link to={to as never} className="block">
      <Card className="h-full transition-colors hover:bg-muted/30">
        <CardContent className="flex h-full items-center gap-4 p-5">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{text}</div>;
}
