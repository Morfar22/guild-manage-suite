import { Link } from '@tanstack/react-router';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Bot, CheckCircle2, Database, KeyRound, LockKeyhole, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PUBLIC_BOT_INVITE_URL } from '@/lib/product';

const CONTROLS = [
  {
    icon: KeyRound,
    title: 'Discord OAuth2',
    text: 'Dashboard-login kan ske via Discord OAuth2. GuildOS modtager ikke dit Discord-password.',
  },
  {
    icon: LockKeyhole,
    title: 'Custom bot tokens',
    text: 'Custom bot tokens lagres krypteret på serversiden og vises ikke igen i klartekst efter de er gemt.',
  },
  {
    icon: Database,
    title: 'Adgang til data',
    text: 'Dashboard-data afgrænses pr. bruger og server med databasepolitikker og server-side adgangskontrol, afhængigt af endpointets rolle.',
  },
  {
    icon: Shield,
    title: 'Bot permissions',
    text: 'Det offentlige invite-link bruger et eksplicit permissionsæt i stedet for Discord Administrator-permissionen.',
  },
  {
    icon: Users,
    title: 'Guild-afgrænsning',
    text: 'Dashboardet viser kun servere, som den autentificerede bruger har administratoradgang til, med særskilt platform-adminkontrol.',
  },
];

export default function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Sikkerhed — GuildOS Bot</title>
        <meta name="description" content="Sådan håndterer GuildOS Bot login, bot permissions, custom bot tokens og adgang til serverdata." />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/security" />
      </Helmet>

      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple"><Bot className="h-5 w-5 text-white" /></span>
            <span className="font-display font-bold">GuildOS Bot</span>
          </Link>
          <div className="flex gap-2">
            <Link to="/features"><Button variant="ghost" size="sm">Features</Button></Link>
            <a href={PUBLIC_BOT_INVITE_URL} target="_blank" rel="noreferrer"><Button size="sm">Tilføj bot</Button></a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Shield className="h-3.5 w-3.5" /> Sikkerhedsmodel
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Sikkerhed uden marketing-tåge.</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Her er de konkrete mekanismer GuildOS bruger. Vi foretrækker dokumenterbare kontroller frem for brede løfter som “enterprise-grade” eller “100% sikkert”.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {CONTROLS.map((control) => {
            const Icon = control.icon;
            return (
              <Card key={control.title} className="surface-card">
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <CardTitle className="text-lg">{control.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-muted-foreground">{control.text}</CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Hvad GuildOS ikke kræver</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {[
                'Discord Administrator-permission på den officielle bot',
                'Dit Discord-password',
                'At custom bot tokens står synligt i dashboardet efter lagring',
                'At alle brugere kan læse eller redigere alle guilds',
              ].map((item) => (
                <div key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{item}</span></div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dit ansvar som serveradministrator</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Discord-roller og channel overwrites bestemmer stadig, hvad botten reelt kan gøre på din server. Giv kun de permissions de moduler, du bruger, behøver.</p>
              <p>Custom bot tokens er credentials. Del dem ikke i tickets, Discord-beskeder eller screenshots.</p>
              <p>Hvis du opdager noget mistænkeligt, skal tokenet roteres i Discord Developer Portal før andre fejlsøgningstrin.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-14 border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Læs også privatlivspolitikken</h2>
              <p className="mt-2 text-sm text-muted-foreground">Her beskrives datatyper, formål og brugerrettigheder mere detaljeret.</p>
            </div>
            <Link to="/privacy"><Button variant="outline">Privatlivspolitik <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
