import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar, Plus, Trash2, Clock, Send } from 'lucide-react';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { useAuth } from '@/contexts/AuthContext';
import { ChannelSelect } from '@/components/ui/channel-select';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

export default function SchedulerSettings() {
  const { upcomingMessages, sentMessages, isLoading, createMessage, deleteMessage } = useScheduledMessages();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [repeatInterval, setRepeatInterval] = useState<string>('none');

  const handleCreate = () => {
    if (!channelId || !scheduledAt || !content) return;

    createMessage.mutate(
      {
        channel_id: channelId,
        content,
        scheduled_at: new Date(scheduledAt).toISOString(),
        repeat_interval: repeatInterval === 'none' ? null : (repeatInterval as 'daily' | 'weekly' | 'monthly'),
        created_by_id: user?.id ?? 'unknown',
        created_by_name: user?.email?.split('@')[0],
      },
      {
        onSuccess: () => {
          setOpen(false);
          setChannelId('');
          setContent('');
          setScheduledAt('');
          setRepeatInterval('none');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planlagte Beskeder</h1>
          <p className="text-muted-foreground">
            Planlæg beskeder der automatisk sendes på et specifikt tidspunkt
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny Besked
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Planlæg Besked</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kanal</Label>
                <ChannelSelect
                  value={channelId}
                  onValueChange={setChannelId}
                  placeholder="Vælg kanal..."
                />
              </div>

              <div className="space-y-2">
                <Label>Besked</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Skriv din besked her..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Tidspunkt</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Gentag</Label>
                <Select value={repeatInterval} onValueChange={setRepeatInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen gentagelse</SelectItem>
                    <SelectItem value="daily">Dagligt</SelectItem>
                    <SelectItem value="weekly">Ugentligt</SelectItem>
                    <SelectItem value="monthly">Månedligt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreate}
                disabled={!channelId || !content || !scheduledAt || createMessage.isPending}
                className="w-full"
              >
                {createMessage.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="mr-2 h-4 w-4" />
                )}
                Planlæg Besked
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Kommende Beskeder
            </CardTitle>
            <CardDescription>Beskeder der afventer afsendelse</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Ingen planlagte beskeder</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {format(new Date(msg.scheduled_at), 'PPP HH:mm', { locale: da })}
                        </Badge>
                        {msg.repeat_interval && (
                          <Badge variant="secondary">{msg.repeat_interval}</Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm">{msg.content}</p>
                      <p className="text-xs text-muted-foreground">
                        Oprettet af {msg.created_by_name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMessage.mutate(msg.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Sendte Beskeder
            </CardTitle>
            <CardDescription>Beskeder der er blevet sendt</CardDescription>
          </CardHeader>
          <CardContent>
            {sentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Send className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Ingen sendte beskeder endnu</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sentMessages.slice(0, 10).map((msg) => (
                  <div key={msg.id} className="rounded-lg border p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        Sendt {msg.sent_at && format(new Date(msg.sent_at), 'PPP HH:mm', { locale: da })}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
