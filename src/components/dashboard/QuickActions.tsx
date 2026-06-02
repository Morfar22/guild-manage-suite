import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, Send, Ticket, ShieldAlert, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  description: string;
  to: string;
  variant?: 'default' | 'primary';
}

const QuickAction = React.forwardRef<HTMLAnchorElement, QuickActionProps>(
  ({ icon: Icon, label, description, to, variant = 'default' }, ref) => (
    <Button variant="outline" className="h-auto w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors group" asChild>
      <Link to={to} ref={ref}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${variant === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>
    </Button>
  )
);
QuickAction.displayName = 'QuickAction';

export function QuickActions() {
  const { t, language } = useLanguage();
  const isDA = language === 'da';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('quickActions.title')}</CardTitle>
        <CardDescription>{isDA ? 'Genveje til hyppige handlinger' : 'Shortcuts to frequent actions'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <QuickAction
          icon={Gift}
          label={isDA ? 'Opret Giveaway' : 'Create Giveaway'}
          description={isDA ? 'Start en ny giveaway' : 'Start a new giveaway'}
          to="/dashboard/giveaways"
          variant="primary"
        />
        <QuickAction
          icon={Send}
          label={isDA ? 'Test Velkomst' : 'Test Welcome'}
          description={isDA ? 'Send en test velkomstbesked' : 'Send a test welcome message'}
          to="/dashboard/welcome"
        />
        <QuickAction
          icon={Ticket}
          label={isDA ? 'Se Tickets' : 'View Tickets'}
          description={isDA ? 'Administrer åbne tickets' : 'Manage open tickets'}
          to="/dashboard/tickets"
        />
        <QuickAction
          icon={ShieldAlert}
          label="AutoMod Logs"
          description={isDA ? 'Se seneste automod handlinger' : 'View recent automod actions'}
          to="/dashboard/automod"
        />
      </CardContent>
    </Card>
  );
}
