import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Loader2, Save, Zap, Clock, Users } from 'lucide-react';
import { useRaidProtection } from '@/hooks/useRaidProtection';
import { ChannelSelect } from '@/components/ui/channel-select';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export default function RaidProtection() {
  const { settings, logs, isLoading, upsert } = useRaidProtection();

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [joinThreshold, setJoinThreshold] = useState(settings?.join_threshold ?? 10);
  const [timeWindow, setTimeWindow] = useState(settings?.time_window_seconds ?? 30);
  const [lockdownDuration, setLockdownDuration] = useState(settings?.lockdown_duration_minutes ?? 10);
  const [action, setAction] = useState(settings?.action ?? 'lockdown');
  const [logChannelId, setLogChannelId] = useState(settings?.log_channel_id ?? '');
  const [notifyStaff, setNotifyStaff] = useState(settings?.notify_staff ?? true);

  const [init, setInit] = useState(false);
  if (settings && !init) {
    setEnabled(settings.enabled);
    setJoinThreshold(settings.join_threshold);
    setTimeWindow(settings.time_window_seconds);
    setLockdownDuration(settings.lockdown_duration_minutes);
    setAction(settings.action);
    setLogChannelId(settings.log_channel_id ?? '');
    setNotifyStaff(settings.notify_staff);
    setInit(true);
  }

  const handleSave = () => {
    upsert.mutate({
      enabled,
      join_threshold: joinThreshold,
      time_window_seconds: timeWindow,
      lockdown_duration_minutes: lockdownDuration,
      action,
      log_channel_id: logChannelId || null,
      notify_staff: notifyStaff,
    });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Raid Protection
          </h1>
          <p className="text-muted-foreground mt-1">Auto-lockdown ved mass-joins for at beskytte din server</p>
        </div>
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Gem
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Aktiver Raid Protection</h3>
              <p className="text-sm text-muted-foreground">Overvåg join-rate og reager automatisk</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detektering</CardTitle>
            <CardDescription>Hvornår skal raid-protection aktiveres?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Join-threshold (antal)</Label>
              <Input type="number" value={joinThreshold} onChange={(e) => setJoinThreshold(parseInt(e.target.value) || 10)} min={3} max={100} />
              <p className="text-xs text-muted-foreground">Antal joins inden for tidsvinduet der trigger beskyttelse</p>
            </div>
            <div className="space-y-2">
              <Label>Tidsvindue (sekunder)</Label>
              <Input type="number" value={timeWindow} onChange={(e) => setTimeWindow(parseInt(e.target.value) || 30)} min={5} max={300} />
              <p className="text-xs text-muted-foreground">Tidsperioden hvori joins tælles</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handling & Notifikation</CardTitle>
            <CardDescription>Hvad sker der ved en detekteret raid?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Handling</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lockdown">Lockdown (luk invites)</SelectItem>
                  <SelectItem value="kick">Kick nye medlemmer</SelectItem>
                  <SelectItem value="ban">Ban nye medlemmer</SelectItem>
                  <SelectItem value="quarantine">Karantæne (tildel rolle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lockdown varighed (minutter)</Label>
              <Input type="number" value={lockdownDuration} onChange={(e) => setLockdownDuration(parseInt(e.target.value) || 10)} min={1} max={1440} />
            </div>
            <div className="space-y-2">
              <Label>Log-kanal</Label>
              <ChannelSelect value={logChannelId} onValueChange={setLogChannelId} placeholder="Vælg log-kanal" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Notificer staff</Label>
              <Switch checked={notifyStaff} onCheckedChange={setNotifyStaff} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raid logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Raid Log</CardTitle>
          <CardDescription>Seneste detekterede raids</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Ingen raids detekteret endnu</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">{log.join_count} joins – {log.action_taken}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: da })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={log.ended_at ? 'secondary' : 'destructive'}>
                    {log.ended_at ? 'Afsluttet' : 'Aktiv'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
