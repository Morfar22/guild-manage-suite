import { useGuild } from '@/contexts/GuildContext';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useModerationLogs } from '@/hooks/useModerationLogs';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatusCard } from '@/components/dashboard/StatusCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ConfigurationAlerts } from '@/components/dashboard/ConfigurationAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity, Users, MessageSquare, Shield, Clock, Zap, TrendingUp, BarChart3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

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
  const { t, language } = useLanguage();
  const dateFnsLocale = language === 'da' ? da : enUS;

  const moduleUsageData = [
    { name: t('dashboard.messages'), value: summary.total_messages, color: 'hsl(var(--chart-1))' },
    { name: 'Commands', value: summary.total_commands, color: 'hsl(var(--chart-2))' },
    { name: 'XP', value: summary.total_xp, color: 'hsl(var(--chart-3))' },
    { name: t('dashboard.modActions'), value: summary.mod_actions, color: 'hsl(var(--chart-4))' },
  ].filter(d => d.value > 0);

  const getUptime = () => {
    if (!status?.last_heartbeat) return 'N/A';
    const lastBeat = new Date(status.last_heartbeat);
    const now = new Date();
    const diffMs = now.getTime() - lastBeat.getTime();
    if (diffMs < 120000) return '100%';
    return t('common.offline');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="surface-card relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium ${isOnline ? 'text-success' : 'text-destructive'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
            {isOnline ? t('common.online') : t('common.offline')}
          </span>
          <span className="text-xs text-muted-foreground">{selectedGuild?.guild_name}</span>
        </div>
        <h1 className="relative mt-4 font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          {t('dashboard.title')}
        </h1>
        <p className="relative mt-2 max-w-xl text-muted-foreground">
          {t('dashboard.overview', { guild: selectedGuild?.guild_name || 'din server' })}
        </p>
      </div>


      <ConfigurationAlerts />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          title={t('dashboard.botStatus')}
          value={statusLoading ? t('common.loading') : isOnline ? t('common.online') : t('common.offline')}
          description={isOnline ? t('dashboard.allSystemsRunning') : t('dashboard.botNotResponding')}
          icon={Activity}
          variant={isOnline ? 'success' : 'destructive'}
          pulse={isOnline}
        />
        <StatusCard
          title={t('dashboard.uptime')}
          value={statusLoading ? '...' : getUptime()}
          description={t('dashboard.basedOnHeartbeat')}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMessages)" name={t('dashboard.messages')} />
                    <Area type="monotone" dataKey="xp" stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorXp)" name="XP" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {t('dashboard.noActivityData')}
                </div>
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
            <div className="h-[200px] flex items-center justify-center">
              {moduleUsageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moduleUsageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {moduleUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-muted-foreground text-sm">{t('dashboard.noData')}</span>
              )}
            </div>
            {moduleUsageData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {moduleUsageData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('dashboard.memberGrowth')}
            </CardTitle>
            <CardDescription>{t('dashboard.memberGrowthDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[150px]">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="members_joined" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t('dashboard.joined')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('common.noData')}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('dashboard.moderationActions')}
            </CardTitle>
            <CardDescription>{t('dashboard.moderationActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[150px]">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="mod_actions" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name={t('dashboard.modActions')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('common.noData')}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="mb-4 font-display text-xl font-semibold text-foreground">{t('dashboard.serverStats')}</h2>
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
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground">{t('dashboard.botConfig')}</h3>

          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('dashboard.commandPrefix')}</span>
              <span className="font-mono text-foreground">{selectedGuild?.command_prefix || '!'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('dashboard.logChannel')}</span>
              <span className="text-foreground">
                {selectedGuild?.log_channel_id ? `#${selectedGuild.log_channel_id}` : t('common.notSet')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('dashboard.autoModeration')}</span>
              <span className={selectedGuild?.auto_moderation_enabled ? 'text-green-500' : 'text-muted-foreground'}>
                {selectedGuild?.auto_moderation_enabled ? t('common.enabled') : t('common.disabled')}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground">{t('dashboard.recentActivity')}</h3>
          <div className="mt-4 space-y-3">
            {logsLoading ? (
              <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('dashboard.noRecentMod')}</p>
            ) : (
              logs.slice(0, 3).map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      User {log.action_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {log.moderator_name || log.moderator_id}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateFnsLocale })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
