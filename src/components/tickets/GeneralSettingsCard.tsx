import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useTicketSettings, useUpsertTicketSettings } from '@/hooks/useTicketSettings';
import { useToast } from '@/hooks/use-toast';
import { Settings2, Star, FileText } from 'lucide-react';

export default function GeneralSettingsCard() {
  const { data: settings } = useTicketSettings();
  const upsert = useUpsertTicketSettings();
  const { toast } = useToast();

  const [threadCategoryId, setThreadCategoryId] = useState('');
  const [transcriptChannelId, setTranscriptChannelId] = useState('');
  const [enableRatings, setEnableRatings] = useState(false);
  const [enableTranscripts, setEnableTranscripts] = useState(true);
  const [dmTranscript, setDmTranscript] = useState(true);
  const [ratingsPrompt, setRatingsPrompt] = useState('');

  useEffect(() => {
    if (!settings) return;
    setThreadCategoryId(settings.thread_category_id || '');
    setTranscriptChannelId(settings.transcript_channel_id || '');
    setEnableRatings(!!settings.enable_ratings);
    setEnableTranscripts(settings.enable_transcripts !== false);
    setDmTranscript(settings.dm_transcript_to_user !== false);
    setRatingsPrompt(settings.ratings_dm_prompt || '');
  }, [settings]);

  const save = async () => {
    try {
      await upsert.mutateAsync({
        thread_category_id: threadCategoryId || null,
        transcript_channel_id: transcriptChannelId || null,
        enable_ratings: enableRatings,
        enable_transcripts: enableTranscripts,
        dm_transcript_to_user: dmTranscript,
        ratings_dm_prompt: ratingsPrompt || null,
      });
      toast({ title: 'Saved' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> General settings</CardTitle>
        <CardDescription>Server-wide ticket behaviour</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Ticket parent channel</Label>
            <ChannelSelect value={threadCategoryId} onValueChange={setThreadCategoryId} placeholder="Text channel for private ticket threads" />
            <p className="text-xs text-muted-foreground">Private ticket threads are created inside this Discord text channel.</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Transcript log channel</Label>
            <ChannelSelect value={transcriptChannelId} onValueChange={setTranscriptChannelId} placeholder="Optional" />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Transcripts</div>
          <ToggleRow label="Generate HTML transcripts on close" checked={enableTranscripts} onChange={setEnableTranscripts} />
          <ToggleRow label="DM transcript link to ticket creator" checked={dmTranscript} onChange={setDmTranscript} disabled={!enableTranscripts} />
        </div>

        <div className="space-y-4 rounded-lg border border-border/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Star className="h-4 w-4" /> Post-ticket ratings</div>
          <ToggleRow label="Ask user to rate 1–5 stars after close" checked={enableRatings} onChange={setEnableRatings} />
          {enableRatings && (
            <div className="space-y-2">
              <Label className="text-xs">Rating DM prompt</Label>
              <Textarea value={ratingsPrompt} onChange={(e) => setRatingsPrompt(e.target.value)} rows={2} placeholder="How would you rate the support you received?" />
            </div>
          )}
        </div>

        <div>
          <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? 'Saving…' : 'Save settings'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <Label className={disabled ? 'text-muted-foreground' : ''}>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
