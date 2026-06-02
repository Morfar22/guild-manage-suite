import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Bell, Plus, Trash2, Clock, CheckCircle2, Calendar, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { da } from 'date-fns/locale';

export default function Reminders() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('daily');

  const { data: reminders } = useQuery({
    queryKey: ['reminders', selectedGuild?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders' as any)
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .order('remind_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createReminder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reminders' as any).insert({
        guild_id: selectedGuild!.id,
        created_by_user_id: user!.id,
        message,
        remind_at: new Date(remindAt).toISOString(),
        target_channel_id: channelId || null,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Påmindelse oprettet!');
      setDialogOpen(false);
      setMessage('');
      setRemindAt('');
      setChannelId('');
      setIsRecurring(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Påmindelse slettet');
    },
  });

  const pending = reminders?.filter(r => !r.is_sent) ?? [];
  const sent = reminders?.filter(r => r.is_sent) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" /> Påmindelser
          </h1>
          <p className="text-muted-foreground">Opret og administrer påmindelser der sendes via botten</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Ny påmindelse</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret påmindelse</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Besked</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Husk at..."
                />
              </div>
              <div>
                <Label>Tidspunkt</Label>
                <Input
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
              </div>
              <div>
                <Label>Kanal ID (valgfrit)</Label>
                <Input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Discord kanal ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                <Label>Tilbagevendende</Label>
              </div>
              {isRecurring && (
                <Select value={recurrenceInterval} onValueChange={setRecurrenceInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hver time</SelectItem>
                    <SelectItem value="daily">Dagligt</SelectItem>
                    <SelectItem value="weekly">Ugentligt</SelectItem>
                    <SelectItem value="monthly">Månedligt</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => createReminder.mutate()} disabled={!message || !remindAt} className="w-full">
                <Send className="h-4 w-4 mr-2" /> Opret
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Ventende ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length > 0 ? (
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Calendar className="h-4 w-4 mt-1 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{r.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.remind_at), 'PPp', { locale: da })}
                      </p>
                      {r.is_recurring && (
                        <Badge variant="outline" className="text-[10px]">{r.recurrence_interval}</Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteReminder.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6">Ingen ventende påmindelser</p>
          )}
        </CardContent>
      </Card>

      {/* Sent Reminders */}
      {sent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Sendt ({sent.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {sent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg opacity-60">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="text-sm truncate flex-1">{r.message}</p>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(r.remind_at), { addSuffix: true, locale: da })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
