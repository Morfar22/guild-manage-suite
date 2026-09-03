import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Zap, Trash2, Globe, AlertTriangle, ShieldOff } from 'lucide-react';
import { useHoneypot, type HoneypotSettings } from '@/hooks/useHoneypot';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { ChannelSelect } from '@/components/ui/channel-select';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

const DEFAULT_WARNING =
  '⚠️ Skriv IKKE i denne kanal. Enhver besked her medfører automatisk udsmidning og rapportering til det globale ban-system. Kanalen bruges til at fange hackede konti og spam-bots.';

export default function Honeypot() {
  const { settings, catches, isLoading, upsertSettings, deleteCatch } = useHoneypot();
  const { data: roles = [] } = useDiscordRoles();

  const [form, setForm] = useState<HoneypotSettings>({
    enabled: false,
    channel_id: null,
    warning_message: DEFAULT_WARNING,
    action: 'kick',
    delete_message: true,
    report_global_ban: true,
    report_severity: 'scam',
    log_channel_id: null,
    ignore_roles: [],
  });
  const [init, setInit] = useState(false);
  if (settings && !init) {
    setForm({
      enabled: settings.enabled,
      channel_id: settings.channel_id,
      warning_message: settings.warning_message ?? DEFAULT_WARNING,
      action: (settings.action as HoneypotSettings['action']) ?? 'kick',
      delete_message: settings.delete_message,
      report_global_ban: settings.report_global_ban,
      report_severity: settings.report_severity ?? 'scam',
      log_channel_id: settings.log_channel_id,
      ignore_roles: settings.ignore_roles ?? [],
    });
    setInit(true);
  }

  const set = <K extends keyof HoneypotSettings>(k: K, v: HoneypotSettings[K]) => setForm(f => ({ ...f, [k]: v }));

  const toggleRole = (id: string) =>
    set('ignore_roles', form.ignore_roles.includes(id) ? form.ignore_roles.filter(r => r !== id) : [...form.ignore_roles, id]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const actionLabel = (a: string) => a === 'ban' ? 'Ban' : a === 'kick' ? 'Kick' : 'Kun logget';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-3xl" aria-hidden>🍯</span>
            Honeypot
          </h1>
          <p className="text-muted-foreground mt-1">Fang hackede konti og spam-bots med en lokkekanal</p>
        </div>
        <Button onClick={() => upsertSettings.mutate(form)} disabled={upsertSettings.isPending} className="gap-2">
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
              <h3 className="font-semibold">Aktiver Honeypot</h3>
              <p className="text-sm text-muted-foreground">Alle der skriver i honeypot-kanalen bliver automatisk håndteret</p>
            </div>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => set('enabled', v)} />
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex gap-3 pt-6 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Sådan sætter du det op</p>
            <p className="text-muted-foreground">
              Opret en tekstkanal (fx <code>#verify-here</code> eller <code>#free-nitro</code>) som alle kan se og skrive i, men som ingen rigtige medlemmer har grund til at bruge.
              Botten poster selv advarselsbeskeden i kanalen når du gemmer. Serverejer, administratorer og undtagne roller bliver aldrig ramt.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kanal & besked</CardTitle>
            <CardDescription>Hvilken kanal er fælden, og hvad står der i den</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Honeypot-kanal</Label>
              <ChannelSelect value={form.channel_id} onValueChange={v => set('channel_id', v)} placeholder="Vælg kanal" />
            </div>
            <div className="space-y-2">
              <Label>Advarselsbesked (postes af botten)</Label>
              <Textarea rows={4} value={form.warning_message ?? ''} onChange={e => set('warning_message', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Log-kanal (valgfri)</Label>
              <ChannelSelect value={form.log_channel_id} onValueChange={v => set('log_channel_id', v)} placeholder="Vælg log-kanal" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handling</CardTitle>
            <CardDescription>Hvad sker der når nogen går i fælden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Straf</Label>
              <Select value={form.action} onValueChange={v => set('action', v as HoneypotSettings['action'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kick">Kick fra serveren</SelectItem>
                  <SelectItem value="ban">Ban fra serveren</SelectItem>
                  <SelectItem value="none">Ingen (kun log + rapport)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Slet beskeden</p>
                <p className="text-xs text-muted-foreground">Fjern spam-beskeden med det samme</p>
              </div>
              <Switch checked={form.delete_message} onCheckedChange={v => set('delete_message', v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-sm">Rapportér til Global Ban</p>
                  <p className="text-xs text-muted-foreground">Opretter automatisk en rapport til review</p>
                </div>
              </div>
              <Switch checked={form.report_global_ban} onCheckedChange={v => set('report_global_ban', v)} />
            </div>
            {form.report_global_ban && (
              <div className="space-y-2">
                <Label>Alvorlighed på rapport</Label>
                <Select value={form.report_severity} onValueChange={v => set('report_severity', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scam">Scam / phishing</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="raid">Raid</SelectItem>
                    <SelectItem value="other">Andet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><ShieldOff className="h-4 w-4" /> Undtagne roller</Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border p-2">
                {roles.filter((r: any) => r.name !== '@everyone').map((r: any) => (
                  <Badge
                    key={r.id}
                    variant={form.ignore_roles.includes(r.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRole(r.id)}
                  >
                    {r.name}
                  </Badge>
                ))}
                {roles.length === 0 && <p className="text-xs text-muted-foreground">Ingen roller fundet</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fangster ({catches.length})</CardTitle>
          <CardDescription>Brugere der er gået i fælden</CardDescription>
        </CardHeader>
        <CardContent>
          {catches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen fangster endnu 🎣</p>
          ) : (
            <div className="space-y-2">
              {catches.map((c: any) => (
                <div key={c.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.user_name || c.user_id}</span>
                      <Badge variant={c.action_taken === 'ban' ? 'destructive' : 'secondary'}>{actionLabel(c.action_taken)}</Badge>
                      {c.global_ban_report_id && <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Global rapport</Badge>}
                      {c.error_message && <Badge variant="destructive" title={c.error_message}>Fejl</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{c.message_content}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.user_id} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: da })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteCatch.mutate(c.id)} aria-label="Slet">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
