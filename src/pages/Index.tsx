import { Navigate, Link } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Loader2,
  Shield,
  Bot,
  Sparkles,
  Zap,
  Users,
  Trophy,
  Ticket,
  Gift,
  MessageSquare,
  BarChart3,
  Lock,
  ArrowRight,
  CheckCircle2,
  Globe,
  Crown,
} from 'lucide-react';
import heroOrb from '@/assets/hero-orb.jpg';

const FEATURES = [
  {
    icon: Shield,
    title: 'Avanceret Moderation',
    description: 'AI-drevet automod, raid protection, quarantine system og advarselspoint.',
  },
  {
    icon: Ticket,
    title: 'Ticket System',
    description: 'Fuldt tilpasselige support-tickets med kategorier, transskripter og AI-summering.',
  },
  {
    icon: Trophy,
    title: 'Leveling & XP',
    description: 'Engagér dit community med XP, leaderboards og custom rolle-belønninger.',
  },
  {
    icon: Gift,
    title: 'Giveaways & Polls',
    description: 'Kør lodtrækninger og afstemninger med ét klik — fuldt automatiseret.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat & Assistent',
    description: 'Indbygget Gemini AI til samtaler, summering og smart automation.',
  },
  {
    icon: Bot,
    title: 'Custom Bots',
    description: 'Hver server kan have sin egen bot med eget navn, avatar og token.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    description: 'Dyb indsigt i medlemsaktivitet, kommandoer og engagement.',
  },
  {
    icon: Users,
    title: 'Velkomst & Verifikation',
    description: 'Smukke velkomster, captcha-verifikation og anti-raid beskyttelse.',
  },
];

const STATS = [
  { value: '49+', label: 'Moduler' },
  { value: '150+', label: 'Kommandoer' },
  { value: '99.9%', label: 'Oppetid' },
  { value: '24/7', label: 'Support' },
];

const SECURITY_POINTS = [
  'Discord OAuth2 — vi gemmer aldrig dit password',
  'Krypteret bot-token opbevaring',
  'Row Level Security på al data',
  'IP-whitelisting til admin endpoints',
  'GDPR-compliant data håndtering',
];

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Indlæser" />
      </main>
    );
  }

  // Authenticated users go straight to guild selection
  if (user) {
    return <Navigate to="/guilds" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ======================= NAV ======================= */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
          aria-label="Hovednavigation"
        >
          <Link to="/" className="flex items-center gap-2" aria-label="GuildOS Bot forside">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow">
              <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">GuildOS Bot</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/docs">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Docs
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Log ind
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gradient-blurple text-primary-foreground shadow-glow hover:opacity-90">
                Kom i gang
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* ======================= HERO ======================= */}
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        {/* Decorative background — aria-hidden so screen readers skip it */}
        <div className="absolute inset-0 -z-10 grid-backdrop" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute left-1/2 top-[-10rem] h-[42rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-chart-5/20 blur-[110px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium tracking-wide text-primary shadow-glow">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Bygget til moderne Discord-servere</span>
              </div>

              <h1
                id="hero-title"
                className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tighter sm:text-6xl lg:text-[4.25rem]"
              >
                Den{' '}
                <span className="text-gradient">smarteste måde</span>
                <br />
                at drive din Discord
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
                GuildOS Bot er en alt-i-én Discord bot platform med over 49 moduler — moderation,
                tickets, AI, leveling, FiveM integration og meget mere. Sikker, hurtig og
                fuldt tilpasselig.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full gradient-blurple text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto"
                  >
                    <Bot className="mr-2 h-5 w-5" aria-hidden="true" />
                    Tilføj til din server
                  </Button>
                </Link>
                <a
                  href="#features"
                  className="w-full sm:w-auto"
                  aria-label="Læs mere om features"
                >
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Se alle features
                  </Button>
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  Gratis at starte
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  Ingen kreditkort
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  Setup på 2 min
                </span>
              </div>
            </div>

            {/* Hero image */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="surface-card relative overflow-hidden rounded-3xl p-1.5">
                <img
                  src={heroOrb}
                  alt="GuildOS Bot bot — abstrakt 3D illustration af en lysende orb med Discord-symbol"
                  width={1536}
                  height={1024}
                  className="h-auto w-full rounded-[1.25rem]"
                  // LCP image — eager load
                  loading="eager"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>

              {/* Floating stat badges */}
              <Card className="surface-card absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl p-3.5 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15">
                  <Zap className="h-4 w-4 text-success" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Latency</div>
                  <div className="text-sm font-semibold">{'< 50ms'}</div>
                </div>
              </Card>
              <Card className="surface-card absolute -right-5 -top-5 hidden items-center gap-3 rounded-2xl p-3.5 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                  <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sprog</div>
                  <div className="text-sm font-semibold">DA / EN</div>
                </div>
              </Card>
            </div>
          </div>

          {/* Stats row */}
          <dl className="surface-card mt-20 grid grid-cols-2 gap-6 rounded-3xl p-8 sm:grid-cols-4 sm:gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-bold text-gradient sm:text-4xl">{s.value}</dd>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ======================= FEATURES ======================= */}
      <section id="features" className="border-t border-border/40 py-20 sm:py-28" aria-labelledby="features-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="features-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Alt din server har brug for
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Et komplet økosystem af moduler, der arbejder sammen — uden at du skal jonglere
              med 10 forskellige bots.
            </p>
          </div>

          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title}>
                  <Card className="surface-card group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:glow-ring">
                    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl gradient-blurple shadow-glow transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {f.description}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ======================= SECURITY ======================= */}
      <section
        className="relative border-t border-border/40 py-20 sm:py-28"
        aria-labelledby="security-title"
      >
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" aria-hidden="true" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5 text-xs font-medium text-success">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sikkerhed i centrum</span>
              </div>
              <h2 id="security-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Bygget med <span className="text-gradient">enterprise-grade</span> sikkerhed
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Vi tager dine data alvorligt. Hver del af platformen er bygget efter
                best-practice sikkerhedsstandarder.
              </p>

              <ul className="mt-8 space-y-3">
                {SECURITY_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-foreground/90 sm:text-base">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Shield, label: 'OAuth2', desc: 'Sikker login via Discord' },
                { icon: Lock, label: 'Krypteret', desc: 'AES-256 ved opbevaring' },
                { icon: Crown, label: 'RLS', desc: 'Row-level security' },
                { icon: Globe, label: 'GDPR', desc: 'EU-compliant' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.label}
                    className="surface-card rounded-2xl p-5 transition-colors hover:border-primary/40"
                  >
                    <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.desc}</div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ======================= CTA ======================= */}
      <section className="border-t border-border/40 py-20 sm:py-28" aria-labelledby="cta-title">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Card className="surface-card relative overflow-hidden rounded-[1.75rem] border-primary/25 p-8 text-center glow-ring sm:p-16">
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-accent/10"
              aria-hidden="true"
            />
            <div
              className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
              aria-hidden="true"
            />

            <h2 id="cta-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Klar til at opgradere din server?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Log ind med Discord og kom i gang på under 2 minutter. Ingen kreditkort kræves.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full gradient-blurple text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto"
                >
                  <Bot className="mr-2 h-5 w-5" aria-hidden="true" />
                  Log ind med Discord
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* ======================= FOOTER ======================= */}
      <footer className="border-t border-border/40 py-10" role="contentinfo">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-blurple">
              <Bot className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold">GuildOS Bot</span>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()}
            </span>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Log ind
            </Link>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a
              href="/docs"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
