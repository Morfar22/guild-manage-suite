import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, TestTube, Loader2, Globe } from 'lucide-react';
import { useWebhookConfigs } from '@/hooks/useWebhookConfigs';

const EVENT_TYPES = [
  { id: 'member_join', label: 'Medlem tilsluttet' },
  { id: 'member_leave', label: 'Medlem forladt' },
  { id: 'message_delete', label: 'Besked slettet' },
  { id: 'mod_action', label: 'Moderationshandling' },
  { id: 'ticket_create', label: 'Ticket oprettet' },
  { id: 'ticket_close', label: 'Ticket lukket' },
  { id: 'ban', label: 'Ban' },
  { id: 'warn', label: 'Advarsel' },
  { id: 'xp_levelup', label: 'Level Up' },
  { id: 'giveaway', label: 'Giveaway' },
];

export default function WebhookManager() {
  const { webhooks, isLoading, create, update, remove, testWebhook } = useWebhookConfigs();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const handleCreate = () => {
    if (!name || !url) return;
    create.mutate({ name, webhook_url: url, event_types: selectedEvents, enabled: true });
    setOpen(false);
    setName('');
    setUrl('');
    setSelectedEvents([]);
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

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
            <Globe className="h-8 w-8 text-primary" />
            Webhook Manager
          </h1>
          <p className="text-muted-foreground mt-1">Opret og administrer webhooks til eksterne integrationer</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ny Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Navn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Mod Log Webhook" />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
              </div>
              <div className="space-y-2">
                <Label>Event types</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map((event) => (
                    <div key={event.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedEvents.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <span className="text-sm">{event.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!name || !url || create.isPending} className="w-full">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Opret Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Ingen webhooks konfigureret</p>
            <p className="text-sm text-muted-foreground mt-1">Opret en webhook for at sende events til eksterne tjenester</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {webhooks.map((wh) => (
            <Card key={wh.id} className={!wh.enabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {wh.name}
                  </CardTitle>
                  <Switch
                    checked={wh.enabled}
                    onCheckedChange={(enabled) => update.mutate({ id: wh.id, enabled })}
                  />
                </div>
                <CardDescription className="truncate text-xs">{wh.webhook_url}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {wh.event_types.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Ingen events valgt</span>
                  ) : (
                    wh.event_types.map((et) => (
                      <Badge key={et} variant="secondary" className="text-[10px]">
                        {EVENT_TYPES.find((e) => e.id === et)?.label || et}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testWebhook.mutate(wh.webhook_url)}
                    disabled={testWebhook.isPending}
                    className="gap-1"
                  >
                    <TestTube className="h-3 w-3" /> Test
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => remove.mutate(wh.id)}
                    disabled={remove.isPending}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Slet
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
