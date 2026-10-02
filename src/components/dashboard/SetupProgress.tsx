import { Link } from '@tanstack/react-router';
import { Bot, CheckCircle2, Circle, ScrollText, ShieldAlert, Ticket, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useWelcomeSettings } from '@/hooks/useWelcomeSettings';
import { useLogSettings } from '@/hooks/useLogSettings';
import { useTicketCategories } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';

export function SetupProgress() {
  const { selectedGuild } = useGuild();
  const { language } = useLanguage();
  const { isOnline, loading: botLoading } = useBotStatus();
  const welcome = useWelcomeSettings();
  const logs = useLogSettings();
  const tickets = useTicketCategories();
  const da = language === 'da';

  const steps = [
    {
      id: 'bot',
      icon: Bot,
      title: da ? 'Bot forbundet' : 'Bot connected',
      description: da ? 'GuildOS svarer på heartbeat fra serveren.' : 'GuildOS is reporting a current heartbeat.',
      complete: isOnline,
      loading: botLoading,
      to: '/dashboard/bot-health',
    },
    {
      id: 'logs',
      icon: ScrollText,
      title: da ? 'Logs sat op' : 'Logs configured',
      description: da ? 'Vælg hvor staff- og serverevents skal logges.' : 'Choose where staff and server events are logged.',
      complete: Boolean(logs.data?.log_channel_id || selectedGuild?.log_channel_id),
      loading: logs.isLoading,
      to: '/dashboard/log-settings',
    },
    {
      id: 'welcome',
      icon: UserPlus,
      title: da ? 'Welcome klar' : 'Welcome ready',
      description: da ? 'Aktivér velkomstflow og vælg en kanal.' : 'Enable the welcome flow and choose a channel.',
      complete: Boolean(welcome.data?.enabled && welcome.data?.welcome_channel_id),
      loading: welcome.isLoading,
      to: '/dashboard/welcome',
    },
    {
      id: 'automod',
      icon: ShieldAlert,
      title: 'AutoMod',
      description: da ? 'Slå den grundlæggende automatiske moderation til.' : 'Enable baseline automated moderation.',
      complete: Boolean(selectedGuild?.auto_moderation_enabled),
      loading: false,
      to: '/dashboard/automod',
    },
    {
      id: 'tickets',
      icon: Ticket,
      title: da ? 'Tickets klar' : 'Tickets ready',
      description: da ? 'Opret mindst én supportkategori.' : 'Create at least one support category.',
      complete: (tickets.data?.length || 0) > 0,
      loading: tickets.isLoading,
      to: '/dashboard/tickets/settings',
    },
  ];

  const completeCount = steps.filter((step) => step.complete).length;
  const progress = Math.round((completeCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.complete && !step.loading);

  return (
    <Card className={cn(
      'overflow-hidden border-primary/20',
      progress === 100 ? 'bg-success/[0.04] border-success/25' : 'bg-primary/[0.035]'
    )}>
      <CardContent className="p-0">
        <div className="flex flex-col gap-5 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{da ? 'Server setup' : 'Server setup'}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{completeCount}/{steps.length}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {progress === 100
                ? (da ? 'De vigtigste fundamenter er på plads.' : 'The core setup is complete.')
                : (da ? 'Få fundamentet på plads først. Resten kan aktiveres bagefter.' : 'Finish the foundation first. Everything else can follow.')}
            </p>
          </div>

          <div className="flex min-w-48 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold">{progress}%</span>
          </div>
        </div>

        <div className="grid gap-px bg-border/50 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.id}
                to={step.to}
                className="group bg-card/95 p-4 transition-colors hover:bg-secondary/40"
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    step.complete ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground group-hover:text-primary'
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {step.complete
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <Circle className="h-4 w-4 text-muted-foreground/50" />}
                </div>
                <div className="mt-4 text-sm font-medium">{step.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</div>
              </Link>
            );
          })}
        </div>

        {nextStep && (
          <div className="flex flex-col gap-3 bg-secondary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{da ? 'Næste anbefalede trin:' : 'Recommended next step:'}</span>{' '}
              {nextStep.title}
            </p>
            <Link to={nextStep.to}>
              <Button size="sm">{da ? 'Fortsæt setup' : 'Continue setup'}</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
