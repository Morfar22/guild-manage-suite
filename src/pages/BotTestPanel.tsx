import { useState, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useConfigurationAlerts } from '@/hooks/useConfigurationAlerts';
import { supabase } from '@/integrations/supabase/client';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2,
  Heart, Zap, Users, MessageSquare, Clock, Wifi, WifiOff, Shield,
  TrendingUp, Wrench, Smile, Coins, Gift, ShoppingCart, Ticket,
  Mail, Star, Mic, Sparkles, Gamepad2, Play, Terminal, Package,
  Link2, FileQuestion,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail' | 'warn';

interface HandlerCheck {
  id: string;
  name: string;
  icon: React.ElementType;
  table: string;
  description: string;
  status: TestStatus;
  detail?: string;
}

interface CommandTestResult {
  active: string[];
  disabled: string[];
}

interface ModuleTestResult {
  name: string;
  enabled: boolean;
}

const HANDLER_CHECKS: Omit<HandlerCheck, 'status' | 'detail'>[] = [
  { id: 'welcome', name: 'Welcome', icon: Users, table: 'welcome_settings', description: 'Velkomstbeskeder' },
  { id: 'leveling', name: 'Leveling', icon: TrendingUp, table: 'leveling_settings', description: 'XP & Levels' },
  { id: 'moderation', name: 'Moderation', icon: Shield, table: 'warning_settings', description: 'Advarsler & Straffe' },
  { id: 'tickets', name: 'Tickets', icon: Ticket, table: 'ticket_settings', description: 'Ticket-system' },
  { id: 'economy', name: 'Economy', icon: Coins, table: 'economy_settings', description: 'Økonomi-system' },
  { id: 'reaction_roles', name: 'Reaction Roles', icon: Smile, table: 'reaction_roles', description: 'Reaktionsroller' },
  { id: 'giveaways', name: 'Giveaways', icon: Gift, table: 'giveaways', description: 'Giveaway-system' },
  { id: 'starboard', name: 'Starboard', icon: Star, table: 'starboard_settings', description: 'Starboard' },
  { id: 'modmail', name: 'Modmail', icon: Mail, table: 'modmail_settings', description: 'Modmail-system' },
  { id: 'jtc', name: 'Join to Create', icon: Mic, table: 'jtc_settings', description: 'Dynamiske voice-kanaler' },
  { id: 'ai_chat', name: 'AI Chat', icon: Sparkles, table: 'ai_chat_settings', description: 'AI Chat-handler' },
  { id: 'automod', name: 'AutoMod', icon: Shield, table: 'automod_rules', description: 'Automatisk moderation' },
  { id: 'suggestions', name: 'Suggestions', icon: MessageSquare, table: 'suggestion_settings', description: 'Forslag-system' },
  { id: 'tebex', name: 'Tebex', icon: ShoppingCart, table: 'tebex_settings', description: 'Tebex-integration' },
  { id: 'fivem', name: 'FiveM', icon: Gamepad2, table: 'fivem_settings', description: 'FiveM-integration' },
  { id: 'twitch', name: 'Twitch', icon: Activity, table: 'twitch_streamers', description: 'Twitch notifikationer' },
  { id: 'auto_responders', name: 'Auto Responders', icon: MessageSquare, table: 'auto_responders', description: 'Automatiske svar' },
  { id: 'polls', name: 'Polls', icon: Activity, table: 'polls', description: 'Afstemninger' },
  { id: 'scheduler', name: 'Scheduler', icon: Clock, table: 'scheduled_messages', description: 'Planlagte beskeder' },
  { id: 'verification', name: 'Verification', icon: Shield, table: 'verification_settings', description: 'Verifikation' },
];

