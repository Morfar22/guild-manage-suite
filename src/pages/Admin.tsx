import { useState, useEffect } from 'react';
import { Navigate, Link } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin, useAllUsers, useAllGuilds, useUserGuilds, useAssignGuildToUser, useRemoveGuildFromUser } from '@/hooks/useAdmin';
import { useAdminAllBots, useAdminLeaveGuild } from '@/hooks/useGuildBotSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Server, Plus, Trash2, Search, ArrowLeft, AlertTriangle, Bot, Activity, Clock, Wifi, WifiOff, LayoutDashboard, ScrollText, Database, Zap, ShieldCheck, Mail, LogOut, Terminal, ShieldAlert, Sparkles, Rocket } from 'lucide-react';
import { BotDeploymentPanel } from '@/components/admin/BotDeploymentPanel';
import { IPWhitelistManager } from '@/components/admin/IPWhitelistManager';
import { PremiumFeatureManager } from '@/components/admin/PremiumFeatureManager';
import { SystemStatsCards } from '@/components/admin/SystemStatsCards';
import { PendingAdminEmailsManager } from '@/components/admin/PendingAdminEmailsManager';
import { UserRoleManager } from '@/components/admin/UserRoleManager';
import { MassActionsPanel } from '@/components/admin/MassActionsPanel';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { DatabaseOverview } from '@/components/admin/DatabaseOverview';
import { BotConsoleViewer } from '@/components/admin/BotConsoleViewer';
import { ProtectedIdsManager } from '@/components/admin/ProtectedIdsManager';
import { GuildCommandDeployer } from '@/components/admin/GuildCommandDeployer';
import { useCheckIPAccess } from '@/hooks/useIPWhitelist';
import { AISafetyLogViewer } from '@/components/admin/AISafetyLogViewer';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: ipCheck, isLoading: ipCheckLoading } = useCheckIPAccess();
  const { data: users, isLoading: usersLoading } = useAllUsers();
  const { data: guilds, isLoading: guildsLoading } = useAllGuilds();
  const { data: adminBotsData, isLoading: botsLoading, error: botsError } = useAdminAllBots();
  const leaveGuild = useAdminLeaveGuild();
  const { toast } = useToast();
  

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [discordUserId, setDiscordUserId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingLogsForGuild, setViewingLogsForGuild] = useState<{ id: string; name: string } | null>(null);

  const { data: userGuilds, isLoading: userGuildsLoading } = useUserGuilds(selectedUserId);
  const assignGuild = useAssignGuildToUser();
  const removeGuild = useRemoveGuildFromUser();

  useEffect(() => {
    setDiscordUserId('');
    setSelectedGuildId('');
  }, [selectedUserId]);

  if (authLoading || adminLoading || ipCheckLoading) {
    return (
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-2xl p-6 pt-20">
          <Card className="border-destructive/50 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Ingen adgang
              </CardTitle>
              <CardDescription>Du har ikke admin-rettigheder til denne side.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/guilds"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Tilbage til servere</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (ipCheck && !ipCheck.allowed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-2xl p-6 pt-20">
          <Card className="border-destructive/50 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                IP ikke whitelistet
              </CardTitle>
              <CardDescription>Din IP-adresse ({ipCheck.ip}) er ikke på whitelist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Kontakt en administrator for at få din IP tilføjet til whitelist.</p>
              <Link to="/guilds"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Tilbage til servere</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const filteredUsers = users?.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const handleAssignGuild = async () => {
    if (!selectedUserId || !selectedGuildId || !discordUserId) {
      toast({ title: 'Fejl', description: 'Udfyld alle felter', variant: 'destructive' });
      return;
    }
    try {
      await assignGuild.mutateAsync({ userId: selectedUserId, guildId: selectedGuildId, discordUserId });
      toast({ title: 'Success', description: 'Server tilføjet til brugeren' });
      setSelectedGuildId('');
      setDiscordUserId('');
    } catch { toast({ title: 'Fejl', description: 'Kunne ikke tilføje server', variant: 'destructive' }); }
  };

  const handleRemoveGuild = async (guildId: string) => {
    if (!selectedUserId) return;
    try {
      await removeGuild.mutateAsync({ userId: selectedUserId, guildId });
      toast({ title: 'Success', description: 'Server fjernet fra brugeren' });
    } catch { toast({ title: 'Fejl', description: 'Kunne ikke fjerne server', variant: 'destructive' }); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ======================= NAV ======================= */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">GuildOS Bot</span>
          </Link>
          <Link to="/guilds">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Tilbage til servere</span>
              <span className="sm:hidden">Tilbage</span>
            </Button>
          </Link>
        </nav>
      </header>

      {/* ======================= HERO ======================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Administrator adgang</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-gradient">Admin</span> Panel
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              Administrer brugere, servere, bots og system-indstillinger på tværs af hele GuildOS Bot-platformen.
            </p>
          </div>
        </div>
      </section>

      {/* ======================= CONTENT ======================= */}
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 space-y-6">
        {/* System Stats */}
        <SystemStatsCards />

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" /><span className="hidden sm:inline">Brugere</span></TabsTrigger>
          <TabsTrigger value="bots" className="gap-1.5"><Bot className="h-4 w-4" /><span className="hidden sm:inline">Bots</span></TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5"><Rocket className="h-4 w-4" /><span className="hidden sm:inline">Deploy</span></TabsTrigger>
          <TabsTrigger value="safety" className="gap-1.5"><ShieldAlert className="h-4 w-4" /><span className="hidden sm:inline">Sikkerhed</span></TabsTrigger>
          <TabsTrigger value="console" className="gap-1.5"><Terminal className="h-4 w-4" /><span className="hidden sm:inline">Konsol</span></TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">Roller</span></TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5"><Mail className="h-4 w-4" /><span className="hidden sm:inline">Emails</span></TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /><span className="hidden sm:inline">Log</span></TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5"><Zap className="h-4 w-4" /><span className="hidden sm:inline">Værktøjer</span></TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5"><Database className="h-4 w-4" /><span className="hidden sm:inline">System</span></TabsTrigger>
        </TabsList>

        {/* Users & Guilds Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Brugere</CardTitle>
                <CardDescription>Vælg en bruger for at administrere deres servere</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Søg efter email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                {usersLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredUsers.map((u) => (
                      <button key={u.id} onClick={() => setSelectedUserId(u.id)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedUserId === u.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                        <span className="text-sm font-medium truncate">{u.email}</span>
                        {selectedUserId === u.id && <Badge variant="secondary">Valgt</Badge>}
                      </button>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-center text-muted-foreground py-4">Ingen brugere fundet</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User's Guilds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Brugerens servere</CardTitle>
                <CardDescription>{selectedUserId ? 'Administrer servere for den valgte bruger' : 'Vælg en bruger til venstre'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedUserId ? (
                  <p className="text-center text-muted-foreground py-8">Vælg en bruger for at se deres servere</p>
                ) : userGuildsLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {userGuilds && userGuilds.length > 0 ? userGuilds.map((ug: any) => (
                        <div key={ug.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <span className="font-medium">{ug.guilds?.guild_name || 'Unknown'}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveGuild(ug.guild_id)} disabled={removeGuild.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )) : (
                        <p className="text-center text-muted-foreground py-4">Brugeren har ingen servere</p>
                      )}
                    </div>
                    <div className="pt-4 border-t space-y-3">
                      <Label>Tilføj server til bruger</Label>
                      <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
                        <SelectTrigger><SelectValue placeholder="Vælg server" /></SelectTrigger>
                        <SelectContent>
                          {guildsLoading ? <SelectItem value="loading" disabled>Indlæser...</SelectItem> : guilds?.map((g) => <SelectItem key={g.id} value={g.id}>{g.guild_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="space-y-1">
                        <Label htmlFor="discord-user-id">Discord User ID</Label>
                        <Input id="discord-user-id" value={discordUserId} onChange={(e) => setDiscordUserId(e.target.value)} placeholder="f.eks. 123456789012345678" />
                      </div>
                      <Button onClick={handleAssignGuild} disabled={!selectedGuildId || !discordUserId || assignGuild.isPending} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />{assignGuild.isPending ? 'Tilføjer...' : 'Tilføj server'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bots Tab */}
        <TabsContent value="bots" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Bot Status Oversigt</CardTitle>
                  <CardDescription>Alle registrerede bots på tværs af alle servere</CardDescription>
                </div>
                {adminBotsData?.stats && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><Wifi className="h-4 w-4 text-green-500" /><span className="text-sm font-medium">{adminBotsData.stats.online} online</span></div>
                    <div className="flex items-center gap-2"><WifiOff className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{adminBotsData.stats.offline} offline</span></div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : botsError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Kunne ikke hente bot status</p>
                </div>
              ) : adminBotsData?.bots && adminBotsData.bots.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {adminBotsData.bots.map((bot) => (
                    <div key={bot.guild_id}>
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${bot.is_online ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {bot.bot_avatar_url || bot.guild_icon ? (
                              <img src={bot.bot_avatar_url || bot.guild_icon} alt={bot.bot_name} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><Bot className="h-5 w-5 text-muted-foreground" /></div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${bot.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{bot.guild_name}</p>
                              {bot.is_custom_bot && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Custom</Badge>}
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${bot.is_online ? 'text-green-600 border-green-600' : ''}`}>{bot.is_online ? 'Online' : 'Offline'}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{bot.member_count}</span>
                              {bot.is_online && <span className={`flex items-center gap-1 ${bot.latency_ms < 100 ? 'text-green-500' : bot.latency_ms < 200 ? 'text-yellow-500' : 'text-red-500'}`}><Activity className="h-3 w-3" />{bot.latency_ms}ms</span>}
                              {bot.last_heartbeat && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(bot.last_heartbeat), { addSuffix: true, locale: da })}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="text-xs text-muted-foreground text-right">
                            <p className="font-mono">{bot.discord_guild_id}</p>
                            <p>{bot.bot_name}</p>
                          </div>
                          <Link to={`/guilds?guild=${bot.guild_id}` as any}>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs" title="Åbn dashboard for denne server">
                              <LayoutDashboard className="h-3.5 w-3.5" />
                              Dashboard
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            title="Se konsol logs for denne server"
                            onClick={() => setViewingLogsForGuild(
                              viewingLogsForGuild?.id === bot.guild_id ? null : { id: bot.guild_id, name: bot.guild_name }
                            )}
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            Logs
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Fjern bot fra server">
                                <LogOut className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Fjern bot fra {bot.guild_name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Botten vil forlade Discord-serveren og alle bot-indstillinger for denne server vil blive slettet. Denne handling kan ikke fortrydes.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => leaveGuild.mutate(bot.guild_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {leaveGuild.isPending ? 'Fjerner...' : 'Fjern bot'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {viewingLogsForGuild?.id === bot.guild_id && (
                        <div className="mt-2">
                          <BotConsoleViewer guildId={bot.guild_id} guildName={bot.guild_name} showGuildFilter={false} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground"><Bot className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Ingen bots registreret</p></div>
              )}
            </CardContent>
          </Card>
          {/* Global Bans Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Global Ban System</CardTitle>
              <CardDescription>Administrer globale ban-rapporter og aktive bans</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/global-bans"><Button>Åbn Global Bans</Button></Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploy Tab */}
        <TabsContent value="deploy">
          <BotDeploymentPanel />
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety">
          <AISafetyLogViewer />
        </TabsContent>

        {/* Console Tab */}
        <TabsContent value="console">
          <BotConsoleViewer />
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <UserRoleManager />
        </TabsContent>

        {/* Pending Emails Tab */}
        <TabsContent value="emails">
          <PendingAdminEmailsManager />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <GuildCommandDeployer />
          <ProtectedIdsManager />
          <MassActionsPanel />
          <PremiumFeatureManager />
          <IPWhitelistManager />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <DatabaseOverview />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
