import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { Label } from '@/components/ui/label';
import { Hash, Trophy } from 'lucide-react';
import { useCountingChannel } from '@/hooks/useCountingChannel';

import { ChannelSelect } from '@/components/ui/channel-select';

const CountingChannel = () => {
  const { settings, isLoading, upsertSettings } = useCountingChannel();
  
  const [channelId, setChannelId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [allowSameUser, setAllowSameUser] = useState(false);

  useEffect(() => {
    if (settings) {
      setChannelId(settings.channel_id || '');
      setEnabled(settings.enabled || false);
      setAllowSameUser(settings.allow_same_user || false);
    }
  }, [settings]);

  const handleSave = () => {
    upsertSettings.mutate({ channel_id: channelId || null, enabled, allow_same_user: allowSameUser });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">🔢 Tællekanal</h1>
        <p className="text-muted-foreground mt-1">Konfigurer en kanal hvor brugere tæller op sammen</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Hash className="h-5 w-5" /> Indstillinger</CardTitle>
          <CardDescription>Vælg kanal og regler for tællelegen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Aktiveret</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label>Tællekanal</Label>
            <ChannelSelect value={channelId} onValueChange={setChannelId} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Tillad samme bruger</Label>
              <p className="text-sm text-muted-foreground">Tillad at samme bruger tæller to gange i træk</p>
            </div>
            <Switch checked={allowSameUser} onCheckedChange={setAllowSameUser} />
          </div>
          <Button onClick={handleSave} disabled={upsertSettings.isPending}>{upsertSettings.isPending ? 'Gemmer...' : 'Gem Indstillinger'}</Button>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Statistik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-primary">{settings.current_count}</p>
                <p className="text-sm text-muted-foreground">Nuværende tæller</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-primary">{settings.high_score}</p>
                <p className="text-sm text-muted-foreground">Højeste score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CountingChannel;
