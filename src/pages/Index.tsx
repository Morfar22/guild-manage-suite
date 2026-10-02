import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from '@tanstack/react-router';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Globe,
  Layers3,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Shield,
  Sparkles,
  Ticket,
  TrendingUp,
  Twitch,
  Users,
  Zap,
} from 'lucide-react';
import { PRODUCT_COUNTS, PUBLIC_BOT_INVITE_URL } from '@/lib/product';

interface PlatformStats {
  servers: number;
  tickets: number;
  moderationActions: number;
  onlineBots: number;
  managedMembers: number;
  updatedAt: string;
}

const PRODUCT_FEATURES = [
  { icon: Shield, title: 'Moderation', text: 'Cases, AutoMod, raid protection, quarantine og staff workflows.' },
  { icon: Ticket, title: 'Tickets', text: 'Supportflow med claims, SLA, transcripts, ratings og kategorier.' },
  { icon: Sparkles, title: 'AI', text: 'AI-chat, AutoMod-hjælp, ticket-summering og tekstværktøjer.' },
  { icon: TrendingUp, title: 'Engagement', text: 'XP, leveling, giveaways, polls, reaction roles og community flows.' },
  { icon: Gamepad2, title: 'FiveM', text: 'Whitelist, playtime, status, priority og live serverkommandoer.' },
  { icon: Twitch, title: 'Creator tools', text: 'Twitch, YouTube og TikTok-notifikationer med serverroller og embeds.' },
];

const SETUP_STEPS = [
  { n: '01', title: 'Tilføj GuildOS', text: 'Invitér botten med et eksplicit permissionsæt uden Administrator.' },
  { n: '02', title: 'Vælg din server', text: 'Log ind med Discord og vælg den server, du administrerer.' },
  { n: '03', title: 'Aktivér moduler', text: 'Start med moderation, logs, welcome og tickets. Resten kan tilføjes senere.' },
  { n: '04', title: 'Følg driften', text: 'Dashboardet samler alerts, aktivitet, botstatus og handlinger ét sted.' },
];

const INTEGRATIONS = ['Discord', 'FiveM', 'Twitch', 'YouTube', 'TikTok', 'Tebex', 'Lavalink', 'Supabase'];

