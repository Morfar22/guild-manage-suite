import { useState, useEffect } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useGuildBotSettings, useActiveBots, UpdateBotSettingsData, BotTestResult } from '@/hooks/useGuildBotSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bot, Key, Shield, Activity, Loader2, AlertTriangle, Check, Eye, EyeOff, Trash2, Zap, Server, Users, Clock, Copy, ExternalLink, Link } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { PrefixSettingsCard } from '@/components/dashboard/PrefixSettingsCard';
import { buildBotInviteUrl } from '@/lib/product';

export default function BotSettings() {
  const { selectedGuild } = useGuild();
  const { settings, isLoading, updateSettings, deleteSettings, isUpdating, isDeleting, testToken, isTestingToken } = useGuildBotSettings();
  const { data: activeBots, isLoading: isLoadingActiveBots, error: activeBotsError } = useActiveBots();
  
  const [isCustomBot, setIsCustomBot] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [botClientId, setBotClientId] = useState('');
  const [botPublicKey, setBotPublicKey] = useState('');
  const [botName, setBotName] = useState('');
  const [botAvatarUrl, setBotAvatarUrl] = useState('');
  const [botStatus, setBotStatus] = useState('online');
  const [botActivityType, setBotActivityType] = useState('PLAYING');
  const [botActivityText, setBotActivityText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [testResult, setTestResult] = useState<BotTestResult | null>(null);
  const customBotInviteUrl = botClientId ? buildBotInviteUrl(botClientId) : '';

  // Load settings when data is fetched, or reset when settings are deleted
  useEffect(() => {
    if (settings) {
      setIsCustomBot(settings.is_custom_bot);
      setBotClientId(settings.bot_client_id || '');
      setBotPublicKey(settings.bot_public_key || '');
      setBotName(settings.bot_name || '');
      setBotAvatarUrl(settings.bot_avatar_url || '');
      setBotStatus(settings.bot_status || 'online');
      setBotActivityType(settings.bot_activity_type || 'PLAYING');
      setBotActivityText(settings.bot_activity_text || '');
      setIsActive(settings.is_active);
    } else {
      // Reset all state when settings are deleted
      setIsCustomBot(false);
      setBotToken('');
      setBotClientId('');
      setBotPublicKey('');
      setBotName('');
      setBotAvatarUrl('');
      setBotStatus('online');
      setBotActivityType('PLAYING');
      setBotActivityText('');
      setIsActive(false);
      setTestResult(null);
    }
  }, [settings]);

  const handleTestToken = async () => {
    if (!botToken) {
      toast.error('Indtast en bot token først');
      return;
    }

    try {
      const result = await testToken(botToken);
      setTestResult(result);

      if (result.valid && result.bot) {
        toast.success(`Token valid! Bot: ${result.bot.username}`);
        // Auto-fill bot name and avatar if empty
        if (!botName && result.bot.username) {
          setBotName(result.bot.username);
        }
        if (!botAvatarUrl && result.bot.avatar_url) {
          setBotAvatarUrl(result.bot.avatar_url);
        }
        if (!botClientId && result.bot.id) {
          setBotClientId(result.bot.id);
        }
      } else {
        toast.error(result.details || result.error || 'Token ugyldig');
      }
    } catch (error) {
      toast.error('Fejl ved test af token');
    }
  };

  const handleSave = () => {
    const data: UpdateBotSettingsData = {
      is_custom_bot: isCustomBot,
      bot_client_id: botClientId || undefined,
      bot_public_key: botPublicKey || undefined,
      bot_name: botName || undefined,
      bot_avatar_url: botAvatarUrl || undefined,
      bot_status: botStatus,
      bot_activity_type: botActivityType,
      bot_activity_text: botActivityText || undefined,
      is_active: isActive,
    };

    // Only include token if it was changed
    if (botToken) {
      data.bot_token = botToken;
    }

    updateSettings(data);
    setBotToken(''); // Clear token field after save
    setTestResult(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PremiumGate feature="custom_bot">
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bot Indstillinger</h1>
        <p className="text-muted-foreground mt-1">
          Konfigurer din egen Discord bot til {selectedGuild?.guild_name}
        </p>
      </div>

      {/* Active Bots Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Aktive Bots</CardTitle>
              <CardDescription>Oversigt over alle kørende bot instances</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActiveBots ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeBotsError ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Kunne ikke hente aktive bots</p>
              <p className="mt-1 text-xs">{String((activeBotsError as any)?.message || activeBotsError)}</p>
            </div>
          ) : activeBots && activeBots.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activeBots.map((bot) => (
                <div
                  key={bot.guild_id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="relative">
                    {bot.bot_avatar_url || bot.guild_icon ? (
                      <img
                        src={bot.bot_avatar_url || bot.guild_icon}
                        alt={bot.bot_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        bot.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{bot.guild_name}</p>
                      {bot.is_custom_bot && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {bot.member_count}
                      </span>
                      <span className={`flex items-center gap-1 ${
                        bot.latency_ms < 100 ? 'text-green-500' :
                        bot.latency_ms < 200 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        <Activity className="h-3 w-3" />
                        {bot.latency_ms}ms
                      </span>
                      {bot.last_heartbeat && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(bot.last_heartbeat), { addSuffix: true, locale: da })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ingen aktive bots</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Vigtigt:</strong> Når du bruger en custom bot, skal din VPS bot-process opdateres til at håndtere dette guild's token. 
          Bot tokens gemmes krypteret i databasen.
        </AlertDescription>
      </Alert>

      {/* Custom Bot Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Custom Discord Bot</CardTitle>
                <CardDescription>Brug din egen bot med eget logo og token</CardDescription>
              </div>
            </div>
            <Switch
              checked={isCustomBot}
              onCheckedChange={setIsCustomBot}
            />
          </div>
        </CardHeader>
      </Card>

      {isCustomBot && (
        <>
          {/* Bot Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <Key className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Bot Credentials</CardTitle>
                  <CardDescription>
                    Disse oplysninger finder du i Discord Developer Portal
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-token">Bot Token</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="bot-token"
                      type={showToken ? 'text' : 'password'}
                      value={botToken}
                      onChange={(e) => {
                        setBotToken(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder={settings?.bot_token_masked || 'Indtast bot token...'}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestToken}
                    disabled={!botToken || isTestingToken}
                  >
                    {isTestingToken ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    <span className="ml-2">Test</span>
                  </Button>
                </div>
                {settings?.bot_token_masked && !botToken && (
                  <p className="text-xs text-muted-foreground">
                    Nuværende token: {settings.bot_token_masked}
                  </p>
                )}
                {testResult && (
                  <div className={`p-3 rounded-lg text-sm ${
                    testResult.valid 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' 
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}>
                    {testResult.valid && testResult.bot ? (
                      <div className="flex items-center gap-3">
                        {testResult.bot.avatar_url && (
                          <img 
                            src={testResult.bot.avatar_url} 
                            alt={testResult.bot.username}
                            className="h-8 w-8 rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-medium">✓ Token valid</p>
                          <p className="text-xs opacity-80">
                            Bot: {testResult.bot.username} (ID: {testResult.bot.id})
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p>✗ {testResult.details || testResult.error || 'Token ugyldig'}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID (Application ID)</Label>
                  <Input
                    id="client-id"
                    value={botClientId}
                    onChange={(e) => setBotClientId(e.target.value)}
                    placeholder="123456789012345678"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-key">Public Key</Label>
                  <Input
                    id="public-key"
                    value={botPublicKey}
                    onChange={(e) => setBotPublicKey(e.target.value)}
                    placeholder="abcdef123456..."
                    className="font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bot Invite Link */}
          {botClientId && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Link className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Inviter din bot til serveren</CardTitle>
                    <CardDescription>
                      Brug linket nedenfor til at tilføje din custom bot til Discord serveren. Botten skal inviteres før den kan fungere.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Vigtigt:</strong> Sørg for at botten er inviteret til den server du vil bruge den på. Uden invitation kan botten ikke modtage beskeder eller reagere på kommandoer.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label>Invite Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={customBotInviteUrl}
                      className="font-mono text-xs bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(customBotInviteUrl);
                        toast.success('Link kopieret!');
                      }}
                      title="Kopier link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      asChild
                      className="shrink-0"
                    >
                      <a
                        href={customBotInviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Inviter Bot
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Sådan gør du:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Klik på <strong>"Inviter Bot"</strong> knappen ovenfor</li>
                    <li>Vælg den server du vil tilføje botten til</li>
                    <li>Godkend de nødvendige tilladelser</li>
                    <li>Klik <strong>"Autorisér"</strong> — færdig!</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bot Profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Shield className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle>Bot Profil</CardTitle>
                  <CardDescription>
                    Navn og avatar til reference (ændres i Discord Developer Portal)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bot-name">Bot Navn</Label>
                  <Input
                    id="bot-name"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="Min Custom Bot"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar-url">Avatar URL</Label>
                  <Input
                    id="avatar-url"
                    value={botAvatarUrl}
                    onChange={(e) => setBotAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                  />
                </div>
              </div>

              {botAvatarUrl && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <img
                    src={botAvatarUrl}
                    alt="Bot Avatar"
                    className="h-16 w-16 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div>
                    <p className="font-medium">{botName || 'Custom Bot'}</p>
                    <p className="text-sm text-muted-foreground">Preview af bot avatar</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bot Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Bot Status</CardTitle>
                  <CardDescription>Konfigurer bot's online status og aktivitet</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Online Status</Label>
                  <Select value={botStatus} onValueChange={setBotStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">🟢 Online</SelectItem>
                      <SelectItem value="idle">🟡 Idle</SelectItem>
                      <SelectItem value="dnd">🔴 Do Not Disturb</SelectItem>
                      <SelectItem value="invisible">⚫ Invisible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aktivitets Type</Label>
                  <Select value={botActivityType} onValueChange={setBotActivityType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLAYING">Playing</SelectItem>
                      <SelectItem value="STREAMING">Streaming</SelectItem>
                      <SelectItem value="LISTENING">Listening to</SelectItem>
                      <SelectItem value="WATCHING">Watching</SelectItem>
                      <SelectItem value="COMPETING">Competing in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity-text">Aktivitets Tekst</Label>
                  <Input
                    id="activity-text"
                    value={botActivityText}
                    onChange={(e) => setBotActivityText(e.target.value)}
                    placeholder="with your server"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Preview: <span className="text-foreground font-medium">{botActivityType.charAt(0) + botActivityType.slice(1).toLowerCase()}</span> {botActivityText || '...'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Activation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Aktiver Custom Bot</CardTitle>
                    <CardDescription>
                      Når aktiveret vil VPS bot-processen bruge denne konfiguration
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && (
                    <Badge variant="default">
                      Aktiv
                    </Badge>
                  )}
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={!botToken && !settings?.bot_token_masked}
                  />
                </div>
              </div>
            </CardHeader>
            {!botToken && !settings?.bot_token_masked && (
              <CardContent>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Du skal indtaste en bot token før du kan aktivere custom bot.
                  </AlertDescription>
                </Alert>
              </CardContent>
            )}
          </Card>

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!settings || isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Slet Custom Bot
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dette vil slette alle custom bot indstillinger for dette guild. 
                    Bot token vil blive permanent slettet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteSettings()}>
                    Slet
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Gem Indstillinger
            </Button>
          </div>
        </>
      )}

      {/* Command Prefix */}
      <PrefixSettingsCard guildId={selectedGuild?.id} />

      {/* Global Ban System Opt-out */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle>Global Ban System</CardTitle>
                <CardDescription>
                  Deltag i det globale ban-system. Når aktiveret, vil brugere der er globalt banned automatisk blive banned på denne server.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={!settings?.global_ban_opt_out}
              onCheckedChange={(checked) => {
                updateSettings({ global_ban_opt_out: !checked });
              }}
            />
          </div>
        </CardHeader>
      </Card>

      {!isCustomBot && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Standard Bot</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Du bruger den delte standard bot. Aktiver "Custom Discord Bot" ovenfor 
              for at konfigurere din egen bot med eget logo og token.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </PremiumGate>
  );
}
