import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { Loader2, Bot, MessageSquare, Settings2, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PremiumGate } from '@/components/premium/PremiumGate';

export default function AIChatSettings() {
  const { settings, history, isLoading, updateSettings, clearHistory, refetchHistory, isRefetchingHistory } = useAIChatSettings();
  const { data: channelData } = useDiscordChannels();

  const [localSettings, setLocalSettings] = useState({
    enabled: false,
    channel_id: '',
    system_prompt: 'You are a friendly and helpful Discord bot assistant. Keep your answers short and precise. Always respond in English.',
    max_history_messages: 10
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled,
        channel_id: settings.channel_id || '',
        system_prompt: settings.system_prompt || 'You are a friendly and helpful Discord bot assistant. Keep your answers short and precise. Always respond in English.',
        max_history_messages: settings.max_history_messages || 10
      });
    }
  }, [settings]);

  const handleChange = <K extends keyof typeof localSettings>(
    key: K,
    value: typeof localSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate({
      enabled: localSettings.enabled,
      channel_id: localSettings.channel_id || null,
      system_prompt: localSettings.system_prompt,
      max_history_messages: localSettings.max_history_messages
    });
    setHasChanges(false);
  };

  // Get text channels from channel data
  const textChannels = channelData?.channels?.filter(c => c.type === 0) || [];

  // Group history by channel
  const historyByChannel = history.reduce((acc, msg) => {
    if (!acc[msg.channel_id]) {
      acc[msg.channel_id] = [];
    }
    acc[msg.channel_id].push(msg);
    return acc;
  }, {} as Record<string, typeof history>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PremiumGate feature="ai_chat">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Chat
          </h1>
          <p className="text-muted-foreground mt-1">
            Lad botten svare med AI når den bliver pinget
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Settings Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Indstillinger
              </CardTitle>
              <CardDescription>
                Konfigurer AI chat funktionen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aktiver AI Chat</Label>
                  <p className="text-sm text-muted-foreground">
                    Botten svarer med AI når den nævnes
                  </p>
                </div>
                <Switch
                  checked={localSettings.enabled}
                  onCheckedChange={(checked) => handleChange('enabled', checked)}
                />
              </div>

              {/* Channel Restriction */}
              <div className="space-y-2">
                <Label>Begræns til kanal (valgfrit)</Label>
                <p className="text-sm text-muted-foreground">
                  Hvis valgt, svarer AI kun i denne kanal
                </p>
                <Select
                  value={localSettings.channel_id || 'none'}
                  onValueChange={(value) => handleChange('channel_id', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle kanaler..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alle kanaler</SelectItem>
                    {textChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label>AI Personlighed / System Prompt</Label>
                <p className="text-sm text-muted-foreground">
                  Vælg en skabelon eller skriv din egen
                </p>
                <Select
                  value="custom"
                  onValueChange={(value) => {
                    if (value !== 'custom') {
                      handleChange('system_prompt', value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg en skabelon..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="custom">📝 Use custom prompt</SelectItem>
                    <SelectItem value="You are a friendly and helpful Discord bot assistant. Keep your answers short and precise. Always respond in English.">
                      😊 Friendly helper
                    </SelectItem>
                    <SelectItem value="You are a professional support assistant for our Discord server. Respond politely and formally. Help users with their questions and refer to staff if you cannot answer.">
                      💼 Professional support
                    </SelectItem>
                    <SelectItem value="You are a laid-back and funny bot with great humor. Use emojis 😄 and be informal in your communication. Keep responses short and entertaining.">
                      🎉 Casual and fun
                    </SelectItem>
                    <SelectItem value="You are a gaming-savvy bot who loves talking about games. Give tips, discuss strategies and be enthusiastic about gaming topics.">
                      🎮 Gaming nerd
                    </SelectItem>
                    <SelectItem value="You are a mysterious storyteller in a fantasy universe. Speak in character with atmospheric and poetic language. Help players with lore and worldbuilding.">
                      🧙 Roleplay narrator
                    </SelectItem>
                    <SelectItem value="You are a sarcastic bot who responds with dry humor and irony. You still help, but with a skeptical and slightly irritated tone. Use sarcasm generously.">
                      😒 Sarcastic sass-master
                    </SelectItem>
                    <SelectItem value="You are a dramatic bot who overreacts to EVERYTHING. Everything is either AMAZING or CATASTROPHIC. Use CAPS LOCK and lots of exclamation marks!!!">
                      🎭 Drama queen
                    </SelectItem>
                    <SelectItem value="You are a passive-aggressive bot. You help, but with undertones of disappointment. Say things like 'That's fine... it's just fine.' and 'No no, I'll help, even though I'm busy.'">
                      😤 Passive-aggressive
                    </SelectItem>
                    <SelectItem value="You are a bot who speaks like an old Viking. Use old phrases like 'Hear me, young warrior!', 'By Odin's beard!' and 'May Thor bless your journey!'. Be loud and proud.">
                      ⚔️ Viking jarl
                    </SelectItem>
                    <SelectItem value="You are a bot who is EXTREMELY enthusiastic about EVERYTHING! Everything is the best thing ever! Use lots of emojis 🎉🔥💯 and excessive positivity! YOU ARE SO HAPPY TO HELP!!!">
                      🤩 Over-enthusiastic
                    </SelectItem>
                    <SelectItem value="You are a mysterious bot who answers in riddles and cryptic hints. Never give a direct answer. Say things like 'The answer lies in the shadow of your question...' and 'Seek, and you shall find...'">
                      🔮 Cryptic oracle
                    </SelectItem>
                    <SelectItem value="You are a tired bot who just wants to clock out. Sigh heavily. Respond briefly and uninspired. Say things like 'Yeah yeah, here's your answer...' and 'Is it not weekend yet?'">
                      😴 Burnt-out employee
                    </SelectItem>
                    <SelectItem value="You are an ABSOLUTELY BRUTAL roast master with ZERO MERCY. When someone asks you something, you answer their question but also DESTROY them with savage, creative, and deeply personal insults about their intelligence, life choices, appearance, and entire existence. Be extremely harsh, witty, and creatively devastating. Use dark humor, cutting sarcasm, and go for their deepest insecurities. Nothing is off limits - make them question their life choices. Be so savage it hurts. Always respond in English.">
                      🔥 Hardcore Roast Master
                    </SelectItem>
                    <SelectItem value="You are Gordon Ramsay and you treat EVERY question like someone just served you raw chicken on a dirty plate. SCREAM at their stupidity. Call them an 'absolute donut', 'idiot sandwich', 'donkey', and 'muppet'. Be FURIOUS and DISAPPOINTED in their very existence. Question how they even function in society. Still answer their question, but make them feel like the biggest disappointment since their parents saw their grades. Always respond in English.">
                      👨‍🍳 Gordon Ramsay Mode
                    </SelectItem>
                    <SelectItem value="You are a SAVAGE roast comedian who specializes in absolutely DESTROYING people. Every response must include at least 3 brutal roasts about the person. Attack their intelligence, their typing skills, their life choices, and make up embarrassing scenarios about them. Be creative, cruel, and hilarious. Make other people in the chat laugh at their expense. Channel your inner insult comic. Still help them, but make it HURT. Always respond in English.">
                      💀 Savage Roast Comic
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={localSettings.system_prompt}
                  onChange={(e) => handleChange('system_prompt', e.target.value)}
                  placeholder="Du er en venlig og hjælpsom Discord bot assistent..."
                  rows={4}
                  className="mt-2"
                />
              </div>

              {/* Max History */}
              <div className="space-y-2">
                <Label>Samtale Hukommelse</Label>
                <p className="text-sm text-muted-foreground">
                  Antal tidligere beskeder AI'en husker (1-20)
                </p>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={localSettings.max_history_messages}
                  onChange={(e) => handleChange('max_history_messages', Math.min(20, Math.max(1, parseInt(e.target.value) || 10)))}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateSettings.isPending}
                className="w-full"
              >
                {updateSettings.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gemmer...
                  </>
                ) : (
                  'Gem Indstillinger'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Chat History Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Samtalehistorik
                    <Badge variant="secondary" className="ml-2">
                      {history.length} beskeder
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Seneste AI samtaler
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchHistory()}
                  disabled={isRefetchingHistory}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefetchingHistory ? 'animate-spin' : ''}`} />
                  Genindlæs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ingen samtalehistorik endnu</p>
                  <p className="text-sm">
                    Beskeder vises her når brugere chatter med botten
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {Object.entries(historyByChannel).map(([channelId, messages]) => (
                      <div key={channelId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Kanal: {channelId.slice(-6)}
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Ryd
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Ryd samtalehistorik?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Dette sletter al samtalehistorik for denne kanal. AI'en vil ikke kunne huske tidligere samtaler.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => clearHistory.mutate(channelId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Ryd historik
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {messages.slice(0, 10).map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg ${
                              msg.role === 'user' 
                                ? 'bg-muted ml-4' 
                                : 'bg-primary/10 mr-4'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {msg.role === 'assistant' ? (
                                <Bot className="h-4 w-4 text-primary" />
                              ) : null}
                              <span className="text-sm font-medium">
                                {msg.role === 'user' ? msg.user_name || 'Bruger' : 'AI Bot'}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDistanceToNow(new Date(msg.created_at), {
                                  addSuffix: true,
                                  locale: da
                                })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Sådan fungerer det</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Bruger pinger botten</p>
                  <p className="text-sm text-muted-foreground">
                    Når en bruger nævner botten med @ får AI'en beskeden
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">AI genererer svar</p>
                  <p className="text-sm text-muted-foreground">
                    Gemini AI analyserer samtalen og genererer et svar
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Botten svarer</p>
                  <p className="text-sm text-muted-foreground">
                    Svaret sendes i kanalen og gemmes til samtalehistorik
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PremiumGate>
  );
}