function formatMetric(value: number) {
  return new Intl.NumberFormat('da-DK', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export default function Index() {
  const { user, loading } = useAuth();
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/platform-stats')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('stats unavailable')))
      .then((data: PlatformStats) => { if (active) setPlatformStats(data); })
      .catch(() => { if (active) setPlatformStats(null); });
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => [
    platformStats
      ? { value: formatMetric(platformStats.servers), label: 'Servere i platformen' }
      : { value: 'Live', label: 'Platformstatus' },
    platformStats
      ? { value: formatMetric(platformStats.managedMembers), label: 'Medlemmer på online bots' }
      : { value: 'DA / EN', label: 'Sprog' },
    { value: `${PRODUCT_COUNTS.modules}+`, label: 'Moduler' },
    { value: `${PRODUCT_COUNTS.logicalCommands}+`, label: 'Botfunktioner' },
  ], [platformStats]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Indlæser" />
      </main>
    );
  }

  if (user) return <Navigate to="/guilds" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>GuildOS Bot - Discord management samlet ét sted</title>
        <meta name="description" content="GuildOS samler moderation, tickets, AI, automation, analytics, FiveM og creator-integrationer i ét Discord dashboard." />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/" />
      </Helmet>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Hovednavigation">
          <Link to="/" className="flex items-center gap-2" aria-label="GuildOS Bot forside">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow">
              <Bot className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">GuildOS Bot</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link to="/features"><Button variant="ghost" size="sm">Features</Button></Link>
            <Link to="/security"><Button variant="ghost" size="sm">Sikkerhed</Button></Link>
            <Link to="/docs"><Button variant="ghost" size="sm">Docs</Button></Link>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Log ind</Button></Link>
            <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gradient-blurple text-white shadow-glow">Tilføj bot</Button>
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 -z-10 grid-backdrop" aria-hidden="true" />
          <div className="absolute left-1/3 top-0 -z-10 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[130px]" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Discord management uden bot-jonglering
              </div>
              <h1 className="font-display text-[2.8rem] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.5rem]">
                Dit Discord-team får et <span className="text-gradient">kontrolrum.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                GuildOS samler moderation, support, automation, analytics, AI og integrationer i én platform. Staff ser det, der kræver handling, før de drukner i menuer og bots.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="sm:w-auto">
                  <Button size="lg" className="w-full gradient-blurple text-white shadow-glow sm:w-auto">
                    <Bot className="mr-2 h-5 w-5" /> Tilføj til Discord
                  </Button>
                </a>
                <Link to="/features" className="sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">Se platformen <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {['Ingen Administrator-permission', 'Discord-first login', 'DA / EN', 'Custom bots understøttet'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <ProductPreview />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <dl className="surface-card grid grid-cols-2 gap-6 rounded-3xl p-6 sm:grid-cols-4 sm:p-8">
              {stats.map((item) => (
                <div key={item.label} className="text-center">
                  <dt className="text-xs text-muted-foreground sm:text-sm">{item.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold sm:text-3xl">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <div className="text-sm font-medium text-primary">Bygget som en platform</div>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Funktioner der deler kontekst.</h2>
            </div>
            <p className="max-w-2xl text-muted-foreground lg:justify-self-end">
              GuildOS er ikke en samling tilfældige commands. Tickets, moderation, alerts, logs og analytics er bygget til at kunne ses og styres fra samme arbejdsflade.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="surface-card group transition-all duration-300 hover:-translate-y-1 hover:border-primary/35">
                  <CardContent className="p-6">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link to="/features"><Button variant="outline">Se alle featureområder <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </section>

        <section className="border-y border-border/40 bg-secondary/20">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <div className="text-sm font-medium text-primary">Onboarding</div>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Fra invite til drift uden manual-maraton.</h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {SETUP_STEPS.map((step) => (
                <div key={step.n} className="relative rounded-2xl border border-border/70 bg-background/60 p-6">
                  <div className="font-mono text-xs text-primary">{step.n}</div>
                  <h3 className="mt-4 font-display font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <LockKeyhole className="h-3.5 w-3.5" /> Sikkerhed forklaret
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold sm:text-4xl">Ingen “trust us”-boks.</h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              GuildOS dokumenterer login, permissions, tokenhåndtering og dataadgang på en offentlig sikkerhedsside. Den officielle bot inviteres uden Administrator-permission.
            </p>
            <Link to="/security"><Button className="mt-6" variant="outline">Læs sikkerhedsmodellen <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>

          <Card className="surface-card">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              {[
                { icon: Shield, title: 'OAuth2', text: 'Discord-first autentificering' },
                { icon: LockKeyhole, title: 'Credentials', text: 'Krypteret custom bot token-storage' },
                { icon: Users, title: 'Guild scope', text: 'Adgang afgrænset efter bruger og server' },
                { icon: Layers3, title: 'Permissions', text: 'Eksplicit bitmask, ikke Administrator' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="mt-3 font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.text}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section className="border-y border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium text-muted-foreground">Integrationer i GuildOS-økosystemet</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {INTEGRATIONS.map((name) => (
                <span key={name} className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-sm font-medium">{name}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <Card className="surface-card overflow-hidden border-primary/25">
            <CardContent className="relative p-8 text-center sm:p-14">
              <div className="absolute left-1/2 top-0 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Gør serverdrift mindre fragmenteret.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Tilføj GuildOS, vælg din server, og brug onboarding-guiden til at få de vigtigste moduler på plads først.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noopener noreferrer"><Button size="lg">Tilføj GuildOS</Button></a>
                <Link to="/auth"><Button size="lg" variant="outline">Log ind med Discord</Button></Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 text-sm sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md gradient-blurple"><Bot className="h-4 w-4 text-white" /></span>
            <span className="font-medium">GuildOS Bot</span>
            <span className="text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
            <Link to="/features">Features</Link>
            <Link to="/security">Sikkerhed</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/terms">Vilkår</Link>
            <Link to="/privacy">Privatliv</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl" />
      <Card className="surface-card overflow-hidden rounded-[1.75rem] border-primary/20 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span>
            <div>
              <div className="text-sm font-semibold">Community Hub</div>
              <div className="text-xs text-muted-foreground">Eksempelvisning af dashboard</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
          </span>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Åbne tickets', value: '12', icon: Ticket },
              { label: 'Alerts', value: '3', icon: Activity },
              { label: 'Medlemmer', value: '1.8k', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="mt-3 text-xl font-bold">{item.value}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"><Zap className="h-4 w-4" /></span>
              <div>
                <div className="text-sm font-semibold">3 ting kræver opmærksomhed</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">Ticket SLA, logkanal og én moderation alert.</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Aktivitet 7 dage</div>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-5 flex h-20 items-end gap-2">
                {[38, 55, 34, 72, 58, 82, 66].map((height, i) => (
                  <span key={i} className="flex-1 rounded-t bg-primary/35" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="text-xs font-medium text-muted-foreground">Setup</div>
              <div className="mt-3 text-2xl font-bold">4 / 5</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full w-4/5 rounded-full bg-primary" /></div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Næste: ticket panel</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3 text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4" /> Discord · FiveM · Twitch</span>
            <span className="font-medium text-primary">Produktpreview</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
