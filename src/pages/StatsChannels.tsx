import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useStatsChannels } from '@/hooks/useStatsChannels';
import { ChannelSelect } from '@/components/ui/channel-select';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

const STAT_TYPES = [
  { value: 'members', label: 'Medlemmer', defaultTemplate: '👥 Members: {count}' },
  { value: 'online', label: 'Online', defaultTemplate: '🟢 Online: {count}' },
  { value: 'boosts', label: 'Boosts', defaultTemplate: '💎 Boosts: {count}' },
  { value: 'roles', label: 'Roller', defaultTemplate: '🏷️ Roles: {count}' },
  { value: 'bots', label: 'Bots', defaultTemplate: '🤖 Bots: {count}' },
  { value: 'channels', label: 'Kanaler', defaultTemplate: '📺 Channels: {count}' },
];

export default function StatsChannels() {
  const { channels, isLoading, addChannel, updateChannel, deleteChannel } = useStatsChannels();
  const { selectedGuild } = useGuild();
  const [newType, setNewType] = useState('members');
  const [newTemplate, setNewTemplate] = useState('👥 Members: {count}');
  const [newChannelId, setNewChannelId] = useState<string>('');
  const [isForcing, setIsForcing] = useState(false);

  const handleForceUpdate = async () => {
    if (!selectedGuild?.id) return;
    setIsForcing(true);
    try {
      const { error } = await supabase.from('stats_force_update' as any).insert({
        guild_id: selectedGuild.id,
      } as any);
      if (error) throw error;
      toast.success('Force update sendt til botten!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsForcing(false);
    }
  };

  const handleAdd = () => {
    if (!newChannelId) {
      return;
    }
    addChannel.mutate({ stat_type: newType, format_template: newTemplate, channel_id: newChannelId });
    setNewType('members');
    setNewTemplate('👥 Members: {count}');
    setNewChannelId('');
  };

  const handleTypeChange = (type: string) => {
    setNewType(type);
    const found = STAT_TYPES.find(t => t.value === type);
    if (found) setNewTemplate(found.defaultTemplate);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-8 w-8" /> Stats Channels</h1>
          <p className="text-muted-foreground">Auto-opdaterende voice-kanaler med server-statistik. Vælg en eksisterende voice-kanal, hvis navn botten skal opdatere.</p>
        </div>
        <Button onClick={handleForceUpdate} disabled={isForcing || channels.length === 0} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-1 ${isForcing ? 'animate-spin' : ''}`} /> Force Update
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tilføj Stat-kanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={newType} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Voice-kanal</Label>
              <ChannelSelect
                value={newChannelId || undefined}
                onValueChange={setNewChannelId}
                placeholder="Vælg voice-kanal"
              />
            </div>
            <div>
              <Label>Format (brug {'{count}'} som placeholder)</Label>
              <Input value={newTemplate} onChange={e => setNewTemplate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Preview: <span className="font-medium text-foreground">{newTemplate.replace('{count}', '1,234')}</span>
            </div>
            <Button onClick={handleAdd} disabled={addChannel.isPending || !newChannelId}>
              <Plus className="h-4 w-4 mr-1" /> Tilføj
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aktive Stat-kanaler ({channels.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen stat-kanaler konfigureret</p>
          ) : (
            channels.map(ch => (
              <div key={ch.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{STAT_TYPES.find(t => t.value === ch.stat_type)?.label || ch.stat_type}</Badge>
                  <span className="text-sm font-medium">{ch.format_template.replace('{count}', '1,234')}</span>
                  {!ch.channel_id && (
                    <Badge variant="destructive" className="text-xs">Ingen kanal valgt</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ch.enabled}
                    onCheckedChange={v => updateChannel.mutate({ id: ch.id, enabled: v })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => deleteChannel.mutate(ch.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
