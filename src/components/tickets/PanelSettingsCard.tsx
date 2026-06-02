import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useTicketSettings, useUpsertTicketSettings, useSendTicketPanel } from '@/hooks/useTicketSettings';
import { useToast } from '@/hooks/use-toast';
import { Send, Settings2, CheckCircle2, FileText } from 'lucide-react';

export default function PanelSettingsCard() {
  const { data: settings, isLoading } = useTicketSettings();
  const upsertSettings = useUpsertTicketSettings();
  const sendPanel = useSendTicketPanel();
  const { toast } = useToast();

  const [panelChannelId, setPanelChannelId] = useState('');
  const [threadCategoryId, setThreadCategoryId] = useState('');
  const [transcriptChannelId, setTranscriptChannelId] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setPanelChannelId(settings.panel_channel_id || '');
      setThreadCategoryId(settings.thread_category_id || '');
      setTranscriptChannelId(settings.transcript_channel_id || '');
    }
  }, [settings]);

  useEffect(() => {
    const originalPanel = settings?.panel_channel_id || '';
    const originalThread = settings?.thread_category_id || '';
    const originalTranscript = settings?.transcript_channel_id || '';
    setHasChanges(
      panelChannelId !== originalPanel || 
      threadCategoryId !== originalThread ||
      transcriptChannelId !== originalTranscript
    );
  }, [panelChannelId, threadCategoryId, transcriptChannelId, settings]);

  const handleSave = async () => {
    try {
      await upsertSettings.mutateAsync({
        panel_channel_id: panelChannelId || null,
        thread_category_id: threadCategoryId || null,
        transcript_channel_id: transcriptChannelId || null,
      });
      toast({ title: 'Settings saved', description: 'Panel configuration has been updated' });
    } catch {
      toast({ title: 'Error', description: 'Could not save settings', variant: 'destructive' });
    }
  };

  const handleSendPanel = async () => {
    if (!panelChannelId) {
      toast({ title: 'Missing channel', description: 'Please select a panel channel first', variant: 'destructive' });
      return;
    }

    try {
      await sendPanel.mutateAsync();
      toast({ title: 'Panel sent', description: 'The ticket panel has been sent to the channel' });
    } catch {
      toast({ title: 'Error', description: 'Could not send panel. Check if the bot is online.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Panel Configuration
        </CardTitle>
        <CardDescription>
          Set up where the ticket panel is sent and where threads are created
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Panel Channel
            </Label>
            <ChannelSelect
              value={panelChannelId}
              onValueChange={setPanelChannelId}
              placeholder="Select panel channel"
            />
            <p className="text-xs text-muted-foreground">
              The channel where the ticket panel is displayed
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Thread Category
            </Label>
            <ChannelSelect
              value={threadCategoryId}
              onValueChange={setThreadCategoryId}
              placeholder="Select category"
              includeCategories={true}
            />
            <p className="text-xs text-muted-foreground">
              The Discord category where ticket threads are created
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Transcript Log Channel
          </Label>
          <ChannelSelect
            value={transcriptChannelId}
            onValueChange={setTranscriptChannelId}
            placeholder="Select transcript channel (optional)"
          />
          <p className="text-xs text-muted-foreground">
            The channel where ticket transcripts are sent when tickets are closed
          </p>
        </div>

        {settings?.panel_message_id && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Panel is active (message ID: {settings.panel_message_id})
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || upsertSettings.isPending}
            variant={hasChanges ? 'default' : 'secondary'}
          >
            {upsertSettings.isPending ? 'Saving...' : 'Save Settings'}
          </Button>

          <Button
            onClick={handleSendPanel}
            disabled={!panelChannelId || sendPanel.isPending}
            variant="outline"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sendPanel.isPending ? 'Sending...' : settings?.panel_message_id ? 'Update Panel' : 'Send Panel'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