export default function BotTestPanel() {
  const { selectedGuild } = useGuild();
  const { t, language } = useLanguage();
  const { status: botStatus, isOnline, loading: botLoading, refetch: refetchBot } = useBotStatus();
  const { alerts, isLoading: alertsLoading } = useConfigurationAlerts();

  const [handlers, setHandlers] = useState<HandlerCheck[]>(
    HANDLER_CHECKS.map(h => ({ ...h, status: 'idle' as TestStatus }))
  );
  const [testingAll, setTestingAll] = useState(false);
  const [testProgress, setTestProgress] = useState(0);

  // Command test results (like /testall)
  const [commandResults, setCommandResults] = useState<CommandTestResult | null>(null);
  const [moduleResults, setModuleResults] = useState<ModuleTestResult[]>([]);
  const [commandTestDone, setCommandTestDone] = useState(false);

  const checkHandler = useCallback(async (handler: Omit<HandlerCheck, 'status' | 'detail'>): Promise<{ status: TestStatus; detail: string }> => {
    if (!selectedGuild) return { status: 'fail', detail: 'Ingen server valgt' };
    try {
      const { error, count } = await supabase
        .from(handler.table as any)
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', selectedGuild.id);

      if (error) return { status: 'fail', detail: `DB fejl: ${error.message}` };
      if (count === 0 || count === null) return { status: 'warn', detail: 'Ikke konfigureret for denne server' };
      return { status: 'pass', detail: `${count} ${count === 1 ? 'konfiguration' : 'konfigurationer'} fundet` };
    } catch (err: any) {
      return { status: 'fail', detail: err.message || 'Ukendt fejl' };
    }
  }, [selectedGuild]);

  const checkCommands = useCallback(async () => {
    if (!selectedGuild) return;

    // Fetch command states from guild_commands
    const { data: commandRows } = await supabase
      .from('guild_commands')
      .select('command_name, enabled')
      .eq('guild_id', selectedGuild.id);

    const commandStates: Record<string, boolean> = {};
    commandRows?.forEach(c => { commandStates[c.command_name] = c.enabled; });

    const allCommands = Object.values(COMMANDS_BY_CATEGORY).flat();
    const active: string[] = [];
    const disabled: string[] = [];

    for (const cmd of allCommands) {
      const state = commandStates[cmd.name];
      // Match bot logic: if not in DB or explicitly true, it's active (default enabled)
      if (state === false) {
        disabled.push(cmd.name);
      } else {
        active.push(cmd.name);
      }
    }

    setCommandResults({ active, disabled });
  }, [selectedGuild]);

  const checkModules = useCallback(async () => {
    if (!selectedGuild) return;

    const { data: modules } = await supabase
      .from('guild_modules')
      .select('module_type, enabled')
      .eq('guild_id', selectedGuild.id);

    if (modules) {
      setModuleResults(modules.map(m => ({ name: m.module_type, enabled: m.enabled })));
    }
  }, [selectedGuild]);

  const runAllTests = async () => {
    if (!selectedGuild) return;
    setTestingAll(true);
    setTestProgress(0);
    setCommandTestDone(false);

    const totalSteps = HANDLER_CHECKS.length + 2; // handlers + commands + modules

    const updated = [...handlers].map(h => ({ ...h, status: 'running' as TestStatus, detail: undefined }));
    setHandlers(updated);

    for (let i = 0; i < HANDLER_CHECKS.length; i++) {
      const result = await checkHandler(HANDLER_CHECKS[i]);
      setHandlers(prev =>
        prev.map(h => h.id === HANDLER_CHECKS[i].id ? { ...h, status: result.status, detail: result.detail } : h)
      );
      setTestProgress(Math.round(((i + 1) / totalSteps) * 100));
    }

    // Check commands
    await checkCommands();
    setTestProgress(Math.round(((HANDLER_CHECKS.length + 1) / totalSteps) * 100));

    // Check modules
    await checkModules();
    setTestProgress(100);

    setCommandTestDone(true);
    setTestingAll(false);
    toast.success(t('testPanel.testsComplete'));
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warn': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'running': return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
      case 'fail': return <Badge variant="destructive">Fejl</Badge>;
      case 'warn': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Advarsel</Badge>;
      case 'running': return <Badge variant="secondary">Kører...</Badge>;
      default: return <Badge variant="outline">Venter</Badge>;
    }
  };

  const passCount = handlers.filter(h => h.status === 'pass').length;
  const failCount = handlers.filter(h => h.status === 'fail').length;
  const warnCount = handlers.filter(h => h.status === 'warn').length;
  const totalAllCommands = Object.values(COMMANDS_BY_CATEGORY).flat().length;

  // Overall pass rate (like /testall)
  const commandPassRate = commandResults
    ? Math.round((commandResults.active.length / totalAllCommands) * 100)
    : null;

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('common.selectServer')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('testPanel.title')}</h1>
          <p className="text-muted-foreground">{t('testPanel.subtitle')}</p>
        </div>
        <Button onClick={runAllTests} disabled={testingAll} className="gap-2">
          {testingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {testingAll ? t('testPanel.running') : t('testPanel.runAll')}
        </Button>
      </div>

      {testingAll && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('testPanel.progress')}</span>
                <span className="font-medium">{testProgress}%</span>
              </div>
              <Progress value={testProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Score Card (shown after test) */}
      {commandTestDone && commandPassRate !== null && (
        <Card className={`border-2 ${commandPassRate === 100 ? 'border-green-500/40' : commandPassRate >= 75 ? 'border-yellow-500/40' : 'border-destructive/40'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${commandPassRate === 100 ? 'text-green-500' : commandPassRate >= 75 ? 'text-yellow-500' : 'text-destructive'}`}>
                  {commandPassRate}%
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {commandPassRate === 100 ? '🟢 Alle tests bestået' : commandPassRate >= 75 ? '🟡 De fleste tests bestået' : '🔴 Kritiske problemer fundet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {commandResults?.active.length} aktive · {commandResults?.disabled.length} deaktiverede
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{passCount} handlers OK</Badge>
                {warnCount > 0 && <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{warnCount} advarsler</Badge>}
                {failCount > 0 && <Badge variant="destructive">{failCount} fejl</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="commands" className="space-y-6">
        <TabsList>
          <TabsTrigger value="commands" className="gap-2">
            <Terminal className="h-4 w-4" />
            {t('testPanel.commandsTab')} ({totalAllCommands})
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Wrench className="h-4 w-4" />
            {t('testPanel.systemTab')}
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Heart className="h-4 w-4" />
            {t('testPanel.healthTab')}
          </TabsTrigger>
        </TabsList>

        {/* Commands Tab - Full /testall equivalent */}
        <TabsContent value="commands" className="space-y-4">
          {!commandTestDone ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Terminal className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">Kør "Kør alle tests" for at teste alle kommandoer og moduler</p>
                <Button onClick={runAllTests} disabled={testingAll} className="gap-2">
                  {testingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {testingAll ? t('testPanel.running') : t('testPanel.runAll')}
                </Button>
              </CardContent>
            </Card>
          ) : commandResults && (
            <>
              {/* Active Commands */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    Aktive kommandoer ({commandResults.active.length})
                  </CardTitle>
                  <CardDescription>Kommandoer der er aktiverede og klar til brug</CardDescription>
                </CardHeader>
                <CardContent>
                  {commandResults.active.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {commandResults.active.map(cmd => (
                        <Badge key={cmd} variant="secondary" className="font-mono text-xs bg-green-500/10 text-green-600 border-green-500/20">
                          /{cmd}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ingen aktive kommandoer</p>
                  )}
                </CardContent>
              </Card>

              {/* Disabled Commands */}
              {commandResults.disabled.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-500">
                      <AlertTriangle className="h-5 w-5" />
                      Deaktiverede kommandoer ({commandResults.disabled.length})
                    </CardTitle>
                    <CardDescription>Kommandoer der er slået fra i dashboardet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {commandResults.disabled.map(cmd => (
                        <Badge key={cmd} variant="outline" className="font-mono text-xs text-yellow-500 border-yellow-500/30">
                          /{cmd}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}




              {/* Module Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Modul Status ({moduleResults.length})
                  </CardTitle>
                  <CardDescription>Aktiverede/deaktiverede moduler for denne server</CardDescription>
                </CardHeader>
                <CardContent>
                  {moduleResults.length > 0 ? (
                    <div className="grid gap-2">
                      {moduleResults.map(mod => (
                        <div key={mod.name} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            {mod.enabled ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                            <span className="font-medium text-sm capitalize">{mod.name}</span>
                          </div>
                          <Badge className={mod.enabled ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                            {mod.enabled ? 'Aktiveret' : 'Deaktiveret'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ingen moduler konfigureret</p>
                  )}
                </CardContent>
              </Card>

              {/* Command Categories Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Kommandoer pr. kategori
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(COMMANDS_BY_CATEGORY).map(([category, commands]) => {
                      const activeInCat = commands.filter(c => commandResults.active.includes(c.name)).length;
                      const disabledInCat = commands.filter(c => commandResults.disabled.includes(c.name)).length;
                      const percent = Math.round((activeInCat / commands.length) * 100);

                      return (
                        <div key={category}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold capitalize">{category}</h4>
                              <Badge variant="outline" className="text-xs">{activeInCat}/{commands.length}</Badge>
                            </div>
                            <span className={`text-xs font-medium ${percent === 100 ? 'text-green-500' : percent >= 50 ? 'text-yellow-500' : 'text-destructive'}`}>
                              {percent}%
                            </span>
                          </div>
                          <Progress value={percent} className="h-1.5" />
                          {disabledInCat > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {disabledInCat} deaktiveret: {commands.filter(c => commandResults.disabled.includes(c.name)).map(c => `/${c.name}`).join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* System Overview */}
        <TabsContent value="system" className="space-y-4">
          {passCount + failCount + warnCount > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold">{passCount}</p>
                  <p className="text-sm text-muted-foreground">{t('testPanel.passed')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold">{warnCount}</p>
                  <p className="text-sm text-muted-foreground">{t('testPanel.warnings')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                  <p className="text-2xl font-bold">{failCount}</p>
                  <p className="text-sm text-muted-foreground">{t('testPanel.failed')}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                {t('testPanel.handlersTitle')} ({HANDLER_CHECKS.length})
              </CardTitle>
              <CardDescription>{t('testPanel.handlersDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {handlers.map((handler) => (
                  <div
                    key={handler.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(handler.status)}
                      <handler.icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-sm">{handler.name}</span>
                        <p className="text-xs text-muted-foreground">{handler.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {handler.detail && (
                        <span className="text-xs text-muted-foreground max-w-48 truncate">{handler.detail}</span>
                      )}
                      {getStatusBadge(handler.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Check */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {isOnline ? <Wifi className="h-8 w-8 text-green-500" /> : <WifiOff className="h-8 w-8 text-destructive" />}
                  <div>
                    <p className="text-sm text-muted-foreground">{t('testPanel.botStatus')}</p>
                    <p className="text-xl font-bold">{isOnline ? t('common.online') : t('common.offline')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('testPanel.latency')}</p>
                    <p className="text-xl font-bold">{botStatus?.latency_ms ?? '—'} ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('testPanel.members')}</p>
                    <p className="text-xl font-bold">{botStatus?.member_count?.toLocaleString() ?? '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('testPanel.messagesToday')}</p>
                    <p className="text-xl font-bold">{botStatus?.message_count_today?.toLocaleString() ?? '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    {t('testPanel.heartbeat')}
                  </CardTitle>
                  <CardDescription>{t('testPanel.heartbeatDesc')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={refetchBot} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('testPanel.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {botLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : botStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      {isOnline ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                      <span className="font-medium">{t('testPanel.connectionStatus')}</span>
                    </div>
                    <Badge className={isOnline ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-destructive/10 text-destructive'}>
                      {isOnline ? t('common.online') : t('common.offline')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{t('testPanel.lastHeartbeat')}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {botStatus.last_heartbeat
                        ? formatDistanceToNow(new Date(botStatus.last_heartbeat), { addSuffix: true, locale: language === 'da' ? da : undefined })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{t('testPanel.latency')}</span>
                    </div>
                    <Badge variant={
                      (botStatus.latency_ms ?? 999) < 100 ? 'default' :
                      (botStatus.latency_ms ?? 999) < 300 ? 'secondary' : 'destructive'
                    }>
                      {botStatus.latency_ms ?? '—'} ms
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('testPanel.noHeartbeat')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Alerts */}
          {!alertsLoading && alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  {t('testPanel.configAlerts')} ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      alert.severity === 'error' ? 'border-destructive/30 bg-destructive/5' :
                      alert.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-blue-500/30 bg-blue-500/5'
                    }`}
                  >
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                      alert.severity === 'error' ? 'text-destructive' :
                      alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{alert.module}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
