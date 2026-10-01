import { useMemo, useState, type ReactNode } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useTicket, useTicketMessages, getTicketAgeHours } from '@/hooks/useTickets';
import { useApplicationByTicketId } from '@/hooks/useApplications';
import { useAITicketSummary } from '@/hooks/useAITicketSummary';
import { useGuild } from '@/contexts/GuildContext';
import { TicketOperationsPanel } from '@/components/tickets/TicketOperationsPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ExternalLink,
  Paperclip,
  Search,
  Copy,
  TimerReset,
  UserRoundCheck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { da, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

type Attachment = {
  url?: string;
  name?: string;
  size?: number;
};

function formatDuration(ms: number, en: boolean) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TicketDetail() {
  const { ticketId } = useParams({ from: '/dashboard/tickets/$ticketId' });
  const { selectedGuild } = useGuild();
  const { language } = useLanguage();
  const en = language === 'en';
  const dateLocale = en ? enUS : da;

  const { data: ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticketId);
  const { data: linkedApplication } = useApplicationByTicketId(ticketId);
  const { generateSummary } = useAITicketSummary();
  const [messageSearch, setMessageSearch] = useState('');

  const statusConfig = {
    open: { label: en ? 'Open' : 'Åben', variant: 'destructive' as const, icon: AlertCircle },
    claimed: { label: en ? 'In progress' : 'I gang', variant: 'default' as const, icon: Clock },
    closed: { label: en ? 'Closed' : 'Lukket', variant: 'secondary' as const, icon: CheckCircle },
  };

  const filteredMessages = useMemo(() => {
    const search = messageSearch.trim().toLowerCase();
    if (!search) return messages || [];
    return (messages || []).filter((message) =>
      [message.content, message.author_name, message.author_id]
        .some((value) => value?.toLowerCase().includes(search))
    );
  }, [messages, messageSearch]);

  const messageMetrics = useMemo(() => {
    if (!ticket) return null;
    const all = messages || [];
    const createdAt = new Date(ticket.created_at).getTime();
    const endAt = ticket.closed_at ? new Date(ticket.closed_at).getTime() : Date.now();
    const firstStaffMessage = all.find((message) => message.author_id !== ticket.creator_id);

    return {
      lifetime: endAt - createdAt,
      firstResponse: firstStaffMessage
        ? Math.max(0, new Date(firstStaffMessage.created_at).getTime() - createdAt)
        : null,
      participants: new Set(all.map((message) => message.author_id)).size,
      attachments: all.reduce((sum, message) => {
        const list = Array.isArray(message.attachments) ? message.attachments : [];
        return sum + list.length;
      }, 0),
    };
  }, [ticket, messages]);

  const handleExportTranscript = () => {
    if (!ticket || !messages) return;

    const transcriptText = messages
      .map((message) => {
        const attachments = (Array.isArray(message.attachments) ? message.attachments : []) as Attachment[];
        const attachmentLines = attachments
          .filter((attachment) => attachment.url)
          .map((attachment) => `  attachment: ${attachment.name || 'file'} - ${attachment.url}`)
          .join('\n');
        const line = `[${format(new Date(message.created_at), 'dd/MM/yyyy HH:mm')}] ${message.author_name || message.author_id}: ${message.content || ''}`;
        return attachmentLines ? `${line}\n${attachmentLines}` : line;
      })
      .join('\n');

    const header = [
      `Ticket Transcript - ${ticket.subject || 'No subject'}`,
      `Ticket ID: ${ticket.id}`,
      `Discord Channel: ${ticket.channel_id}`,
      `Created by: ${ticket.creator_name || ticket.creator_id}`,
      `Category: ${ticket.ticket_categories?.name || 'None'}`,
      `Created: ${format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}`,
      `Status: ${statusConfig[ticket.status].label}`,
      ticket.claimed_by_name ? `Claimed by: ${ticket.claimed_by_name}` : null,
      ticket.closed_by_name ? `Closed by: ${ticket.closed_by_name}` : null,
      '-------------------------------------------',
      '',
    ].filter(Boolean).join('\n');

    const blob = new Blob([header + transcriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ticket-${ticketId?.slice(0, 8)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(en ? `${label} copied` : `${label} kopieret`);
    } catch {
      toast.error(en ? 'Could not copy' : 'Kunne ikke kopiere');
    }
  };

  if (ticketLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[320px] w-full lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">{en ? 'Ticket not found' : 'Ticket ikke fundet'}</h2>
        <p className="mb-4 text-muted-foreground">
          {en ? 'The requested ticket does not exist.' : 'Den valgte ticket findes ikke.'}
        </p>
        <Link to={"/dashboard/tickets" as any}>
          <Button>{en ? 'Back to tickets' : 'Tilbage til tickets'}</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[ticket.status];
  const StatusIcon = status.icon;
  const discordUrl = selectedGuild?.guild_id
    ? `https://discord.com/channels/${selectedGuild.guild_id}/${ticket.channel_id}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <Link to={"/dashboard/tickets" as any}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              <Badge variant="outline">
                {ticket.ticket_categories?.emoji || '🎫'} {ticket.ticket_categories?.name || (en ? 'Unknown category' : 'Ukendt kategori')}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">#{ticket.id.slice(0, 8)}</span>
            </div>
            <h1 className="max-w-4xl truncate text-2xl font-bold text-foreground">
              {ticket.subject || (en ? 'Ticket without subject' : 'Ticket uden emne')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {en ? 'Created by' : 'Oprettet af'} {ticket.creator_name || ticket.creator_id} ·{' '}
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: dateLocale })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {discordUrl && ticket.status !== 'closed' && (
            <Button asChild className="gap-2">
              <a href={discordUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {en ? 'Open in Discord' : 'Åbn i Discord'}
              </a>
            </Button>
          )}
          <Button
            onClick={() => ticketId && generateSummary.mutate(ticketId)}
            variant="outline"
            className="gap-2"
            disabled={generateSummary.isPending}
          >
            {generateSummary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {en ? 'AI summary' : 'AI-opsummering'}
          </Button>
          <Button onClick={handleExportTranscript} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {en ? 'Export transcript' : 'Eksportér transskript'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          label={en ? 'Messages' : 'Beskeder'}
          value={String(messages?.length ?? 0)}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MiniMetric
          label={en ? 'First staff response' : 'Første staff-svar'}
          value={messageMetrics?.firstResponse == null ? '—' : formatDuration(messageMetrics.firstResponse, en)}
          icon={<UserRoundCheck className="h-4 w-4" />}
        />
        <MiniMetric
          label={ticket.status === 'closed' ? (en ? 'Resolution time' : 'Løsningstid') : (en ? 'Ticket age' : 'Ticket-alder')}
          value={messageMetrics ? formatDuration(messageMetrics.lifetime, en) : '—'}
          icon={<TimerReset className="h-4 w-4" />}
        />
        <MiniMetric
          label={en ? 'Participants / files' : 'Deltagere / filer'}
          value={messageMetrics ? `${messageMetrics.participants} / ${messageMetrics.attachments}` : '—'}
          icon={<Paperclip className="h-4 w-4" />}
        />
      </div>

      <TicketOperationsPanel ticket={ticket} />

      {(ticket as any).ai_summary && (
        <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {en ? 'AI case brief' : 'AI-sagsbrief'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{(ticket as any).ai_summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">{en ? 'Case details' : 'Sagsdetaljer'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Status">
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </DetailRow>

            <DetailRow label={en ? 'Type' : 'Type'}>
              <Badge variant="outline">
                {ticket.ticket_type === 'support' ? 'Support' : (en ? 'Application' : 'Ansøgning')}
              </Badge>
            </DetailRow>

            <DetailRow label={en ? 'Category' : 'Kategori'}>
              <span className="text-right text-sm font-medium">{ticket.ticket_categories?.name || '—'}</span>
            </DetailRow>

            {linkedApplication && (
              <DetailRow label={en ? 'Application' : 'Ansøgning'}>
                <Badge
                  variant={
                    linkedApplication.status === 'approved'
                      ? 'default'
                      : linkedApplication.status === 'denied'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {linkedApplication.status}
                </Badge>
              </DetailRow>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <IconInfo icon={<User className="h-4 w-4" />} label={en ? 'Created by' : 'Oprettet af'} value={ticket.creator_name || ticket.creator_id} />
              <IconInfo
                icon={<Calendar className="h-4 w-4" />}
                label={en ? 'Created' : 'Oprettet'}
                value={format(new Date(ticket.created_at), "dd MMM yyyy 'kl.' HH:mm", { locale: dateLocale })}
              />
              {ticket.claimed_by_name && (
                <IconInfo icon={<Tag className="h-4 w-4" />} label={en ? 'Claimed by' : 'Claimed af'} value={ticket.claimed_by_name} />
              )}
              {ticket.closed_at && (
                <IconInfo
                  icon={<CheckCircle className="h-4 w-4" />}
                  label={en ? 'Closed' : 'Lukket'}
                  value={format(new Date(ticket.closed_at), "dd MMM yyyy 'kl.' HH:mm", { locale: dateLocale })}
                />
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <CopyRow label="Ticket ID" value={ticket.id} onCopy={copy} />
              <CopyRow label="Channel ID" value={ticket.channel_id} onCopy={copy} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                {en ? 'Conversation' : 'Samtale'}
                <Badge variant="secondary">{filteredMessages.length}</Badge>
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  placeholder={en ? 'Search messages...' : 'Søg i beskeder...'}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[650px] pr-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-lg font-medium">{en ? 'No messages found' : 'Ingen beskeder fundet'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {messageSearch
                      ? (en ? 'Try a different search.' : 'Prøv en anden søgning.')
                      : (en ? 'There are no saved messages in this ticket.' : 'Der er ingen gemte beskeder i denne ticket.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredMessages.map((message) => {
                    const attachments = (Array.isArray(message.attachments) ? message.attachments : []) as Attachment[];
                    const isCreator = message.author_id === ticket.creator_id;

                    return (
                      <div key={message.id} className="flex gap-3">
                        <Avatar className="h-10 w-10">
                          {message.author_avatar && <AvatarImage src={message.author_avatar} />}
                          <AvatarFallback className="bg-primary/10 text-sm text-primary">
                            {(message.author_name || message.author_id).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{message.author_name || message.author_id}</span>
                            <Badge variant={isCreator ? 'outline' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                              {isCreator ? (en ? 'User' : 'Bruger') : 'Staff'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.created_at), "dd MMM 'kl.' HH:mm", { locale: dateLocale })}
                            </span>
                          </div>

                          {message.content && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                              {message.content}
                            </p>
                          )}

                          {attachments.length > 0 && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {attachments.map((attachment, index) => (
                                <a
                                  key={`${message.id}-attachment-${index}`}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 p-2 text-xs hover:bg-accent"
                                >
                                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate">{attachment.name || (en ? 'Attachment' : 'Vedhæftning')}</span>
                                  {attachment.size ? <span className="text-muted-foreground">{formatBytes(attachment.size)}</span> : null}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {en
          ? `Queue age: ${formatDuration(getTicketAgeHours(ticket) * 60 * 60 * 1000, en)}. First-response time is estimated from the first saved message by someone other than the ticket creator.`
          : `Kø-alder: ${formatDuration(getTicketAgeHours(ticket) * 60 * 60 * 1000, en)}. Første svartid estimeres ud fra den første gemte besked fra en anden end ticket-opretteren.`}
      </p>
    </div>
  );
}

function MiniMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function IconInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value, label)}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-2 text-left hover:bg-accent"
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-xs">{value}</div>
      </div>
      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
