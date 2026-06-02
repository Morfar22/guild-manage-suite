import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2, Save, Zap, UserX, UserCheck } from 'lucide-react';
import { useQuarantine } from '@/hooks/useQuarantine';
import { ChannelSelect } from '@/components/ui/channel-select';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export default function QuarantineSystem() {
  const { settings, entries, isLoading, upsertSettings, releaseUser } = useQuarantine();

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [quarantineRoleId, setQuarantineRoleId] = useState(settings?.quarantine_role_id ?? '');
  const [logChannelId, setLogChannelId] = useState(settings?.log_channel_id ?? '');
  const [autoDays, setAutoDays] = useState(settings?.auto_quarantine_days ?? 7);
  const [requireVerification, setRequireVerification] = useState(settings?.require_verification ?? true);

  const [init, setInit] = useState(false);
  if (settings && !init) {
    setEnabled(settings.enabled);
    setQuarantineRoleId(settings.quarantine_role_id ?? '');
    setLogChannelId(settings.log_channel_id ?? '');
    setAutoDays(settings.auto_quarantine_days);
    setRequireVerification(settings.require_verification);
    setInit(true);
  }

  const handleSave = () => {
    upsertSettings.mutate({
      enabled,
      quarantine_role_id: quarantineRoleId || null,
      log_channel_id: logChannelId || null,
      auto_quarantine_days: autoDays,
      require_verification: requireVerification,
    });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const activeEntries = entries.filter((e: any) => !e.released_at);
  const releasedEntries = entries.filter((e: any) => e.released_at);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Karantæne System
          </h1>
          <p className="text-muted-foreground mt-1">Isoler mistænkelige brugere i en begrænset rolle</p>
        </div>
        <Button onClick={handleSave} disabled={upsertSettings.isPending} className="gap-2">
          {upsertSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
              <h3 className="font-semibold">Aktiver Karantæne</h3>
              <p className="text-sm text-muted-foreground">Nye konti under X dage får automatisk karantæne-rolle</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indstillinger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Karantæne rolle ID</Label>
              <Input value={quarantineRoleId} onChange={(e) => setQuarantineRoleId(e.target.value)} placeholder="Rolle ID" />
              <p className="text-xs text-muted-foreground">Opret en rolle med begrænsede rettigheder og indsæt ID'et her</p>
            </div>
            <div className="space-y-2">
              <Label>Log-kanal</Label>
              <ChannelSelect value={logChannelId} onValueChange={setLogChannelId} placeholder="Vælg log-kanal" />
            </div>
            <div className="space-y-2">
              <Label>Auto-karantæne (kontoadler under X dage)</Label>
              <Input type="number" value={autoDays} onChange={(e) => setAutoDays(parseInt(e.target.value) || 7)} min={1} max={365} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Kræv verifikation for frigivelse</Label>
                <p className="text-xs text-muted-foreground">Brugere skal verificere sig før de frigives</p>
              </div>
              <Switch checked={requireVerification} onCheckedChange={setRequireVerification} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              I karantæne ({activeEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Ingen brugere i karantæne</p>
            ) : (
              <div className="space-y-2">
                {activeEntries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{entry.user_name || entry.user_id}</p>
                      <p className="text-xs text-muted-foreground">{entry.reason || 'Ny konto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.quarantined_at), { addSuffix: true, locale: da })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => releaseUser.mutate({ id: entry.id, releasedBy: 'dashboard' })} className="gap-1">
                      <UserCheck className="h-3 w-3" /> Frigiv
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {releasedEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              Frigivne ({releasedEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {releasedEntries.slice(0, 10).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border p-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium">{entry.user_name || entry.user_id}</p>
                    <p className="text-xs text-muted-foreground">Frigivet af {entry.released_by}</p>
                  </div>
                  <Badge variant="secondary">Frigivet</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
