import { useState, useEffect } from 'react';
import { useYouTubeChannels, YouTubeChannel } from '@/hooks/useYouTubeChannels';
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
  Plus, Settings2, Loader2, Trash2, Users, TrendingUp, History, Video,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export default function YouTubeSettings() {
  const {
    channels, settings, logs, loading, saving,
    addChannel, removeChannel, updateChannel, saveSettings,
  } = useYouTubeChannels();

  const { data: channelsData } = useDiscordChannels();
  const { data: rolesData } = useDiscordRoles();

  const discordChannels = channelsData?.channels || [];
  const roles = rolesData || [];
  const textChannels = discordChannels.filter(c => c.type === 0);

  const [activeTab, setActiveTab] = useState('channels');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<YouTubeChannel | null>(null);

  // Add form
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newNotifChannelId, setNewNotifChannelId] = useState('');
  const [newLiveChannelId, setNewLiveChannelId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  // Settings state
  const [localSettings, setLocalSettings] = useState({
    enabled: true,
    new_video_message: '📺 **{channel}** har uploadet en ny video!',
    embed_color: '#FF0000',
    live_notifications: true,
    live_message: '🔴 **{channel}** er nu LIVE på YouTube!',
    offline_message: '⚫ **{channel}** er gået offline på YouTube.',
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled,
        new_video_message: settings.new_video_message ?? '📺 **{channel}** har uploadet en ny video!',
        embed_color: settings.embed_color ?? '#FF0000',
        live_notifications: settings.live_notifications ?? true,
        live_message: settings.live_message ?? '🔴 **{channel}** er nu LIVE på YouTube!',
        offline_message: settings.offline_message ?? '⚫ **{channel}** er gået offline på YouTube.',
      });
    }
  }, [settings]);

  const handleAddChannel = async () => {
    if (!newChannelId.trim() || !newNotifChannelId) return;
    const success = await addChannel(
      newChannelId.trim(),
      newChannelName.trim(),
      newNotifChannelId,
      newRoleId || undefined,
      newLiveChannelId || undefined
    );
    if (success) {
      setNewChannelId('');
      setNewChannelName('');
      setNewNotifChannelId('');
      setNewLiveChannelId('');
      setNewRoleId('');
      setAddDialogOpen(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!channelToDelete) return;
    await removeChannel(channelToDelete.id);
    setDeleteDialogOpen(false);
    setChannelToDelete(null);
  };

  const handleSaveSettings = () => saveSettings(localSettings);

  const getDiscordChannelName = (id: string) => textChannels.find(c => c.id === id)?.name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <YouTubeIcon className="h-6 w-6 text-destructive" />
            </div>
            YouTube Notifikationer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Få besked når YouTube kanaler uploader nye videoer eller går live
          </p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tilføj Kanal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj YouTube Kanal</DialogTitle>
              <DialogDescription>
                Indtast YouTube kanal-ID (starter med UC) eller kanalnavnet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>YouTube Kanal ID</Label>
                <Input
                  placeholder="f.eks. UCxxxxxxxxxxxxxxxxxxxxxx"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Find kanal-ID via YouTube → Kanal → Om → Del kanal → Kopier kanal-ID
                </p>
              </div>
              <div className="space-y-2">
                <Label>Kanalnavn (valgfrit)</Label>
                <Input
                  placeholder="f.eks. PewDiePie"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Upload Notifikations Kanal</Label>
                <Select value={newNotifChannelId} onValueChange={setNewNotifChannelId}>
                  <SelectTrigger><SelectValue placeholder="Vælg en kanal" /></SelectTrigger>
                  <SelectContent>
                    {textChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}># {ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Live Notifikations Kanal (valgfrit)</Label>
                <Select value={newLiveChannelId || 'same'} onValueChange={(v) => setNewLiveChannelId(v === 'same' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Samme som uploads" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Samme som uploads</SelectItem>
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
              <Button onClick={handleAddChannel} disabled={saving || !newChannelId.trim() || !newNotifChannelId}>
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
              <div className="p-3 rounded-lg bg-destructive/10"><Users className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{channels.length}</p>
                <p className="text-sm text-muted-foreground">Trackede Kanaler</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10"><Video className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{channels.filter(a => a.enabled).length}</p>
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
          <TabsTrigger value="channels" className="gap-2"><Video className="h-4 w-4" />Kanaler</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" />Indstillinger</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><History className="h-4 w-4" />Log</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <YouTubeIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ingen YouTube kanaler tilføjet endnu</p>
                  <p className="text-sm">Klik på "Tilføj Kanal" for at komme i gang</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((ch) => (
                <Card key={ch.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                          <YouTubeIcon className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{ch.channel_name || ch.youtube_channel_id}</CardTitle>
                          <CardDescription>
                            #{getDiscordChannelName(ch.notification_channel_id) || 'unknown'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ch.enabled}
                          onCheckedChange={(enabled) => updateChannel(ch.id, { enabled } as any)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setChannelToDelete(ch); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={ch.enabled ? 'default' : 'secondary'}>
                        {ch.enabled ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                      {ch.is_live && (
                        <Badge variant="destructive" className="animate-pulse">
                          🔴 LIVE
                        </Badge>
                      )}
                      {ch.last_check_at && (
                        <span className="text-xs">Sidst tjekket: {new Date(ch.last_check_at).toLocaleString('da-DK')}</span>
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
                YouTube Indstillinger
              </CardTitle>
              <CardDescription>Tilpas notifikationer for uploads og live streams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aktiver YouTube Notifikationer</Label>
                  <p className="text-sm text-muted-foreground">Slå alle YouTube notifikationer til eller fra</p>
                </div>
                <Switch
                  checked={localSettings.enabled}
                  onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, enabled: checked }))}
                />
              </div>

              <Separator />

              {/* LIVE Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">🔴 LIVE Notifikationer</Label>
                  <p className="text-sm text-muted-foreground">
                    Send besked når en YouTube kanal går live
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
                      placeholder="🔴 **{channel}** er nu LIVE på YouTube!"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Variabler: {'{channel}'}, {'{title}'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Offline Besked</Label>
                    <Textarea
                      value={localSettings.offline_message}
                      onChange={(e) => setLocalSettings(s => ({ ...s, offline_message: e.target.value }))}
                      placeholder="⚫ **{channel}** er gået offline på YouTube."
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
                  placeholder="📺 **{channel}** har uploadet en ny video!"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Variabler: {'{channel}'}, {'{url}'}, {'{title}'}
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
              <CardDescription>Seneste YouTube notifikationer sendt til Discord</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen notifikationer sendt endnu</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.youtube_channel_name || '-'}</TableCell>
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
            <AlertDialogTitle>Fjern YouTube Kanal</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil fjerne {channelToDelete?.channel_name || channelToDelete?.youtube_channel_id}? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChannel}>Fjern</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
