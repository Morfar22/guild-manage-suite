import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, CheckCheck, Loader2, Shield, Users, MessageSquare, Zap, Info } from 'lucide-react';
import { useDashboardNotifications } from '@/hooks/useDashboardNotifications';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

const typeIcons: Record<string, any> = {
  moderation: Shield,
  member: Users,
  message: MessageSquare,
  system: Zap,
  info: Info,
  warning: Shield,
  error: Shield,
};

const severityVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'outline',
  warning: 'secondary',
  error: 'destructive',
  critical: 'destructive',
};

const typeColors: Record<string, string> = {
  moderation: 'text-destructive',
  member: 'text-green-500',
  message: 'text-blue-500',
  system: 'text-primary',
  info: 'text-primary',
  warning: 'text-yellow-500',
  error: 'text-destructive',
};

export default function DashboardNotifications() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, updateStatus } = useDashboardNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Notifikationer
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} ulæste</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">Real-time alerts fra din server og bot</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Markér alle som læst
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Ingen notifikationer endnu</p>
            <p className="text-sm text-muted-foreground mt-1">Alerts vises her, når botten rapporterer vigtige events</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] || Info;
            const colorClass = typeColors[notif.type] || 'text-primary';

            return (
              <Card
                key={notif.id}
                className={`transition-all ${!notif.is_read ? 'border-primary/30 bg-primary/5' : 'opacity-70'}`}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`mt-0.5 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{notif.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{notif.source}</Badge>
                      <Badge variant={severityVariants[notif.severity] || 'outline'} className="text-[10px]">
                        {notif.severity}
                      </Badge>
                      <Badge variant={notif.status === 'resolved' ? 'secondary' : 'outline'} className="text-[10px]">
                        {notif.status}
                      </Badge>
                    </div>
                    {notif.message && (
                      <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: da })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead.mutate(notif.id)}
                        disabled={markAsRead.isPending}
                        title="Markér som læst"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {notif.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: notif.id, status: 'acknowledged' })}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {notif.status !== 'resolved' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: notif.id, status: 'resolved' })}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
