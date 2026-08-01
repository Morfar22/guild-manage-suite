import { useParams, Link } from '@tanstack/react-router';
import { useTicket, useTicketMessages } from '@/hooks/useTickets';
import { useApplicationByTicketId } from '@/hooks/useApplications';
import { useAITicketSummary } from '@/hooks/useAITicketSummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Tag,
  MessageSquare,
  Download,
  Brain,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

export default function TicketDetail() {
  const { ticketId } = useParams({ from: '/dashboard/tickets/$ticketId' });
  const { data: ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticketId);
  const { data: linkedApplication } = useApplicationByTicketId(ticketId);
  const { generateSummary } = useAITicketSummary();

  const statusConfig = {
    open: { label: 'Open', variant: 'destructive' as const, icon: AlertCircle },
    claimed: { label: 'In Progress', variant: 'default' as const, icon: Clock },
    closed: { label: 'Closed', variant: 'secondary' as const, icon: CheckCircle },
  };

  const handleExportTranscript = () => {
    if (!ticket || !messages) return;

    const transcriptText = messages
      .map((msg) => `[${format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}] ${msg.author_name || msg.author_id}: ${msg.content}`)
      .join('\n');

    const header = `Ticket Transcript - ${ticket.subject || 'No subject'}
Created by: ${ticket.creator_name || ticket.creator_id}
Date: ${format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
Status: ${statusConfig[ticket.status].label}
-------------------------------------------

`;

    const blob = new Blob([header + transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${ticketId?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (ticketLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold">Ticket not found</h2>
        <p className="text-muted-foreground mb-4">The requested ticket does not exist</p>
        <Link to={"/dashboard/tickets" as any}>
          <Button>Back to tickets</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[ticket.status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={"/dashboard/tickets" as any}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {ticket.subject || 'Ticket'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created by {ticket.creator_name || ticket.creator_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => ticketId && generateSummary.mutate(ticketId)} variant="outline" className="gap-2" disabled={generateSummary.isPending}>
            {generateSummary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            AI Summary
          </Button>
          <Button onClick={handleExportTranscript} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export transcript
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket Info */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Ticket Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="outline">
                {ticket.ticket_type === 'support' ? 'Support' : 'Application'}
              </Badge>
            </div>

            {linkedApplication && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Application</span>
                <Badge
                  variant={
                    linkedApplication.status === 'approved'
                      ? 'default'
                      : linkedApplication.status === 'denied'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {linkedApplication.status === 'approved'
                    ? 'Approved'
                    : linkedApplication.status === 'denied'
                      ? 'Denied'
                      : 'Pending'}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Category</span>
              <span className="text-sm font-medium">
                {ticket.ticket_categories?.name || 'None'}
              </span>
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created by:</span>
                <span className="font-medium">{ticket.creator_name || ticket.creator_id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">
                  {format(new Date(ticket.created_at), "MMM d, yyyy 'at' HH:mm", { locale: enUS })}
                </span>
              </div>
              {ticket.claimed_by_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Claimed by:</span>
                  <span className="font-medium">{ticket.claimed_by_name}</span>
                </div>
              )}
              {ticket.closed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Closed:</span>
                  <span className="font-medium">
                    {format(new Date(ticket.closed_at), "MMM d, yyyy 'at' HH:mm", { locale: enUS })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        {(ticket as any).ai_summary && (
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{(ticket as any).ai_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Transcript */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Transcript ({messages?.length ?? 0} messages)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No messages</h3>
                  <p className="text-sm text-muted-foreground">
                    There are no messages in this ticket yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((message) => (
                    <div key={message.id} className="flex gap-3 group">
                      <Avatar className="h-10 w-10">
                        {message.author_avatar && (
                          <AvatarImage src={message.author_avatar} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {(message.author_name || message.author_id).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {message.author_name || message.author_id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), "MMM d 'at' HH:mm", { locale: enUS })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
