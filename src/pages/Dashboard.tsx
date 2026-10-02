import type { ReactNode } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useModerationLogs } from '@/hooks/useModerationLogs';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useOperationsSummary } from '@/hooks/useOperationsSummary';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatusCard } from '@/components/dashboard/StatusCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ConfigurationAlerts } from '@/components/dashboard/ConfigurationAlerts';
import { SetupProgress } from '@/components/dashboard/SetupProgress';
import { useConfigurationAlerts } from '@/hooks/useConfigurationAlerts';
import { DashboardWidgetSettings } from '@/components/dashboard/DashboardWidgetSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarClock,
  Clock,
  FileSearch,
  HeartPulse,
  MessageSquare,
  Shield,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function Dashboard() {
  const { selectedGuild } = useGuild();
  const { status, isOnline, loading: statusLoading } = useBotStatus();
  const { logs, loading: logsLoading } = useModerationLogs({ limit: 5 });
  const { chartData, summary, hasData } = useAnalytics(7);
  const { data: opsSummary } = useOperationsSummary();
  const { alerts: configurationAlerts } = useConfigurationAlerts();
  const prefs = useDashboardPreferences();
  const { t, language } = useLanguage();
  const dateFnsLocale = language === 'da' ? da : enUS;

  const visible = (id: string) => prefs.widgets.includes(id);

  const moduleUsageData = [
    { name: t('dashboard.messages'), value: summary.total_messages, color: 'hsl(var(--chart-1))' },
    { name: 'Commands', value: summary.total_commands, color: 'hsl(var(--chart-2))' },
    { name: 'XP', value: summary.total_xp, color: 'hsl(var(--chart-3))' },
    { name: t('dashboard.modActions'), value: summary.mod_actions, color: 'hsl(var(--chart-4))' },
  ].filter((item) => item.value > 0);

  const getHeartbeatAge = () => {
    if (!status?.last_heartbeat) return 'N/A';
    return formatDistanceToNow(new Date(status.last_heartbeat), {
      addSuffix: true,
      locale: dateFnsLocale,
    });
  };

  const attentionCount =
    configurationAlerts.length
    + (opsSummary?.openAlerts ?? 0)
    + (opsSummary?.overdueSla ?? 0)
    + (opsSummary?.commandIssues ?? 0);

  return (
    <div className={`${prefs.compactMode ? 'space-y-4' : 'space-y-8'} animate-fade-in`}>
      <div className="surface-card relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium ${isOnline ? 'text-success' : 'text-destructive'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                {isOnline ? t('common.online') : t('common.offline')}
              </span>
              <span className="text-xs text-muted-foreground">{selectedGuild?.guild_name}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight lg:text-4xl">
              {t('dashboard.title')}
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {t('dashboard.overview', { guild: selectedGuild?.guild_name || 'din server' })}
            </p>
          </div>
          <DashboardWidgetSettings />
        </div>
      </div>

      <SetupProgress />

      {attentionCount > 0 && (
        <Card className="border-warning/25 bg-warning/[0.035]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-semibold">
                  {attentionCount} {language === 'da' ? 'ting kræver opmærksomhed' : 'items need attention'}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === 'da'
                    ? 'Konfiguration, alerts og SLA-signaler er samlet her, før du går videre til graferne.'
                    : 'Configuration, alerts and SLA signals are surfaced before analytics.'}
                </p>
              </div>
            </div>
            <a href="/dashboard/operations">
              <Button variant="outline" size="sm">
                {language === 'da' ? 'Åbn Operations Center' : 'Open Operations Center'}
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      <ConfigurationAlerts />

      {visible('operations') && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Operations Pulse</h2>
              <p className="text-sm text-muted-foreground">Live signaler der kræver staff-opmærksomhed.</p>
            </div>
            <a href="/dashboard/operations" className="text-sm font-medium text-primary hover:underline">
              Operations Center
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <PulseCard label="Åbne cases" value={opsSummary?.openCases ?? 0} icon={<FileSearch className="h-4 w-4" />} />
            <PulseCard label="Appeals" value={opsSummary?.pendingAppeals ?? 0} icon={<Shield className="h-4 w-4" />} />
            <PulseCard label="Alerts" value={opsSummary?.openAlerts ?? 0} icon={<Bell className="h-4 w-4" />} />
            <PulseCard label="SLA" value={opsSummary?.overdueSla ?? 0} icon={<Ticket className="h-4 w-4" />} danger />
            <PulseCard label="Command issues" value={opsSummary?.commandIssues ?? 0} icon={<HeartPulse className="h-4 w-4" />} danger />
            <PulseCard label="Planlagt mod" value={opsSummary?.scheduledModeration ?? 0} icon={<CalendarClock className="h-4 w-4" />} />
          </div>
        </section>
      )}

      {visible('bot_status') && (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            title={t('dashboard.botStatus')}
            value={statusLoading ? t('common.loading') : isOnline ? t('common.online') : t('common.offline')}
            description={isOnline ? t('dashboard.allSystemsRunning') : t('dashboard.botNotResponding')}
            icon={Activity}
            variant={isOnline ? 'success' : 'destructive'}
            pulse={isOnline}
          />
          <StatusCard
            title={language === 'da' ? 'Seneste heartbeat' : 'Last heartbeat'}
            value={statusLoading ? '...' : getHeartbeatAge()}
            description={language === 'da' ? 'Faktisk seneste signal fra bot-processen' : 'Actual latest signal from the bot process'}
            icon={Clock}
            variant="default"
          />
          <StatusCard
            title={t('dashboard.latency')}
            value={status?.latency_ms ? `${status.latency_ms}ms` : 'N/A'}
            description={t('dashboard.apiResponseTime')}
            icon={Zap}
            variant="default"
          />
        </section>
      )}

      {visible('activity') && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('dashboard.weeklyActivity')}
              </CardTitle>
              <CardDescription>{t('dashboard.weeklyActivityDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" name={t('dashboard.messages')} />
                      <Area type="monotone" dataKey="xp" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.08)" name="XP" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty text={t('dashboard.noActivityData')} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t('dashboard.activityDistribution')}
              </CardTitle>
              <CardDescription>{t('dashboard.activityDistributionDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[200px] items-center justify-center">
                {moduleUsageData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={moduleUsageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {moduleUsageData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty text={t('dashboard.noData')} />
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {visible('growth') && (
        <section className="grid gap-6 lg:grid-cols-2">
          <ChartCard title={t('dashboard.memberGrowth')} description={t('dashboard.memberGrowthDesc')}>
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="members_joined" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text={t('common.noData')} />}
          </ChartCard>

          <ChartCard title={t('dashboard.moderationActions')} description={t('dashboard.moderationActionsDesc')}>
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="mod_actions" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text={t('common.noData')} />}
          </ChartCard>
        </section>
      )}

      {visible('server_stats') && (
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="font-display text-xl font-semibold">{t('dashboard.serverStats')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatusCard title={t('dashboard.members')} value={status?.member_count?.toLocaleString() || 'N/A'} icon={Users} />
              <StatusCard title={t('dashboard.messagesToday')} value={status?.message_count_today?.toLocaleString() || 'N/A'} icon={MessageSquare} />
              <StatusCard title={t('dashboard.modActions')} value={logsLoading ? '...' : logs.length.toString()} description={t('dashboard.recent')} icon={Shield} />
              <StatusCard
                title={t('dashboard.commandsUsed')}
                value={summary.total_commands > 0 ? summary.total_commands.toLocaleString() : '—'}
                description={summary.total_commands > 0 ? t('dashboard.last7days') : t('dashboard.comingSoon')}
                icon={Activity}
              />
            </div>
          </div>
          <QuickActions />
        </section>
      )}

      {visible('recent_activity') && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card rounded-xl p-6">
            <h3 className="font-display font-semibold">{t('dashboard.botConfig')}</h3>
            <div className="mt-4 space-y-3">
              <ConfigRow label={t('dashboard.commandPrefix')} value={selectedGuild?.command_prefix || '!'} mono />
              <ConfigRow label={t('dashboard.logChannel')} value={selectedGuild?.log_channel_id ? `#${selectedGuild.log_channel_id}` : t('common.notSet')} />
              <ConfigRow label={t('dashboard.autoModeration')} value={selectedGuild?.auto_moderation_enabled ? t('common.enabled') : t('common.disabled')} />
            </div>
          </div>

          <div className="surface-card rounded-xl p-6">
            <h3 className="font-display font-semibold">{t('dashboard.recentActivity')}</h3>
            <div className="mt-4 space-y-3">
              {logsLoading ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.noRecentMod')}</p>
              ) : logs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{log.action_type}</p>
                    <p className="text-xs text-muted-foreground">by {log.moderator_name || log.moderator_id}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateFnsLocale })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PulseCard({ label, value, icon, danger = false }: { label: string; value: number; icon: ReactNode; danger?: boolean }) {
  const activeDanger = danger && value > 0;
  return (
    <Card className={activeDanger ? 'border-destructive/30 bg-destructive/[0.03]' : 'border-border/60'}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${activeDanger ? 'text-destructive' : ''}`}>{value}</p>
        </div>
        <div className={activeDanger ? 'text-destructive' : 'text-primary'}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent><div className="h-[160px]">{children}</div></CardContent>
    </Card>
  );
}

function ConfigRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'rounded-md bg-secondary/60 px-2 font-mono' : ''}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
