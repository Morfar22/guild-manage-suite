import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Music } from 'lucide-react';
import { useMusicQuiz } from '@/hooks/useMusicQuiz';
import { ChannelSelect } from '@/components/ui/channel-select';

const MusicQuizSettings = () => {
  const { settings, isLoading, upsertSettings } = useMusicQuiz();
  const [channelId, setChannelId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [rounds, setRounds] = useState(10);
  const [timePerRound, setTimePerRound] = useState(30);

  useEffect(() => {
    if (settings) {
      setChannelId(settings.channel_id || '');
      setEnabled(settings.enabled || false);
      setRounds(settings.rounds || 10);
      setTimePerRound(settings.time_per_round || 30);
    }
  }, [settings]);

  const handleSave = () => {
    upsertSettings.mutate({ channel_id: channelId || null, enabled, rounds, time_per_round: timePerRound });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">🎵 Musik Quiz</h1>
        <p className="text-muted-foreground mt-1">Konfigurer musik quiz-spillet</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Music className="h-5 w-5" /> Indstillinger</CardTitle>
          <CardDescription>Indstillinger for musik quiz-spillet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Aktiveret</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label>Quiz-kanal</Label>
            <ChannelSelect value={channelId} onValueChange={setChannelId} />
          </div>
          <div className="space-y-2">
            <Label>Antal runder</Label>
            <Input type="number" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} min={1} max={50} />
          </div>
          <div className="space-y-2">
            <Label>Tid per runde (sekunder)</Label>
            <Input type="number" value={timePerRound} onChange={(e) => setTimePerRound(Number(e.target.value))} min={10} max={120} />
          </div>
          <Button onClick={handleSave} disabled={upsertSettings.isPending}>{upsertSettings.isPending ? 'Gemmer...' : 'Gem Indstillinger'}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MusicQuizSettings;
