import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link, useSearchParams } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Guild } from '@/types/discord';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Loader2, Plus, LogOut, Users, Crown, ExternalLink, RefreshCw, Shield, Trash2, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useAdmin';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const BOT_CLIENT_ID = import.meta.env.VITE_DISCORD_BOT_CLIENT_ID || '';
const BOT_PERMISSIONS = '8';
const BOT_INVITE_URL = BOT_CLIENT_ID ? `https://discord.com/api/oauth2/authorize?client_id=${BOT_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands` : '';

export default function GuildSelect() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { setSelectedGuild } = useGuild();
  const { language } = useLanguage();
  const en = language === 'en';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [botStatusMap, setBotStatusMap] = useState<Record<string, boolean>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deletingGuildId, setDeletingGuildId] = useState<string | null>(null);
  const { data: isAdmin } = useIsAdmin();

  useEffect(() => { if (user && isAdmin !== undefined) { fetchGuilds(); if (isAdmin) setShowInactive(true); } }, [user, isAdmin]);

  useEffect(() => {
    const guildParam = searchParams.get('guild');
    if (guildParam && guilds.length > 0 && !loading) {
      const target = guilds.find(g => g.id === guildParam);
      if (target) {
        setSelectedGuild(target);
        navigate({ to: '/dashboard',  replace: true  });
      }
    }
  }, [guilds, loading, searchParams]);

  const fetchGuilds = async () => {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: statusData } = await supabase.from('bot_status').select('guild_id, is_online, last_heartbeat');
      const statusMap: Record<string, boolean> = {};
      (statusData || []).forEach(s => {
        statusMap[s.guild_id] = s.is_online && !!s.last_heartbeat && s.last_heartbeat > fiveMinAgo;
      });
      setBotStatusMap(statusMap);

      if (isAdmin) {
        const { data, error } = await supabase.from('guilds').select('*').order('guild_name');
        if (error) throw error;
        setGuilds(data || []);
      } else {
        const { data, error } = await supabase.from('user_guilds').select(`guild_id, has_admin_permission, guilds:guild_id (*)`).eq('user_id', user?.id);
        if (error) throw error;
        setGuilds(data?.filter(ug => ug.guilds && ug.has_admin_permission).map(ug => ug.guilds as Guild).sort((a, b) => a.guild_name.localeCompare(b.guild_name)) || []);
      }
    } catch (err) { console.error('Error fetching guilds:', err); } finally { setLoading(false); }
  };

  const isBotActive = (guildId: string) => !!botStatusMap[guildId];
  const filteredGuilds = showInactive ? guilds : guilds.filter(g => isBotActive(g.id));
  const inactiveCount = guilds.filter(g => !isBotActive(g.id)).length;
  const activeCount = guilds.filter(g => isBotActive(g.id)).length;

  const handleDeleteGuild = async (guild: Guild) => {
    setDeletingGuildId(guild.id);
    try {
      const { error } = await supabase.from('guilds').delete().eq('id', guild.id);
      if (error) throw error;
      toast.success(en ? `Removed ${guild.guild_name}` : `${guild.guild_name} fjernet`);
      setGuilds(prev => prev.filter(g => g.id !== guild.id));
    } catch (err) {
      console.error('Error deleting guild:', err);
      toast.error(en ? 'Could not remove server' : 'Kunne ikke fjerne server');
    } finally { setDeletingGuildId(null); }
  };

  const handleSelectGuild = (guild: Guild) => { setSelectedGuild(guild); navigate({ to: '/dashboard' }); };

  const handleSyncDiscord = async () => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('discord-oauth?action=authorize', { body: { redirectUri: `${window.location.origin}/auth` }, headers: { 'Content-Type': 'application/json' } });
      if (response.error) throw response.error;
      if (response.data?.url) {
        const opened = window.open(response.data.url, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.href = response.data.url;
        toast.info(en ? 'Complete Discord login in the new window to sync your servers' : 'Gennemfør Discord login i det nye vindue for at synkronisere dine servere');
      }
    } catch (err) { console.error('Error syncing Discord:', err); toast.error(en ? 'Could not start Discord sync' : 'Kunne ikke starte Discord sync'); } finally { setSyncing(false); }
  };

  const handleAddDemoGuild = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('create-demo-guild', { body: { guild_id: `demo_${Date.now()}`, guild_name: 'Demo Server', guild_icon: null, owner_id: user.id, command_prefix: '!', log_channel_id: null, auto_moderation_enabled: false } });
      if (error) throw error;
      toast.success(en ? 'Demo server created!' : 'Demo server oprettet!');
      fetchGuilds();
    } catch (err) { console.error('Error creating demo guild:', err); toast.error(en ? 'Failed to create demo server' : 'Kunne ikke oprette demo server'); }
  };

  if (authLoading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ======================= NAV ======================= */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Paranox</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link to="/admin" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                  <Shield className="mr-1.5 h-4 w-4" />Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{en ? 'Sign out' : 'Log ud'}</span>
            </Button>
          </div>
        </nav>
      </header>

      {/* ======================= HERO ======================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{en ? 'Welcome back' : 'Velkommen tilbage'}</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {en ? 'Choose your ' : 'Vælg din '}
              <span className="text-gradient">{en ? 'server' : 'server'}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              {en ? 'Pick a Discord server to manage with Paranox.' : 'Vælg en Discord-server du vil administrere med Paranox.'}
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={handleSyncDiscord} disabled={syncing} size="lg" className="w-full gradient-blurple text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">
                {syncing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                {en ? 'Sync Discord' : 'Synkroniser Discord'}
              </Button>
              {BOT_INVITE_URL && (
                <a href={BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <Bot className="mr-2 h-5 w-5" />
                    {en ? 'Invite Bot' : 'Inviter Bot'}
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </a>
              )}
            </div>

            {/* Stats row */}
            {guilds.length > 0 && (
              <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-border/40 pt-8">
                <div className="text-center">
                  <dd className="text-2xl font-bold text-gradient sm:text-3xl">{guilds.length}</dd>
                  <p className="mt-1 text-xs text-muted-foreground">{en ? 'Total servers' : 'Servere i alt'}</p>
                </div>
                <div className="text-center">
                  <dd className="text-2xl font-bold text-success sm:text-3xl">{activeCount}</dd>
                  <p className="mt-1 text-xs text-muted-foreground">{en ? 'Bot online' : 'Bot online'}</p>
                </div>
                <div className="text-center">
                  <dd className="text-2xl font-bold text-muted-foreground sm:text-3xl">{inactiveCount}</dd>
                  <p className="mt-1 text-xs text-muted-foreground">{en ? 'Inactive' : 'Inaktive'}</p>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* ======================= GUILDS ======================= */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : guilds.length === 0 ? (
          <Card className="mx-auto max-w-2xl border-border/50 bg-card/60 p-10 text-center backdrop-blur sm:p-14">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gradient-blurple shadow-glow">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-semibold sm:text-2xl">{en ? 'No servers yet' : 'Ingen servere endnu'}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
              {en ? 'Sync your Discord account to see servers, or create a demo server to get started.' : 'Synkroniser din Discord-konto for at se servere, eller opret en demo server.'}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={handleSyncDiscord} disabled={syncing} className="gradient-blurple text-primary-foreground hover:opacity-90">
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {en ? 'Sync Discord' : 'Synkroniser Discord'}
              </Button>
              <Button onClick={handleAddDemoGuild} variant="outline">
                <Plus className="mr-2 h-4 w-4" />{en ? 'Create Demo Server' : 'Opret Demo Server'}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {inactiveCount > 0 && (
              <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-border/50 bg-card/60 px-5 py-3 backdrop-blur sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                  {inactiveCount} {en ? 'server(s) hidden — bot not active' : 'server(e) skjult — bot ikke aktiv'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowInactive(!showInactive)}>
                  {showInactive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {showInactive ? (en ? 'Hide inactive' : 'Skjul inaktive') : (en ? 'Show inactive' : 'Vis inaktive')}
                </Button>
              </div>
            )}

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGuilds.map((guild) => {
                const active = isBotActive(guild.id);
                const clickable = active || isAdmin;
                return (
                  <li key={guild.id}>
                    <Card
                      className={`group relative h-full overflow-hidden border-border/50 bg-card p-5 transition-all ${
                        clickable
                          ? 'cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow'
                          : 'opacity-60'
                      }`}
                      onClick={() => clickable && handleSelectGuild(guild)}
                    >
                      {/* Status pill */}
                      <div className="absolute right-3 top-3 flex items-center gap-1.5">
                        {!active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingGuildId === guild.id}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {deletingGuildId === guild.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{en ? 'Remove server?' : 'Fjern server?'}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {en
                                    ? `Are you sure you want to remove "${guild.guild_name}" from the list? This will delete all associated data.`
                                    : `Er du sikker på at du vil fjerne "${guild.guild_name}" fra listen? Dette sletter al tilhørende data.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{en ? 'Cancel' : 'Annuller'}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteGuild(guild)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {en ? 'Remove' : 'Fjern'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <Avatar className="h-14 w-14 ring-2 ring-border/40 transition-all group-hover:ring-primary/40">
                            {guild.guild_icon && (
                              <AvatarImage
                                src={`https://cdn.discordapp.com/icons/${guild.guild_id}/${guild.guild_icon}.png`}
                                alt={guild.guild_name}
                              />
                            )}
                            <AvatarFallback className="bg-secondary text-base font-semibold text-secondary-foreground">
                              {guild.guild_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 inline-block h-3.5 w-3.5 rounded-full ring-2 ring-card ${
                              active ? 'bg-success' : 'bg-destructive'
                            }`}
                            aria-label={active ? 'Online' : 'Offline'}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-semibold">{guild.guild_name}</p>
                            {guild.owner_id === user?.id && <Crown className="h-3.5 w-3.5 shrink-0 text-warning" />}
                          </div>
                          <p className={`mt-0.5 text-xs ${active ? 'text-success' : 'text-muted-foreground'}`}>
                            {active ? (en ? 'Bot online' : 'Bot online') : (en ? 'Bot offline' : 'Bot offline')}
                          </p>
                        </div>

                        {clickable && (
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}

              {/* Add server card */}
              <li>
                <button
                  onClick={handleAddDemoGuild}
                  className="group flex h-full w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/30 p-5 text-muted-foreground transition-all hover:-translate-y-1 hover:border-primary/50 hover:bg-card/60 hover:text-primary"
                >
                  <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                  <span className="font-medium">{en ? 'Add Server' : 'Tilføj Server'}</span>
                </button>
              </li>
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
