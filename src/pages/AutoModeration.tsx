import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useAutomodRules, useAutomodLogs, RULE_TYPE_INFO, AutomodRuleType, AutomodAction } from '@/hooks/useAutoMod';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Settings, History, AlertTriangle, Link, MessageSquare, AtSign, Type, Send, Brain } from 'lucide-react';
import { AutomodBypassRolesCard } from '@/components/automod/AutomodBypassRolesCard';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

const RULE_ICONS: Record<AutomodRuleType, React.ReactNode> = {
  spam: <MessageSquare className="h-5 w-5" />,
  links: <Link className="h-5 w-5" />,
  words: <AlertTriangle className="h-5 w-5" />,
  mentions: <AtSign className="h-5 w-5" />,
  caps: <Type className="h-5 w-5" />,
  invites: <Send className="h-5 w-5" />,
  ai_toxicity: <Brain className="h-5 w-5" />,
};

const ACTION_LABELS: Record<AutomodAction, string> = {
  warn: 'Advarsel',
  mute: 'Mute',
  kick: 'Kick',
  ban: 'Ban',
  delete: 'Slet besked',
};

export default function AutoModeration() {
  const { selectedGuild } = useGuild();
  const { data: rules, isLoading, upsertRule } = useAutomodRules();
  const { data: logs, isLoading: logsLoading } = useAutomodLogs();
  const { data: discordRoles } = useDiscordRoles();

  const [selectedRule, setSelectedRule] = useState<AutomodRuleType | null>(null);
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>({});
  const [editingAction, setEditingAction] = useState<AutomodAction>('warn');
  const [editingDuration, setEditingDuration] = useState<string>('');
  const [testMessage, setTestMessage] = useState('');
  const [testResults, setTestResults] = useState<Array<{ type: AutomodRuleType; matched: boolean; note: string }>>([]);

  const getRule = (type: AutomodRuleType) => rules?.find(r => r.rule_type === type);

  const handleToggleRule = (type: AutomodRuleType, enabled: boolean) => {
    upsertRule.mutate({ rule_type: type, enabled });
  };

  const handleSelectRule = (type: AutomodRuleType) => {
    const existing = getRule(type);
    setSelectedRule(type);
    setEditingConfig(existing?.config || RULE_TYPE_INFO[type].defaultConfig);
    setEditingAction(existing?.action || 'warn');
    setEditingDuration(existing?.action_duration_seconds?.toString() || '');
  };

  const testRules = () => {
    const message = testMessage;
    const lower = message.toLowerCase();
    const enabledRules = (rules || []).filter((rule) => rule.enabled);

    const results = enabledRules.map((rule) => {
      const config = rule.config || {};
      let matched = false;
      let note = 'Ingen match';

      if (rule.rule_type === 'words') {
        const words = Array.isArray(config.words) ? config.words.map(String) : [];
        const exact = Boolean(config.match_exact);
        const hit = words.find((word) => {
          if (!word) return false;
          if (!exact) return lower.includes(word.toLowerCase());
          return new RegExp(`(^|\\W)${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\  const handleSaveRule = () => {')}(?=\\W|$)`, 'i').test(message);
        });
        matched = Boolean(hit);
        note = hit ? `Forbudt ord: ${hit}` : 'Ingen forbudte ord';
      } else if (rule.rule_type === 'links') {
        const urls = message.match(/https?:\/\/[^\s]+/gi) || [];
        const allowed = Array.isArray(config.allowed_domains) ? config.allowed_domains.map(String) : [];
        const blocked = Array.isArray(config.blocked_domains) ? config.blocked_domains.map(String) : [];
        const blockedUrl = urls.find((url) => {
          const domain = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
          if (allowed.some((item) => domain.includes(item))) return false;
          return Boolean(config.block_all) || blocked.some((item) => domain.includes(item));
        });
        matched = Boolean(blockedUrl);
        note = blockedUrl ? `Blokeret link: ${blockedUrl}` : `${urls.length} links analyseret`;
      } else if (rule.rule_type === 'invites') {
        matched = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i.test(message);
        note = matched ? 'Discord invite fundet' : 'Ingen invite';
      } else if (rule.rule_type === 'mentions') {
        const userMentions = (message.match(/<@!?\d+>/g) || []).length;
        const roleMentions = (message.match(/<@&\d+>/g) || []).length;
        matched =
          userMentions > Number(config.max_mentions ?? 5) ||
          roleMentions > Number(config.max_role_mentions ?? 3);
        note = `${userMentions} user mentions · ${roleMentions} role mentions`;
      } else if (rule.rule_type === 'caps') {
        const letters = message.match(/[a-zæøå]/gi) || [];
        const uppercase = letters.filter((letter) => letter === letter.toUpperCase()).length;
        const percent = letters.length ? Math.round((uppercase / letters.length) * 100) : 0;
        matched =
          message.length >= Number(config.min_length ?? 10) &&
          percent > Number(config.max_caps_percent ?? 70);
        note = `${percent}% CAPS`;
      } else if (rule.rule_type === 'spam') {
        note = 'Spam kræver flere beskeder over tid og kan ikke afgøres på én testbesked.';
      } else if (rule.rule_type === 'ai_toxicity') {
        note = 'AI toxicity kræver server-side AI-kald og simuleres ikke i browseren.';
      }

      return { type: rule.rule_type, matched, note };
    });

    setTestResults(results);
  };

  const handleSaveRule = () => {
    if (!selectedRule) return;
    upsertRule.mutate({
      rule_type: selectedRule,
      config: editingConfig,
      action: editingAction,
      action_duration_seconds: editingDuration ? parseInt(editingDuration) : null,
      enabled: true,
    });
    setSelectedRule(null);
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Vælg en server først</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Auto-Moderation</h1>
        <p className="text-muted-foreground">Automatiser moderation med regler for spam, links, ord og mere</p>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Shield className="h-4 w-4" />
            Regler
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <Shield className="h-4 w-4" />
            Test regler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <AutomodBypassRolesCard />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(RULE_TYPE_INFO) as AutomodRuleType[]).map((type) => {
              const info = RULE_TYPE_INFO[type];
              const rule = getRule(type);
              const isEnabled = rule?.enabled ?? false;

              return (
                <Card key={type} className={isEnabled ? 'border-primary/50' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {RULE_ICONS[type]}
                        {info.label}
                      </CardTitle>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggleRule(type, checked)}
                      />
                    </div>
                    <CardDescription className="text-sm">
                      {info.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      {rule && (
                        <Badge variant={isEnabled ? 'default' : 'secondary'}>
                          {ACTION_LABELS[rule.action]}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectRule(type)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Konfigurer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Rule Configuration Modal/Panel */}
          {selectedRule && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {RULE_ICONS[selectedRule]}
                  Konfigurer: {RULE_TYPE_INFO[selectedRule].label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Handling</Label>
                    <Select value={editingAction} onValueChange={(v) => setEditingAction(v as AutomodAction)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACTION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(editingAction === 'mute' || editingAction === 'ban') && (
                    <div className="space-y-2">
                      <Label>Varighed (sekunder)</Label>
                      <Input
                        type="number"
                        placeholder="300 (5 minutter)"
                        value={editingDuration}
                        onChange={(e) => setEditingDuration(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Lad tom for permanent
                      </p>
                    </div>
                  )}
                </div>

                {/* Rule-specific config */}
                {selectedRule === 'words' && (
                  <div className="space-y-2">
                    <Label>Forbudte ord (et per linje)</Label>
                    <Textarea
                      rows={5}
                      value={((editingConfig.words as string[]) || []).join('\n')}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        words: e.target.value.split('\n').filter(w => w.trim()),
                      })}
                      placeholder="badword1&#10;badword2&#10;badword3"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={editingConfig.match_exact as boolean || false}
                        onCheckedChange={(checked) => setEditingConfig({
                          ...editingConfig,
                          match_exact: checked,
                        })}
                      />
                      <Label>Kun hele ord (ikke delvis match)</Label>
                    </div>
                  </div>
                )}

                {selectedRule === 'links' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingConfig.block_all as boolean || false}
                        onCheckedChange={(checked) => setEditingConfig({
                          ...editingConfig,
                          block_all: checked,
                        })}
                      />
                      <Label>Bloker alle links</Label>
                    </div>
                    {!editingConfig.block_all && (
                      <div className="space-y-2">
                        <Label>Blokerede domæner (et per linje)</Label>
                        <Textarea
                          rows={3}
                          value={((editingConfig.blocked_domains as string[]) || []).join('\n')}
                          onChange={(e) => setEditingConfig({
                            ...editingConfig,
                            blocked_domains: e.target.value.split('\n').filter(d => d.trim()),
                          })}
                          placeholder="spam-site.com&#10;malware.net"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Tilladte domæner (undtaget fra blokering)</Label>
                      <Textarea
                        rows={2}
                        value={((editingConfig.allowed_domains as string[]) || []).join('\n')}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          allowed_domains: e.target.value.split('\n').filter(d => d.trim()),
                        })}
                        placeholder="youtube.com&#10;twitter.com"
                      />
                    </div>
                  </div>
                )}

                {selectedRule === 'mentions' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Max mentions per besked</Label>
                      <Input
                        type="number"
                        value={(editingConfig.max_mentions as number) || 5}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          max_mentions: parseInt(e.target.value) || 5,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max role mentions per besked</Label>
                      <Input
                        type="number"
                        value={(editingConfig.max_role_mentions as number) || 3}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          max_role_mentions: parseInt(e.target.value) || 3,
                        })}
                      />
                    </div>
                  </div>
                )}

                {selectedRule === 'caps' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Max CAPS procent</Label>
                      <Input
                        type="number"
                        value={(editingConfig.max_caps_percent as number) || 70}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          max_caps_percent: parseInt(e.target.value) || 70,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min besked længde</Label>
                      <Input
                        type="number"
                        value={(editingConfig.min_length as number) || 10}
                        onChange={(e) => setEditingConfig({
                          ...editingConfig,
                          min_length: parseInt(e.target.value) || 10,
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Beskeder kortere end dette ignoreres
                      </p>
                    </div>
                  </div>
                )}

                {selectedRule === 'invites' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingConfig.block_all as boolean ?? true}
                        onCheckedChange={(checked) => setEditingConfig({
                          ...editingConfig,
                          block_all: checked,
                        })}
                      />
                      <Label>Bloker alle Discord invites</Label>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSaveRule}>Gem regel</Button>
                  <Button variant="outline" onClick={() => setSelectedRule(null)}>Annuller</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AutoMod Rule Tester</CardTitle>
              <CardDescription>
                Test en besked mod de aktive deterministiske regler uden at sende den i Discord eller udløse en punishment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                placeholder="Indsæt en testbesked..."
                rows={6}
              />
              <Button onClick={testRules} disabled={!testMessage.trim()}>
                Test besked
              </Button>

              {testResults.length > 0 && (
                <div className="grid gap-2 md:grid-cols-2">
                  {testResults.map((result) => (
                    <div
                      key={result.type}
                      className={`rounded-lg border p-3 ${result.matched ? 'border-destructive/40 bg-destructive/[0.04]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{RULE_TYPE_INFO[result.type].label}</span>
                        <Badge variant={result.matched ? 'destructive' : 'outline'}>
                          {result.matched ? 'MATCH' : 'OK'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{result.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Auto-Mod Logs
              </CardTitle>
              <CardDescription>
                De seneste 100 automod handlinger
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logs && logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidspunkt</TableHead>
                      <TableHead>Bruger</TableHead>
                      <TableHead>Regel</TableHead>
                      <TableHead>Handling</TableHead>
                      <TableHead>Besked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: da })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.user_name || log.user_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {RULE_TYPE_INFO[log.rule_type]?.label || log.rule_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.action_taken === 'ban' ? 'destructive' : 'secondary'}>
                            {ACTION_LABELS[log.action_taken]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {log.message_content || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen automod logs endnu</p>
                  <p className="text-sm mt-2">Logs vises når automod trigger på beskeder</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
