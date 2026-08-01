import { useState } from 'react';
import { useTwitchSchedule, DAY_NAMES, TwitchScheduleEntry } from '@/hooks/useTwitchSchedule';
import { TwitchStreamer } from '@/hooks/useTwitchStreamers';
import { useToast } from '@/hooks/use-toast';
import { useGuild } from '@/contexts/GuildContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar, Clock, Plus, Trash2, Twitch, Loader2, Send,
} from 'lucide-react';

interface StreamScheduleTabProps {
  streamers: TwitchStreamer[];
  textChannels: { id: string; name: string }[];
}

export function StreamScheduleTab({ streamers, textChannels }: StreamScheduleTabProps) {
  const { toast } = useToast();
  const { selectedGuild } = useGuild();
  const { entries, settings, loading, saving, addEntry, removeEntry, saveSettings } = useTwitchSchedule();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  // Add form state
  const [formStreamerId, setFormStreamerId] = useState('');
  const [formDay, setFormDay] = useState('1');
  const [formStartTime, setFormStartTime] = useState('18:00');
  const [formEndTime, setFormEndTime] = useState('22:00');
  const [formTitle, setFormTitle] = useState('');
  const [formGame, setFormGame] = useState('');

  // Settings state
  const [localSettings, setLocalSettings] = useState({
    auto_post_enabled: settings?.auto_post_enabled ?? false,
    post_channel_id: settings?.post_channel_id ?? '',
    post_day: settings?.post_day ?? 1,
    post_time: settings?.post_time ?? '09:00',
    fetch_from_twitch: settings?.fetch_from_twitch ?? true,
  });

  // Sync settings when loaded
  useState(() => {
    if (settings) {
      setLocalSettings({
        auto_post_enabled: settings.auto_post_enabled,
        post_channel_id: settings.post_channel_id ?? '',
        post_day: settings.post_day,
        post_time: settings.post_time,
        fetch_from_twitch: settings.fetch_from_twitch,
      });
    }
  });

  const handleAdd = async () => {
    if (!formStreamerId) return;
    const success = await addEntry({
      streamer_id: formStreamerId,
      day_of_week: parseInt(formDay),
      start_time: formStartTime,
      end_time: formEndTime,
      title: formTitle || undefined,
      game_name: formGame || undefined,
    });
    if (success) {
      setAddDialogOpen(false);
      setFormTitle('');
      setFormGame('');
    }
  };

  const handleSaveSettings = () => {
    saveSettings(localSettings);
  };

  const handleManualPost = async () => {
    setPosting(true);
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Fejl', description: 'Du skal være logget ind.', variant: 'destructive' });
        return;
      }

      const res = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/twitch-handler?action=schedule_post_manual`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
          },
          body: JSON.stringify({ guild_id: selectedGuild?.id || entries[0]?.guild_id }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunne ikke sende skema');

      toast({ title: 'Sendt!', description: 'Ugeskemaet blev postet til Discord.' });
    } catch (err) {
      toast({ title: 'Fejl', description: err instanceof Error ? err.message : 'Ukendt fejl', variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  // Group entries by day
  const entriesByDay = DAY_NAMES.map((name, idx) => ({
    name,
    day: idx,
    items: entries.filter(e => e.day_of_week === idx),
  })).filter(d => d.items.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#9146FF]" />
            Ugentligt Streamskema
          </h3>
          <p className="text-sm text-muted-foreground">
            Tilføj faste streamingtider for dine trackede streamere
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Tilføj Tid
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj Stream Tid</DialogTitle>
              <DialogDescription>
                Tilføj en fast streamingtid til det ugentlige skema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Streamer</Label>
                <Select value={formStreamerId} onValueChange={setFormStreamerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg streamer" />
                  </SelectTrigger>
                  <SelectContent>
                    {streamers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.display_name || s.twitch_username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dag</Label>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start tid</Label>
                  <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Slut tid</Label>
                  <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Titel (valgfrit)</Label>
                <Input placeholder="F.eks. Chill Stream" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Spil/Kategori (valgfrit)</Label>
                <Input placeholder="F.eks. Just Chatting" value={formGame} onChange={e => setFormGame(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuller</Button>
              <Button onClick={handleAdd} disabled={saving || !formStreamerId}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tilføj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Weekly Calendar View */}
      {entriesByDay.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Intet skema tilføjet endnu</p>
              <p className="text-sm">Klik på "Tilføj Tid" for at oprette et ugentligt streamskema</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entriesByDay.map(({ name, items }) => (
            <Card key={name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map(entry => (
                  <ScheduleEntryRow key={entry.id} entry={entry} onRemove={removeEntry} saving={saving} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Auto-post Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5 text-primary" />
            Auto-post Ugeskema til Discord
          </CardTitle>
          <CardDescription>
            Botten poster automatisk det ugentlige skema i en Discord-kanal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Aktivér auto-post</Label>
            <Switch
              checked={localSettings.auto_post_enabled}
              onCheckedChange={v => setLocalSettings(s => ({ ...s, auto_post_enabled: v }))}
            />
          </div>

          {localSettings.auto_post_enabled && (
            <>
              <div className="space-y-2">
                <Label>Post i kanal</Label>
                <Select
                  value={localSettings.post_channel_id}
                  onValueChange={v => setLocalSettings(s => ({ ...s, post_channel_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kanal" />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map(c => (
                      <SelectItem key={c.id} value={c.id}># {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Post på dag</Label>
                  <Select
                    value={String(localSettings.post_day)}
                    onValueChange={v => setLocalSettings(s => ({ ...s, post_day: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, idx) => (
                        <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tidspunkt</Label>
                  <Input
                    type="time"
                    value={localSettings.post_time}
                    onChange={e => setLocalSettings(s => ({ ...s, post_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Hent fra Twitch API</Label>
                  <p className="text-xs text-muted-foreground">Hent også kommende streams fra Twitch automatisk</p>
                </div>
                <Switch
                  checked={localSettings.fetch_from_twitch}
                  onCheckedChange={v => setLocalSettings(s => ({ ...s, fetch_from_twitch: v }))}
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gem Skema-indstillinger
            </Button>
            <Button
              variant="outline"
              onClick={handleManualPost}
              disabled={posting || !settings?.post_channel_id}
              title={!settings?.post_channel_id ? 'Vælg en kanal og gem indstillingerne først' : 'Post ugeskemaet til Discord nu'}
            >
              {posting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Post Nu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScheduleEntryRow({ entry, onRemove, saving }: { entry: TwitchScheduleEntry; onRemove: (id: string) => void; saving: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={entry.streamer_avatar || undefined} />
          <AvatarFallback><Twitch className="h-4 w-4" /></AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.streamer_name || entry.twitch_username || 'Ukendt'}</span>
            {entry.title && <span className="text-xs text-muted-foreground">— {entry.title}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
            {entry.game_name && (
              <Badge variant="outline" className="text-xs py-0">{entry.game_name}</Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(entry.id)}
        disabled={saving}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
