import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileBarChart, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function AutoReports() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['auto-report-settings', selectedGuild?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_report_settings' as any)
        .select('*')
        .eq('guild_id', selectedGuild!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedGuild?.id,
  });

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [channelId, setChannelId] = useState(settings?.channel_id ?? '');
  const [frequency, setFrequency] = useState(settings?.frequency ?? 'weekly');

  const currentEnabled = settings?.enabled ?? false;
  const currentChannelId = settings?.channel_id ?? '';
  const currentFrequency = settings?.frequency ?? 'weekly';

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('auto_report_settings' as any)
        .upsert({
          guild_id: selectedGuild!.id,
          enabled,
          channel_id: channelId || null,
          frequency,
        }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-report-settings'] });
      toast.success('Indstillinger gemt!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileBarChart className="h-8 w-8" /> Auto-Rapporter
        </h1>
        <p className="text-muted-foreground">Send automatiske statistik-rapporter til en Discord-kanal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rapport-indstillinger</CardTitle>
          <CardDescription>Konfigurer automatiske statistik-rapporter til Discord</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Aktiver auto-rapporter</Label>
              <p className="text-sm text-muted-foreground">Botten sender automatisk en statistik-rapport</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label>Discord Kanal ID</Label>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Indsæt kanal-ID hvor rapporten skal sendes"
            />
          </div>

          <div>
            <Label>Frekvens</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Dagligt</SelectItem>
                <SelectItem value="weekly">Ugentligt</SelectItem>
                <SelectItem value="monthly">Månedligt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            <Send className="h-4 w-4 mr-2" /> Gem indstillinger
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hvad indeholder rapporten?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>📊 Total beskeder, commands og XP i perioden</li>
            <li>👥 Nye medlemmer vs. medlemmer der forlod</li>
            <li>🛡️ Antal moderationshandlinger</li>
            <li>🏆 Top 5 mest aktive brugere</li>
            <li>📈 Sammenligning med forrige periode</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
