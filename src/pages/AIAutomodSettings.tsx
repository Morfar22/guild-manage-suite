import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Brain, Shield, Loader2, Save, Zap, AlertTriangle, MessageSquare, Eye } from 'lucide-react';
import { useAIAutomodSettings } from '@/hooks/useAIAutomod';
import { ChannelSelect } from '@/components/ui/channel-select';

export default function AIAutomodSettings() {
  const { settings, isLoading, upsert } = useAIAutomodSettings();

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [sensitivity, setSensitivity] = useState(settings?.sensitivity ?? 70);
  const [checkToxicity, setCheckToxicity] = useState(settings?.check_toxicity ?? true);
  const [checkSpam, setCheckSpam] = useState(settings?.check_spam ?? true);
  const [checkNsfw, setCheckNsfw] = useState(settings?.check_nsfw ?? true);
  const [checkHateSpeech, setCheckHateSpeech] = useState(settings?.check_hate_speech ?? true);
  const [customInstructions, setCustomInstructions] = useState(settings?.custom_instructions ?? '');
  const [logChannelId, setLogChannelId] = useState(settings?.log_channel_id ?? '');
  const [action, setAction] = useState(settings?.action ?? 'delete');
  const [notifyModerators, setNotifyModerators] = useState(settings?.notify_moderators ?? true);

  // Sync state when data loads
  const [initialized, setInitialized] = useState(false);
  if (settings && !initialized) {
    setEnabled(settings.enabled);
    setSensitivity(settings.sensitivity);
    setCheckToxicity(settings.check_toxicity);
    setCheckSpam(settings.check_spam);
    setCheckNsfw(settings.check_nsfw);
    setCheckHateSpeech(settings.check_hate_speech);
    setCustomInstructions(settings.custom_instructions ?? '');
    setLogChannelId(settings.log_channel_id ?? '');
    setAction(settings.action);
    setNotifyModerators(settings.notify_moderators);
    setInitialized(true);
  }

  const handleSave = () => {
    upsert.mutate({
      enabled,
      sensitivity,
      check_toxicity: checkToxicity,
      check_spam: checkSpam,
      check_nsfw: checkNsfw,
      check_hate_speech: checkHateSpeech,
      custom_instructions: customInstructions || null,
      log_channel_id: logChannelId || null,
      action,
      notify_moderators: notifyModerators,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            AI Auto-Moderation
          </h1>
          <p className="text-muted-foreground mt-1">
            Brug AI til at analysere beskeder for toxicity, spam, NSFW og hate speech
          </p>
        </div>
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Gem indstillinger
        </Button>
      </div>

      {/* Master toggle */}
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Aktiver AI Auto-Mod</h3>
              <p className="text-sm text-muted-foreground">Alle beskeder analyseres af AI i realtid</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Detection Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Detekterings-kategorier
            </CardTitle>
            <CardDescription>Vælg hvilke typer indhold AI skal scanne for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'toxicity', label: 'Toxicity', desc: 'Giftige, fjendtlige eller aggressive beskeder', icon: AlertTriangle, state: checkToxicity, set: setCheckToxicity },
              { key: 'spam', label: 'Spam', desc: 'Spam-lignende indhold og promotions', icon: MessageSquare, state: checkSpam, set: setCheckSpam },
              { key: 'nsfw', label: 'NSFW', desc: 'Seksuelt eller upassende indhold', icon: Eye, state: checkNsfw, set: setCheckNsfw },
              { key: 'hate', label: 'Hate Speech', desc: 'Hadefuld tale og diskrimination', icon: Shield, state: checkHateSpeech, set: setCheckHateSpeech },
            ].map(({ key, label, desc, icon: Icon, state, set }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch checked={state} onCheckedChange={set} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sensitivity & Action */}
        <Card>
          <CardHeader>
            <CardTitle>Følsomhed & Handling</CardTitle>
            <CardDescription>Konfigurer hvor strengt AI skal moderere</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Følsomhed</Label>
                <Badge variant={sensitivity > 80 ? 'destructive' : sensitivity > 50 ? 'default' : 'secondary'}>
                  {sensitivity}%
                </Badge>
              </div>
              <Slider
                value={[sensitivity]}
                onValueChange={([v]) => setSensitivity(v)}
                min={10}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                {sensitivity > 80 ? 'Streng – flager de fleste mistænkelige beskeder' :
                 sensitivity > 50 ? 'Balanceret – flager tydeligt problematisk indhold' :
                 'Mild – kun de mest åbenlyse overtrædelser'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Handling ved overtrædelse</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delete">Slet besked</SelectItem>
                  <SelectItem value="warn">Advarsel</SelectItem>
                  <SelectItem value="mute">Mute bruger</SelectItem>
                  <SelectItem value="kick">Kick bruger</SelectItem>
                  <SelectItem value="ban">Ban bruger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Log-kanal</Label>
              <ChannelSelect
                value={logChannelId}
                onValueChange={setLogChannelId}
                placeholder="Vælg log-kanal"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notificer moderatorer</Label>
                <p className="text-xs text-muted-foreground">Send en besked til moderatorer ved AI-flag</p>
              </div>
              <Switch checked={notifyModerators} onCheckedChange={setNotifyModerators} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Custom AI Instruktioner
          </CardTitle>
          <CardDescription>
            Tilføj ekstra kontekst til AI'en, f.eks. "Tillad gaming-relaterede bandeord" eller "Vær ekstra streng med reklamer"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="F.eks.: Denne server er en gaming-community. Tillad mild brug af bandeord i gaming-kontekst. Vær streng med reklamer og self-promotion."
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}
