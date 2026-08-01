import { useState } from 'react';
import { useTickets, useTicketStats, useDeleteTicket, TicketStatus } from '@/hooks/useTickets';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Ticket, Search, Clock, CheckCircle, AlertCircle, TrendingUp, Users, MessageSquare, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function Tickets() {
  const { language } = useLanguage();
  const en = language === 'en';
  const dateLoc = en ? enUS : da;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | TicketStatus>('all');
  const { data: tickets, isLoading: ticketsLoading } = useTickets(activeTab === 'all' ? undefined : activeTab);
  const { data: stats, isLoading: statsLoading } = useTicketStats();
  const deleteTicket = useDeleteTicket();

  const statusConfig: Record<TicketStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof AlertCircle }> = {
    open: { label: en ? 'Open' : 'Åben', variant: 'destructive', icon: AlertCircle },
    claimed: { label: en ? 'In Progress' : 'I gang', variant: 'default', icon: Clock },
    closed: { label: en ? 'Closed' : 'Lukket', variant: 'secondary', icon: CheckCircle },
  };

  const filteredTickets = tickets?.filter(ticket => {
    const s = searchQuery.toLowerCase();
    return ticket.creator_name?.toLowerCase().includes(s) || ticket.subject?.toLowerCase().includes(s) || ticket.channel_id.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-muted-foreground">{en ? 'Manage support tickets' : 'Administrer support tickets'}</p>
        </div>
        <Link to="/dashboard/tickets/settings">
          <Button variant="outline">{en ? 'Settings' : 'Indstillinger'}</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{en ? 'Total Tickets' : 'Totale Tickets'}</CardTitle>
            <Ticket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>{statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats?.totalTickets ?? 0}</div>}</CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{en ? 'Open Tickets' : 'Åbne Tickets'}</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>{statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-destructive">{stats?.openTickets ?? 0}</div>}</CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{en ? 'This Week' : 'Denne uge'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>{statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats?.ticketsThisWeek ?? 0}</div>}</CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{en ? 'Avg. Response' : 'Gns. Svar'}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats?.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}h` : 'N/A'}</div>}</CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />{en ? 'All Tickets' : 'Alle Tickets'}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={en ? 'Search tickets...' : 'Søg tickets...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background/50" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">{en ? 'All' : 'Alle'}</TabsTrigger>
              <TabsTrigger value="open">{en ? 'Open' : 'Åbne'}</TabsTrigger>
              <TabsTrigger value="claimed">{en ? 'In Progress' : 'I gang'}</TabsTrigger>
              <TabsTrigger value="closed">{en ? 'Closed' : 'Lukkede'}</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-0">
              {ticketsLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredTickets?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Ticket className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">{en ? 'No tickets found' : 'Ingen tickets fundet'}</h3>
                  <p className="text-sm text-muted-foreground">{searchQuery ? (en ? 'Try changing your search' : 'Prøv at ændre din søgning') : (en ? 'No tickets in this category yet' : 'Der er ingen tickets i denne kategori endnu')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{en ? 'User' : 'Bruger'}</TableHead>
                      <TableHead>{en ? 'Subject' : 'Emne'}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>{en ? 'Created' : 'Oprettet'}</TableHead>
                      <TableHead className="text-right">{en ? 'Action' : 'Handling'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets?.map((ticket) => {
                      const status = statusConfig[ticket.status];
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={ticket.id}>
                          <TableCell><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{ticket.creator_name || ticket.creator_id}</span></div></TableCell>
                          <TableCell className="max-w-[200px] truncate">{ticket.subject || (en ? 'No subject' : 'Intet emne')}</TableCell>
                          <TableCell><Badge variant={status.variant} className="gap-1"><StatusIcon className="h-3 w-3" />{status.label}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: dateLoc })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link to={`/dashboard/tickets/${ticket.id}` as any}><Button variant="ghost" size="sm">{en ? 'View transcript' : 'Se transskript'}</Button></Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{en ? 'Delete Ticket' : 'Slet Ticket'}</AlertDialogTitle>
                                    <AlertDialogDescription>{en ? 'This will permanently delete this ticket and all its messages. This action cannot be undone.' : 'Dette sletter permanent denne ticket og alle dens beskeder. Handlingen kan ikke fortrydes.'}</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{en ? 'Cancel' : 'Annuller'}</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { deleteTicket.mutate(ticket.id, { onSuccess: () => toast.success(en ? 'Ticket deleted' : 'Ticket slettet'), onError: () => toast.error(en ? 'Could not delete ticket' : 'Kunne ikke slette ticket') }); }}>{en ? 'Delete' : 'Slet'}</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
