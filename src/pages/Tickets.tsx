import { useMemo, useState, type ReactNode } from 'react';
import {
  useTickets,
  useTicketStats,
  useDeleteTicket,
  getTicketAgeHours,
  getTicketAttention,
  TicketStatus,
} from '@/hooks/useTickets';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGuild } from '@/contexts/GuildContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Ticket,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  MessageSquare,
  Trash2,
  ExternalLink,
  Flame,
  UserRoundCheck,
  TimerReset,
  Settings,
  ArrowUpDown,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type SortMode = 'newest' | 'oldest' | 'attention';

function formatHours(hours: number | null | undefined, en: boolean) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return en ? `${days.toFixed(days < 10 ? 1 : 0)}d` : `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

export default function Tickets() {
  const { language } = useLanguage();
  const { selectedGuild } = useGuild();
  const en = language === 'en';
  const dateLoc = en ? enUS : da;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | TicketStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('attention');
  const [attentionOnly, setAttentionOnly] = useState(false);

  const { data: tickets, isLoading: ticketsLoading } = useTickets(activeTab === 'all' ? undefined : activeTab);
  const { data: stats, isLoading: statsLoading } = useTicketStats();
  const deleteTicket = useDeleteTicket();

  const statusConfig: Record<TicketStatus, {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof AlertCircle;
  }> = {
    open: { label: en ? 'Open' : 'Åben', variant: 'destructive', icon: AlertCircle },
    claimed: { label: en ? 'In progress' : 'I gang', variant: 'default', icon: Clock },
    closed: { label: en ? 'Closed' : 'Lukket', variant: 'secondary', icon: CheckCircle },
  };

  const categories = useMemo(() => {
    const found = new Map<string, string>();
    for (const ticket of tickets || []) {
      if (ticket.category_id && ticket.ticket_categories?.name) {
        found.set(ticket.category_id, ticket.ticket_categories.name);
      }
    }
    return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    const priority = { urgent: 2, watch: 1, normal: 0 };

    return (tickets || [])
      .filter((ticket) => {
        if (categoryFilter !== 'all' && ticket.category_id !== categoryFilter) return false;
        if (attentionOnly && getTicketAttention(ticket) === 'normal') return false;
        if (!search) return true;

        return [
          ticket.creator_name,
          ticket.creator_id,
          ticket.subject,
          ticket.channel_id,
          ticket.claimed_by_name,
          ticket.ticket_categories?.name,
        ].some((value) => value?.toLowerCase().includes(search));
      })
      .sort((a, b) => {
        if (sortMode === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortMode === 'attention') {
          const attentionDiff = priority[getTicketAttention(b)] - priority[getTicketAttention(a)];
          if (attentionDiff !== 0) return attentionDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tickets, searchQuery, categoryFilter, sortMode, attentionOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldAlert className="h-4 w-4" />
            {en ? 'Support command center' : 'Support command center'}
          </div>
          <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
          <p className="mt-1 text-muted-foreground">
            {en
              ? 'Prioritize the queue, spot unattended cases and jump straight into Discord.'
              : 'Prioritér køen, find oversete sager og hop direkte ind i Discord.'}
          </p>
        </div>
        <Link to="/dashboard/tickets/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            {en ? 'Ticket settings' : 'Ticket-indstillinger'}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={en ? 'Active queue' : 'Aktiv kø'}
          value={(stats?.openTickets ?? 0) + (stats?.claimedTickets ?? 0)}
          subtitle={en ? 'Open + in progress' : 'Åbne + i gang'}
          icon={<Ticket className="h-4 w-4 text-primary" />}
          loading={statsLoading}
        />
        <MetricCard
          title={en ? 'Unclaimed' : 'Ikke claimed'}
          value={stats?.unclaimedTickets ?? 0}
          subtitle={en ? 'Waiting for staff' : 'Venter på staff'}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
          danger={(stats?.unclaimedTickets ?? 0) > 0}
        />
        <MetricCard
          title={en ? 'Needs attention' : 'Kræver opmærksomhed'}
          value={stats?.needsAttention ?? 0}
          subtitle={en ? 'Age-based queue warning' : 'Aldersbaseret kø-advarsel'}
          icon={<Flame className="h-4 w-4 text-destructive" />}
          loading={statsLoading}
          danger={(stats?.needsAttention ?? 0) > 0}
        />
        <MetricCard
          title={en ? 'Avg. resolution' : 'Gns. løsningstid'}
          value={stats?.avgResolutionTime == null ? '—' : formatHours(stats.avgResolutionTime, en)}
          subtitle={
            stats?.oldestOpenHours == null
              ? (en ? 'No active cases' : 'Ingen aktive sager')
              : `${en ? 'Oldest active' : 'Ældste aktive'}: ${formatHours(stats.oldestOpenHours, en)}`
          }
          icon={<TimerReset className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {en ? 'Ticket queue' : 'Ticket-kø'}
              <Badge variant="secondary">{filteredTickets.length}</Badge>
            </CardTitle>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={en ? 'Search user, subject, category...' : 'Søg bruger, emne, kategori...'}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="all">{en ? 'All' : 'Alle'}</TabsTrigger>
                <TabsTrigger value="open">{en ? 'Open' : 'Åbne'}</TabsTrigger>
                <TabsTrigger value="claimed">{en ? 'In progress' : 'I gang'}</TabsTrigger>
                <TabsTrigger value="closed">{en ? 'Closed' : 'Lukkede'}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={attentionOnly ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setAttentionOnly((value) => !value)}
              >
                <Flame className="h-4 w-4" />
                {en ? 'Attention only' : 'Kun kræver opmærksomhed'}
              </Button>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[190px] bg-background/50">
                  <SelectValue placeholder={en ? 'All categories' : 'Alle kategorier'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{en ? 'All categories' : 'Alle kategorier'}</SelectItem>
                  {categories.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="h-9 w-[180px] bg-background/50">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attention">{en ? 'Needs attention' : 'Opmærksomhed først'}</SelectItem>
                  <SelectItem value="oldest">{en ? 'Oldest first' : 'Ældste først'}</SelectItem>
                  <SelectItem value="newest">{en ? 'Newest first' : 'Nyeste først'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab}>
            <TabsContent value={activeTab} className="mt-0">
              {ticketsLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Ticket className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-lg font-medium">{en ? 'Queue is clear' : 'Køen er tom'}</h3>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {en
                      ? 'No tickets match the current filters.'
                      : 'Ingen tickets matcher de valgte filtre.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{en ? 'Ticket' : 'Ticket'}</TableHead>
                        <TableHead>{en ? 'User' : 'Bruger'}</TableHead>
                        <TableHead>{en ? 'Category' : 'Kategori'}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>{en ? 'Assigned' : 'Ansvarlig'}</TableHead>
                        <TableHead>{en ? 'Age' : 'Alder'}</TableHead>
                        <TableHead className="text-right">{en ? 'Actions' : 'Handlinger'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => {
                        const status = statusConfig[ticket.status];
                        const StatusIcon = status.icon;
                        const attention = getTicketAttention(ticket);
                        const age = getTicketAgeHours(ticket);
                        const discordUrl = selectedGuild?.guild_id
                          ? `https://discord.com/channels/${selectedGuild.guild_id}/${ticket.channel_id}`
                          : null;

                        return (
                          <TableRow key={ticket.id} className={attention === 'urgent' ? 'bg-destructive/[0.035]' : undefined}>
                            <TableCell className="min-w-[250px]">
                              <div className="flex items-start gap-3">
                                <AttentionDot attention={attention} />
                                <div className="min-w-0">
                                  <div className="max-w-[360px] truncate font-medium">
                                    {ticket.subject || (en ? 'No subject' : 'Intet emne')}
                                  </div>
                                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                                    #{ticket.id.slice(0, 8)}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="max-w-[170px] truncate">
                                  {ticket.creator_name || ticket.creator_id}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {ticket.ticket_categories?.emoji || '🎫'} {ticket.ticket_categories?.name || (en ? 'Unknown' : 'Ukendt')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ticket.claimed_by_name ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <UserRoundCheck className="h-4 w-4 text-primary" />
                                  {ticket.claimed_by_name}
                                </span>
                              ) : ticket.status === 'closed' ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <Badge variant="outline" className="border-dashed">
                                  {en ? 'Unclaimed' : 'Ikke claimed'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{formatHours(age, en)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: dateLoc })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link to={`/dashboard/tickets/${ticket.id}` as any}>
                                  <Button variant="ghost" size="sm">
                                    {en ? 'Details' : 'Detaljer'}
                                  </Button>
                                </Link>

                                {discordUrl && ticket.status !== 'closed' && (
                                  <Button variant="ghost" size="icon" asChild title={en ? 'Open in Discord' : 'Åbn i Discord'}>
                                    <a href={discordUrl} target="_blank" rel="noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}

                                {ticket.status === 'closed' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        title={en ? 'Delete database record' : 'Slet databasepost'}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{en ? 'Delete ticket permanently?' : 'Slet ticket permanent?'}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {en
                                            ? 'This deletes the ticket record and its saved messages from the dashboard. It does not act as a normal Discord close workflow.'
                                            : 'Dette sletter ticket-posten og dens gemte beskeder fra dashboardet. Det er ikke det samme som den normale lukning i Discord.'}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{en ? 'Cancel' : 'Annuller'}</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => {
                                            deleteTicket.mutate(ticket.id, {
                                              onSuccess: () => toast.success(en ? 'Ticket deleted' : 'Ticket slettet'),
                                              onError: () => toast.error(en ? 'Could not delete ticket' : 'Kunne ikke slette ticket'),
                                            });
                                          }}
                                        >
                                          {en ? 'Delete permanently' : 'Slet permanent'}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AttentionDot({ attention }: { attention: 'normal' | 'watch' | 'urgent' }) {
  if (attention === 'normal') {
    return <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />;
  }
  if (attention === 'watch') {
    return <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500" title="Needs attention" />;
  }
  return <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" title="Urgent" />;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  loading,
  danger = false,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={`text-2xl font-bold ${danger ? 'text-destructive' : ''}`}>{value}</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
