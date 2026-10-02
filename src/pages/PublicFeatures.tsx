import { Link } from '@tanstack/react-router';
import { Helmet } from 'react-helmet-async';
import {
  Activity, ArrowRight, BarChart3, Bot, Brain, CheckCircle2, Copy, Gamepad2,
  Gift, Globe, MessageSquare, Mic, Shield, ShieldAlert, Sparkles, Ticket,
  TrendingUp, Twitch, UserPlus, Video, Webhook, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PUBLIC_BOT_INVITE_URL, PRODUCT_COUNTS } from '@/lib/product';

const GROUPS = [
  {
    title: 'Sikkerhed & moderation',
    description: 'Hold serveren rolig uden at gøre staffarbejde langsomt.',
    features: [
      { icon: ShieldAlert, title: 'AutoMod', text: 'Spam-, mention-, link- og regelbeskyttelse med bypass-roller og AI-lag.' },
      { icon: Shield, title: 'Moderation', text: 'Cases, warnings, timeout, tempban, quarantine, mass actions og audit trail.' },
      { icon: Activity, title: 'Operations Center', text: 'Saml åbne cases, alerts, SLA-problemer og planlagte handlinger ét sted.' },
      { icon: Brain, title: 'AI AutoMod', text: 'Ekstra vurdering af indhold med konfigurerbare regler og menneskelig kontrol.' },
    ],
  },
  {
    title: 'Support & kommunikation',
    description: 'Fra første spørgsmål til løst ticket uden værktøjs-zigzag.',
    features: [
      { icon: Ticket, title: 'Tickets', text: 'Kategorier, claims, spørgsmål, transcripts, ratings, SLA og staff workflows.' },
      { icon: MessageSquare, title: 'Modmail', text: 'DM-baseret support med staffoverblik og serverkontekst.' },
      { icon: UserPlus, title: 'Welcome & verification', text: 'Velkomster, auto-roller, captcha-verifikation og onboarding.' },
      { icon: Webhook, title: 'Webhooks & embeds', text: 'Byg embeds, automatisér opslag og send strukturerede beskeder.' },
    ],
  },
  {
    title: 'Engagement',
    description: 'Funktioner der giver medlemmer en grund til at komme tilbage.',
    features: [
      { icon: TrendingUp, title: 'Leveling & XP', text: 'Chat- og voice-XP, multipliers, levelroller og leaderboards.' },
      { icon: Gift, title: 'Giveaways & polls', text: 'Automatiske giveaways, rerolls, krav og afstemninger.' },
      { icon: Sparkles, title: 'AI Chat', text: 'Kontekstbaseret assistent med serverstyrede prompts og kanaler.' },
      { icon: Mic, title: 'Join to Create', text: 'Midlertidige voice-rum med brugergrænser og automatisk oprydning.' },
    ],
  },
  {
    title: 'Integrationer & drift',
    description: 'GuildOS forbinder Discord med de systemer serveren allerede bruger.',
    features: [
      { icon: Gamepad2, title: 'FiveM', text: 'Serverstatus, whitelist, playtime, priority, live commands og Discord-sync.' },
      { icon: Twitch, title: 'Twitch', text: 'Live-notifikationer, roller, embeds, stream schedules og multi-streamer support.' },
      { icon: Video, title: 'YouTube & TikTok', text: 'Automatiske creator-notifikationer samlet i samme dashboard.' },
      { icon: Copy, title: 'Backups & server clone', text: 'Gem og kopier kanalstruktur, roller og serveropsætning med statusvisning.' },
    ],
  },
];

export default function PublicFeatures() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Features — GuildOS Bot</title>
        <meta name="description" content="Se GuildOS Bot funktioner: moderation, tickets, AI, leveling, FiveM, Twitch, analytics, automation og meget mere." />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/features" />
      </Helmet>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow"><Bot className="h-5 w-5 text-white" /></span>
            <span className="font-display text-lg font-bold">GuildOS Bot</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/security"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sikkerhed</Button></Link>
            <Link to="/docs"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Docs</Button></Link>
            <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noreferrer"><Button size="sm">Tilføj bot</Button></a>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 -z-10 grid-backdrop" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3.5 w-3.5" /> {PRODUCT_COUNTS.modules}+ moduler · {PRODUCT_COUNTS.logicalCommands}+ funktioner
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
                Ét kontrolrum til hele din Discord-server.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                GuildOS samler moderation, support, automation, engagement, analytics og integrationer i ét dashboard, så staff ikke skal hoppe mellem en bunke bots og paneler.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noreferrer">
                  <Button size="lg">Tilføj til Discord <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </a>
                <Link to="/auth"><Button size="lg" variant="outline">Åbn dashboard</Button></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl space-y-20 px-4 py-20 sm:px-6 lg:px-8">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-8 max-w-2xl">
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{group.title}</h2>
                <p className="mt-2 text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {group.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Card key={feature.title} className="surface-card h-full">
                      <CardHeader>
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 text-sm leading-relaxed text-muted-foreground">{feature.text}</CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          <Card className="surface-card overflow-hidden border-primary/25">
            <CardContent className="grid gap-8 p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><Globe className="h-4 w-4" /> Ét økosystem</div>
                <h2 className="font-display text-3xl font-bold">Det hele arbejder sammen.</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Tickets kan dukke op i Operations Center, moderation kan fodre analytics, Twitch kan bruge roller, og custom bots kan køre samme GuildOS-katalog. Det er pointen med platformen.
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {['Discord', 'FiveM', 'Twitch', 'YouTube', 'TikTok', 'Tebex', 'Lavalink', 'Supabase'].map((name) => (
                    <span key={name} className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5">{name}</span>
                  ))}
                </div>
              </div>
              <Link to="/security">
                <Button variant="outline">Se hvordan data beskyttes <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} GuildOS Bot</span>
          <div className="flex gap-5">
            <Link to="/terms">Vilkår</Link><Link to="/privacy">Privatliv</Link><Link to="/security">Sikkerhed</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
