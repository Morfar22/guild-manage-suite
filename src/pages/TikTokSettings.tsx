import { useState, useEffect } from 'react';
import { useTikTokAccounts, TikTokAccount } from '@/hooks/useTikTokAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Settings2, Loader2, Trash2, Users, TrendingUp, History, Video, Link, Send,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PremiumGate } from '@/components/premium/PremiumGate';

// TikTok icon as SVG since lucide doesn't have one
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.98a8.2 8.2 0 004.76 1.52V7.05a4.84 4.84 0 01-1-.36z"/>
    </svg>
  );
}

export default function TikTokSettings() {
  const {
    accounts, settings, logs, loading, saving,
    addAccount, removeAccount, updateAccount, saveSettings,
  } = useTikTokAccounts();

  const { data: channelsData } = useDiscordChannels();
  const { data: rolesData } = useDiscordRoles();

  const channels = channelsData?.channels || [];
  const roles = rolesData || [];
  const textChannels = channels.filter(c => c.type === 0);

  const [activeTab, setActiveTab] = useState('accounts');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TikTokAccount | null>(null);

  // Add form
  const [newUsername, setNewUsername] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);

  const handleTestNotify = async (accountId: string) => {
    setTestingAccountId(accountId);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiktok-test-notify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: accountId }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send test notification');
      }
      const { toast: toastFn } = await import('sonner');
      toastFn.success('Test notifikation sendt!');
    } catch (error) {
      console.error('Test notification error:', error);
      const { toast: toastFn } = await import('sonner');
      toastFn.error('Kunne ikke sende test notifikation');
    } finally {
      setTestingAccountId(null);
    }
  };

  // Settings state
  const [localSettings, setLocalSettings] = useState({
    enabled: true,
    new_video_message: '🎵 **{username}** har uploadet en ny TikTok!',
    embed_color: '#000000',
    auto_embed_links: true,
    live_notifications: true,
    live_message: '🔴 **{username}** er nu LIVE på TikTok!',
    offline_message: '⚫ **{username}** er gået offline på TikTok.',
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled,
        new_video_message: settings.new_video_message ?? '🎵 **{username}** har uploadet en ny TikTok!',
        embed_color: settings.embed_color ?? '#000000',
        auto_embed_links: settings.auto_embed_links,
        live_notifications: settings.live_notifications ?? true,
        live_message: settings.live_message ?? '🔴 **{username}** er nu LIVE på TikTok!',
        offline_message: settings.offline_message ?? '⚫ **{username}** er gået offline på TikTok.',
      });
    }
  }, [settings]);

  const handleAddAccount = async () => {
    if (!newUsername.trim() || !newChannelId) return;
    const success = await addAccount(newUsername.trim(), newChannelId, newRoleId || undefined);
    if (success) {
      setNewUsername('');
      setNewChannelId('');
      setNewRoleId('');
      setAddDialogOpen(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    await removeAccount(accountToDelete.id);
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const handleSaveSettings = () => saveSettings(localSettings);

  const getChannelName = (id: string) => textChannels.find(c => c.id === id)?.name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PremiumGate feature="tiktok">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-lg bg-foreground/10">
                <TikTokIcon className="h-6 w-6" />
              </div>
              TikTok Notifikationer
            </h1>
            <p className="mt-1 text-muted-foreground">
              Få besked når TikTok konti uploader nye videoer, og auto-embed TikTok links
            </p>
          </div>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Tilføj Konto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tilføj TikTok Konto</DialogTitle>
                <DialogDescription>
                  Indtast TikTok brugernavnet og vælg kanal for notifikationer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>TikTok Brugernavn</Label>
                  <Input
                    placeholder="f.eks. @brugernavn"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notifikations Kanal</Label>
                  <Select value={newChannelId} onValueChange={setNewChannelId}>
                    <SelectTrigger><SelectValue placeholder="Vælg en kanal" /></SelectTrigger>
                    <SelectContent>
                      {textChannels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}># {ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mention Rolle (valgfrit)</Label>
                  <Select value={newRoleId || 'none'} onValueChange={(v) => setNewRoleId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Ingen rolle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen rolle</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>@{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuller</Button>
                <Button onClick={handleAddAccount} disabled={saving || !newUsername.trim() || !newChannelId}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tilføj
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{accounts.length}</p>
                  <p className="text-sm text-muted-foreground">Trackede Konti</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10"><Video className="h-5 w-5 text-accent-foreground" /></div>
                <div>
                  <p className="text-2xl font-bold">{accounts.filter(a => a.enabled).length}</p>
                  <p className="text-sm text-muted-foreground">Aktive</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-foreground/10"><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-sm text-muted-foreground">Notifikationer Sendt</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2"><Video className="h-4 w-4" />Konti</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" />Indstillinger</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2"><History className="h-4 w-4" />Log</TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-4">
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <TikTokIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Ingen TikTok konti tilføjet endnu</p>
                    <p className="text-sm">Klik på "Tilføj Konto" for at komme i gang</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                  <Card key={account.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-foreground/10 flex items-center justify-center">
                            <TikTokIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">@{account.tiktok_username}</CardTitle>
                            <CardDescription>
                              #{getChannelName(account.notification_channel_id) || 'unknown'}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestNotify(account.id)}
                            disabled={testingAccountId === account.id}
                          >
                            {testingAccountId === account.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Send className="h-3 w-3 mr-1" />
                            )}
                            Test
                          </Button>
                          <Switch
                            checked={account.enabled}
                            onCheckedChange={(enabled) => updateAccount(account.id, { enabled } as any)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setAccountToDelete(account); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={account.enabled ? 'default' : 'secondary'}>
                          {account.enabled ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                        {account.is_live && (
                          <Badge variant="destructive" className="animate-pulse">
                            🔴 LIVE
                          </Badge>
                        )}
                        {account.last_check_at && (
                          <span>Sidst tjekket: {new Date(account.last_check_at).toLocaleString('da-DK')}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  TikTok Indstillinger
                </CardTitle>
                <CardDescription>Tilpas notifikationer og auto-embed funktioner</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Aktiver TikTok Notifikationer</Label>
                    <p className="text-sm text-muted-foreground">Slå alle TikTok notifikationer til eller fra</p>
                  </div>
                  <Switch
                    checked={localSettings.enabled}
                    onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, enabled: checked }))}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2"><Link className="h-4 w-4" />Auto-Embed TikTok Links</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatisk embed TikTok videoer når links deles i chatten
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.auto_embed_links}
                    onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, auto_embed_links: checked }))}
                  />
                </div>

                <Separator />

                {/* LIVE Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">🔴 LIVE Notifikationer</Label>
                    <p className="text-sm text-muted-foreground">
                      Send besked når en TikTok konto går LIVE (eksperimentel)
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.live_notifications}
                    onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, live_notifications: checked }))}
                  />
                </div>

                {localSettings.live_notifications && (
                  <>
                    <div className="space-y-2">
                      <Label>LIVE Besked</Label>
                      <Textarea
                        value={localSettings.live_message}
                        onChange={(e) => setLocalSettings(s => ({ ...s, live_message: e.target.value }))}
                        placeholder="🔴 **{username}** er nu LIVE på TikTok!"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variabler: {'{username}'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Offline Besked</Label>
                      <Textarea
                        value={localSettings.offline_message}
                        onChange={(e) => setLocalSettings(s => ({ ...s, offline_message: e.target.value }))}
                        placeholder="⚫ **{username}** er gået offline på TikTok."
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label>Ny Video Besked</Label>
                  <Textarea
                    value={localSettings.new_video_message}
                    onChange={(e) => setLocalSettings(s => ({ ...s, new_video_message: e.target.value }))}
                    placeholder="🎵 **{username}** har uploadet en ny TikTok!"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variabler: {'{username}'}, {'{url}'}, {'{title}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Embed Farve</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={localSettings.embed_color}
                      onChange={(e) => setLocalSettings(s => ({ ...s, embed_color: e.target.value }))}
                      className="h-10 w-14 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={localSettings.embed_color}
                      onChange={(e) => setLocalSettings(s => ({ ...s, embed_color: e.target.value }))}
                      className="w-32"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gem Indstillinger
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Notifikations Log
                </CardTitle>
                <CardDescription>Seneste TikTok notifikationer sendt til Discord</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Ingen notifikationer sendt endnu</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brugernavn</TableHead>
                        <TableHead>Video</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Dato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">@{log.tiktok_username}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.video_url ? (
                              <a href={log.video_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {log.video_title || log.video_id || 'Video'}
                              </a>
                            ) : (
                              log.video_title || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.notification_type}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(log.created_at).toLocaleString('da-DK')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fjern TikTok Konto</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil fjerne @{accountToDelete?.tiktok_username}? Denne handling kan ikke fortrydes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount}>Fjern</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PremiumGate>
  );
}
