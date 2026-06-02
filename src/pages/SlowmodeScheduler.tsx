import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { useSlowmodeSchedules } from '@/hooks/useSlowmodeSchedules';
import { ChannelSelect } from '@/components/ui/channel-select';

const DAY_NAMES = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

export default function SlowmodeScheduler() {
  const { schedules, isLoading, create, remove, toggle } = useSlowmodeSchedules();
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(23);
  const [slowmodeSec, setSlowmodeSec] = useState(5);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (d: number) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleCreate = () => {
    if (!channelId) return;
    create.mutate({ channel_id: channelId, start_hour: startHour, end_hour: endHour, slowmode_seconds: slowmodeSec, days_of_week: days });
    setOpen(false);
    setChannelId('');
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Timer className="h-8 w-8 text-primary" />
            Slowmode Scheduler
          </h1>
          <p className="text-muted-foreground mt-1">Automatisk slowmode i kanaler på bestemte tidspunkter</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Ny regel</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Opret Slowmode Regel</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kanal</Label>
                <ChannelSelect value={channelId} onValueChange={setChannelId} placeholder="Vælg kanal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start (time)</Label>
                  <Input type="number" value={startHour} onChange={(e) => setStartHour(parseInt(e.target.value))} min={0} max={23} />
                </div>
                <div className="space-y-2">
                  <Label>Slut (time)</Label>
                  <Input type="number" value={endHour} onChange={(e) => setEndHour(parseInt(e.target.value))} min={0} max={23} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slowmode (sekunder)</Label>
                <Input type="number" value={slowmodeSec} onChange={(e) => setSlowmodeSec(parseInt(e.target.value))} min={1} max={21600} />
              </div>
              <div className="space-y-2">
                <Label>Dage</Label>
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, i) => (
                    <Button key={i} variant={days.includes(i) ? 'default' : 'outline'} size="sm" onClick={() => toggleDay(i)}>{name}</Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!channelId || create.isPending} className="w-full">Opret</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Timer className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Ingen slowmode-regler endnu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map((s: any) => (
            <Card key={s.id} className={!s.enabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    #{s.channel_name || s.channel_id}
                  </CardTitle>
                  <Switch checked={s.enabled} onCheckedChange={(enabled) => toggle.mutate({ id: s.id, enabled })} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{s.start_hour}:00 - {s.end_hour}:00</Badge>
                  <Badge variant="outline">{s.slowmode_seconds}s slowmode</Badge>
                </div>
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, i) => (
                    <Badge key={i} variant={(s.days_of_week || []).includes(i) ? 'default' : 'outline'} className="text-[10px]">{name}</Badge>
                  ))}
                </div>
                <Button variant="destructive" size="sm" onClick={() => remove.mutate(s.id)} className="gap-1 mt-2">
                  <Trash2 className="h-3 w-3" /> Slet
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
