import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { useConfessions } from '@/hooks/useConfessions';
import { ChannelSelect } from '@/components/ui/channel-select';

const ConfessionSystem = () => {
  const { settings, confessions, isLoading, upsertSettings } = useConfessions();
  const [channelId, setChannelId] = useState('');
  const [approvalChannelId, setApprovalChannelId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);

  useEffect(() => {
    if (settings) {
      setChannelId(settings.channel_id || '');
      setApprovalChannelId(settings.approval_channel_id || '');
      setEnabled(settings.enabled || false);
      setRequireApproval(settings.require_approval || false);
    }
  }, [settings]);

  const handleSave = () => {
    upsertSettings.mutate({
      channel_id: channelId || null,
      approval_channel_id: approvalChannelId || null,
      enabled,
      require_approval: requireApproval,
    });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">🤫 Bekendelser</h1>
        <p className="text-muted-foreground mt-1">Anonymt bekendelsessystem via /confess kommando</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Indstillinger</CardTitle>
          <CardDescription>Konfigurer bekendelsessystemet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Aktiveret</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label>Bekendelseskanal</Label>
            <ChannelSelect value={channelId} onValueChange={setChannelId} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Kræv godkendelse</Label>
              <p className="text-sm text-muted-foreground">Bekendelser skal godkendes før de postes</p>
            </div>
            <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
          </div>
          {requireApproval && (
            <div className="space-y-2">
              <Label>Godkendelseskanal</Label>
              <ChannelSelect value={approvalChannelId} onValueChange={setApprovalChannelId} />
            </div>
          )}
          <Button onClick={handleSave} disabled={upsertSettings.isPending}>{upsertSettings.isPending ? 'Gemmer...' : 'Gem Indstillinger'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seneste bekendelser</CardTitle>
          <CardDescription>{confessions.length} bekendelser</CardDescription>
        </CardHeader>
        <CardContent>
          {confessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Ingen bekendelser endnu</p>
          ) : (
            <div className="space-y-3">
              {confessions.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">#{c.confession_number}</span>
                    <Badge variant={c.status === 'posted' ? 'default' : 'secondary'}>{c.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfessionSystem;
