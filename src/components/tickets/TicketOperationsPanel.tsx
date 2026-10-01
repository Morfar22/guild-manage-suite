import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, RotateCcw, Save, Tag, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import {
  Ticket,
  TicketPriority,
  useCreateTicketInternalNote,
  useReopenTicket,
  useTicketInternalNotes,
  useUpdateTicketOperations,
} from '@/hooks/useTickets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const priorityMeta: Record<TicketPriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Lav', variant: 'outline' },
  normal: { label: 'Normal', variant: 'secondary' },
  high: { label: 'Høj', variant: 'default' },
  urgent: { label: 'Akut', variant: 'destructive' },
};

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TicketOperationsPanel({ ticket }: { ticket: Ticket }) {
  const { user } = useAuth();
  const { data: roles = [] } = useDiscordRoles();
  const updateTicket = useUpdateTicketOperations();
  const reopenTicket = useReopenTicket();
  const notes = useTicketInternalNotes(ticket.id);
  const createNote = useCreateTicketInternalNote(ticket.id);

  const [tags, setTags] = useState((ticket.tags || []).join(', '));
  const [sla, setSla] = useState(toLocalDateTime(ticket.sla_due_at));
  const [resolution, setResolution] = useState(ticket.resolution || '');
  const [note, setNote] = useState('');

  const transferRole = useMemo(
    () => roles.find((role) => role.id === ticket.transferred_to_role_id),
    [roles, ticket.transferred_to_role_id]
  );

  const saveMeta = async () => {
    const parsedTags = [...new Set(tags.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 20);
    await updateTicket.mutateAsync({
      id: ticket.id,
      updates: {
        tags: parsedTags,
        sla_due_at: sla ? new Date(sla).toISOString() : null,
        resolution: resolution.trim() || null,
      },
    });
    toast.success('Ticket operations gemt');
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await createNote.mutateAsync({
      note: note.trim(),
      authorUserId: user?.id ?? null,
      authorName: user?.email ?? null,
    });
    setNote('');
    toast.success('Intern note tilføjet');
  };

  const slaBreached = Boolean(
    ticket.status !== 'closed' &&
    ticket.sla_due_at &&
    new Date(ticket.sla_due_at).getTime() < Date.now()
  );

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserRoundCog className="h-5 w-5 text-primary" />
              Ticket Operations
            </CardTitle>
            <CardDescription>
              Priority, SLA, tags, transfer, resolution og interne staff-noter.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={priorityMeta[ticket.priority].variant}>
              {priorityMeta[ticket.priority].label}
            </Badge>
            {slaBreached && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                SLA overskredet
              </Badge>
            )}
            {ticket.escalated_at && <Badge variant="destructive">Escalated</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={ticket.priority}
              onValueChange={(priority) =>
                updateTicket.mutate({
                  id: ticket.id,
                  updates: { priority: priority as TicketPriority },
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Lav</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Høj</SelectItem>
                <SelectItem value="urgent">Akut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              SLA deadline
            </Label>
            <Input type="datetime-local" value={sla} onChange={(event) => setSla(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </Label>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="billing, bug, vip"
            />
          </div>

          <div className="space-y-2">
            <Label>Transfer til rolle</Label>
            <Select
              value={ticket.transferred_to_role_id || 'none'}
              onValueChange={(roleId) => {
                if (roleId === 'none') {
                  updateTicket.mutate({
                    id: ticket.id,
                    updates: {
                      transferred_to_role_id: null,
                      transferred_to_role_name: null,
                    },
                  });
                  return;
                }

                const role = roles.find((item) => item.id === roleId);
                updateTicket.mutate({
                  id: ticket.id,
                  updates: {
                    transferred_to_role_id: roleId,
                    transferred_to_role_name: role?.name ?? roleId,
                  },
                });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Ingen transfer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen</SelectItem>
                {roles
                  .filter((role) => role.name !== '@everyone')
                  .map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {transferRole && <p className="text-xs text-muted-foreground">Aktuelt: {transferRole.name}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Resolution / intern afslutningsnote</Label>
          <Textarea
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            placeholder="Hvad blev løsningen på sagen?"
            rows={3}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveMeta} disabled={updateTicket.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Gem operations
          </Button>

          {ticket.status === 'closed' && (
            <Button
              variant="outline"
              onClick={() => reopenTicket.mutate(ticket.id)}
              disabled={reopenTicket.isPending}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reopen ticket
            </Button>
          )}
        </div>

        <div className="border-t pt-5">
          <div className="mb-3">
            <h3 className="font-semibold">Interne staff-noter</h3>
            <p className="text-xs text-muted-foreground">Disse noter sendes ikke til ticket-brugeren.</p>
          </div>

          <div className="flex gap-2">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Skriv en intern note..."
              rows={2}
            />
            <Button onClick={addNote} disabled={!note.trim() || createNote.isPending}>
              Tilføj
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {(notes.data ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{item.author_name || 'Staff'}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Intl.DateTimeFormat('da-DK', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(item.created_at))}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{item.note}</p>
              </div>
            ))}
            {!notes.data?.length && (
              <p className="py-3 text-center text-sm text-muted-foreground">Ingen interne noter endnu.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
