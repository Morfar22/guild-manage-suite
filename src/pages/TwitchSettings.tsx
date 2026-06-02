import { useState, useEffect } from 'react';
import { useTwitchStreamers, TwitchStreamer } from '@/hooks/useTwitchStreamers';
import { useTwitchNotificationLogs } from '@/hooks/useTwitchNotificationLogs';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useDiscordMembers } from '@/hooks/useDiscordMembers';
import { supabase } from '@/integrations/supabase/client';
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
import { TwitchEmbedPreview } from '@/components/twitch/TwitchEmbedPreview';
import { StreamerCard } from '@/components/twitch/StreamerCard';
import { NotificationLogTable } from '@/components/twitch/NotificationLogTable';
import { StreamerFiltersDialog } from '@/components/twitch/StreamerFiltersDialog';
import { StreamScheduleTab } from '@/components/twitch/StreamScheduleTab';
import { 
  Twitch, 
  Plus, 
  Settings2, 
  Radio, 
  Gamepad2,
  Eye,
  ImageIcon,
  Loader2,
  Bell,
  BellOff,
  LayoutGrid,
  List,
  History,
  TrendingUp,
  Users,
  Film,
  Scissors,
  Star,
  Calendar,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PremiumGate } from '@/components/premium/PremiumGate';

export default function TwitchSettings() {
  const { toast } = useToast();
  const { 
    streamers, 
    settings, 
    loading, 
    saving,
    addStreamer, 
    removeStreamer, 
    updateStreamer,
    saveSettings 
  } = useTwitchStreamers();
  
  const { logs, loading: logsLoading } = useTwitchNotificationLogs();
  const { data: channelsData } = useDiscordChannels();
  const { data: rolesData } = useDiscordRoles();
  const { members } = useDiscordMembers();
  
  const channels = channelsData?.channels || [];
  const roles = rolesData || [];
  const textChannels = channels.filter(c => c.type === 0);

  // Sort members alphabetically by display name
  const sortedMembers = [...members].sort((a, b) => {
    const nameA = (a.nick || a.user.global_name || a.user.username || '').toLowerCase();
    const nameB = (b.nick || b.user.global_name || b.user.username || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // UI state
  const [activeTab, setActiveTab] = useState('streamers');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [streamerToDelete, setStreamerToDelete] = useState<TwitchStreamer | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [selectedStreamer, setSelectedStreamer] = useState<TwitchStreamer | null>(null);
  
  // Add streamer form
  const [newUsername, setNewUsername] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newDiscordUserId, setNewDiscordUserId] = useState('');

  // Settings state
  const [localSettings, setLocalSettings] = useState({
    enabled: true,
    live_message: '🔴 **{streamer}** er nu LIVE på Twitch!',
    offline_message: '⚫ **{streamer}** er gået offline.',
    live_embed_color: '#9146FF',
    offline_embed_color: '#6441A5',
    show_game: true,
    show_viewers: true,
    show_thumbnail: true,
    notify_on_offline: true,
    live_role_id: '',
    notify_clips: false,
    notify_vods: false,
    notify_highlights: false,
    clips_channel_id: '',
    vods_channel_id: '',
    highlights_channel_id: '',
    clip_message: '🎬 Nyt clip fra **{streamer}**: **{title}**',
    vod_message: '📺 Ny VOD fra **{streamer}**: **{title}**',
    highlight_message: '⭐ Nyt highlight fra **{streamer}**: **{title}**',
  });

  // Update local settings when settings load
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled,
        live_message: settings.live_message ?? '🔴 **{streamer}** er nu LIVE på Twitch!',
        offline_message: settings.offline_message ?? '⚫ **{streamer}** er gået offline.',
        live_embed_color: settings.live_embed_color ?? '#9146FF',
        offline_embed_color: settings.offline_embed_color ?? '#6441A5',
        show_game: settings.show_game,
        show_viewers: settings.show_viewers,
        show_thumbnail: settings.show_thumbnail,
        notify_on_offline: settings.notify_on_offline,
        live_role_id: (settings as any).live_role_id ?? '',
        notify_clips: settings.notify_clips ?? false,
        notify_vods: settings.notify_vods ?? false,
        notify_highlights: settings.notify_highlights ?? false,
        clips_channel_id: settings.clips_channel_id ?? '',
        vods_channel_id: settings.vods_channel_id ?? '',
        highlights_channel_id: settings.highlights_channel_id ?? '',
        clip_message: settings.clip_message ?? '🎬 Nyt clip fra **{streamer}**: **{title}**',
        vod_message: settings.vod_message ?? '📺 Ny VOD fra **{streamer}**: **{title}**',
        highlight_message: settings.highlight_message ?? '⭐ Nyt highlight fra **{streamer}**: **{title}**',
      });
    }
  }, [settings]);

  // Stats
  const liveCount = streamers.filter(s => s.is_live).length;
  const totalStreamers = streamers.length;
  const totalNotifications = logs.length;

  const handleAddStreamer = async () => {
    if (!newUsername.trim() || !newChannelId) return;
    
    const success = await addStreamer(
      newUsername.trim(),
      newChannelId,
      newRoleId || undefined,
      newDiscordUserId || undefined
    );
    if (success) {
      setNewUsername('');
      setNewChannelId('');
      setNewRoleId('');
      setNewDiscordUserId('');
      setAddDialogOpen(false);
    }
  };

  const handleDeleteStreamer = async () => {
    if (!streamerToDelete) return;
    await removeStreamer(streamerToDelete.id);
    setDeleteDialogOpen(false);
    setStreamerToDelete(null);
  };

  const handleToggleMute = async (streamer: TwitchStreamer) => {
    const currentMuted = (streamer as any).is_muted ?? false;
    await updateStreamer(streamer.id, { is_muted: !currentMuted } as any);
  };

  const handleTestNotification = async (streamer: TwitchStreamer) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Fejl',
          description: 'Du skal være logget ind for at sende test notifikationer.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sender test notifikation...',
        description: `Sender til Discord for ${streamer.display_name || streamer.twitch_username}`,
      });

      const result = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-handler?action=test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ streamer_id: streamer.id }),
        }
      );

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      toast({
        title: 'Test notifikation sendt!',
        description: `En test notifikation er sendt til Discord for ${data.streamer || streamer.display_name || streamer.twitch_username}`,
      });
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: 'Fejl',
        description: error instanceof Error ? error.message : 'Kunne ikke sende test notifikation.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async () => {
    await saveSettings(localSettings);
  };

  const getChannelName = (id: string) => textChannels.find(c => c.id === id)?.name;
  const getRoleName = (id: string | null) => id ? roles.find(r => r.id === id)?.name : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PremiumGate feature="twitch">
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#9146FF]/20">
              <Twitch className="h-6 w-6 text-[#9146FF]" />
            </div>
            Twitch Notifikationer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Få besked når dine favorit-streamere går live
          </p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tilføj Streamer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj Twitch Streamer</DialogTitle>
              <DialogDescription>
                Indtast streamerens brugernavn og vælg hvilken kanal der skal modtage notifikationer.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">Twitch Brugernavn</Label>
                <Input
                  id="username"
                  placeholder="f.eks. shroud"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel">Notifikations Kanal</Label>
                <Select value={newChannelId} onValueChange={setNewChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg en kanal" />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Mention Rolle (valgfrit)</Label>
                <Select value={newRoleId || 'none'} onValueChange={(v) => setNewRoleId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ingen rolle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen rolle</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        @{role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discord-user">Discord Bruger (valgfrit)</Label>
                <Select value={newDiscordUserId || 'none'} onValueChange={(v) => setNewDiscordUserId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ingen Discord bruger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen Discord bruger</SelectItem>
                    {sortedMembers.map((m) => {
                      const display = m.nick || m.user.global_name || m.user.username;
                      return (
                        <SelectItem key={m.user.id} value={m.user.id}>
                          {display} <span className="text-muted-foreground">@{m.user.username}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tildeles automatisk Live Rollen (sættes i Indstillinger) når denne streamer går live.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleAddStreamer} disabled={saving || !newUsername.trim() || !newChannelId}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tilføj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStreamers}</p>
                <p className="text-sm text-muted-foreground">Trackede Streamere</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <Radio className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveCount}</p>
                <p className="text-sm text-muted-foreground">Live Nu</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#9146FF]/10">
                <TrendingUp className="h-5 w-5 text-[#9146FF]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalNotifications}</p>
                <p className="text-sm text-muted-foreground">Notifikationer Sendt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="streamers" className="gap-2">
            <Radio className="h-4 w-4" />
            Streamere
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Indstillinger
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            Skema
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            Log
          </TabsTrigger>
        </TabsList>

        {/* Streamers Tab */}
        <TabsContent value="streamers" className="space-y-4">
          {/* View mode toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {streamers.length} streamer{streamers.length !== 1 ? 'e' : ''} trackes
            </p>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {streamers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Twitch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ingen streamere tilføjet endnu</p>
                  <p className="text-sm">Klik på "Tilføj Streamer" for at komme i gang</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' 
                : 'space-y-3'
            }>
              {streamers.map((streamer) => (
                <StreamerCard
                  key={streamer.id}
                  streamer={streamer as any}
                  channelName={getChannelName(streamer.notification_channel_id)}
                  roleName={getRoleName(streamer.mention_role_id)}
                  onEdit={() => {
                    setSelectedStreamer(streamer);
                    setFiltersDialogOpen(true);
                  }}
                  onDelete={() => {
                    setStreamerToDelete(streamer);
                    setDeleteDialogOpen(true);
                  }}
                  onToggleMute={() => handleToggleMute(streamer)}
                  onTestNotification={() => handleTestNotification(streamer)}
                  onConfigureFilters={() => {
                    setSelectedStreamer(streamer);
                    setFiltersDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Notifikations Indstillinger
                </CardTitle>
                <CardDescription>
                  Tilpas hvordan notifikationer ser ud og hvad de indeholder
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Aktiver Twitch Notifikationer</Label>
                    <p className="text-sm text-muted-foreground">
                      Slå alle Twitch notifikationer til eller fra
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.enabled}
                    onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, enabled: checked }))}
                  />
                </div>

                <Separator />

                {/* Messages */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Beskeder
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="live-message">Live Besked</Label>
                    <Textarea
                      id="live-message"
                      placeholder="🔴 **{streamer}** er nu LIVE på Twitch!"
                      value={localSettings.live_message}
                      onChange={(e) => setLocalSettings(s => ({ ...s, live_message: e.target.value }))}
                      className="min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Brug {'{streamer}'} for streamerens navn
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offline-message">Offline Besked</Label>
                    <Textarea
                      id="offline-message"
                      placeholder="⚫ **{streamer}** er gået offline."
                      value={localSettings.offline_message}
                      onChange={(e) => setLocalSettings(s => ({ ...s, offline_message: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <Separator />

                {/* Colors */}
                <div className="space-y-4">
                  <h4 className="font-medium">Embed Farver</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="live-color">Live Farve</Label>
                      <div className="flex gap-2">
                        <Input
                          id="live-color"
                          type="color"
                          value={localSettings.live_embed_color}
                          onChange={(e) => setLocalSettings(s => ({ ...s, live_embed_color: e.target.value }))}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={localSettings.live_embed_color}
                          onChange={(e) => setLocalSettings(s => ({ ...s, live_embed_color: e.target.value }))}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="offline-color">Offline Farve</Label>
                      <div className="flex gap-2">
                        <Input
                          id="offline-color"
                          type="color"
                          value={localSettings.offline_embed_color}
                          onChange={(e) => setLocalSettings(s => ({ ...s, offline_embed_color: e.target.value }))}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={localSettings.offline_embed_color}
                          onChange={(e) => setLocalSettings(s => ({ ...s, offline_embed_color: e.target.value }))}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Display Options */}
                <div className="space-y-4">
                  <h4 className="font-medium">Vis Indstillinger</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                        <Label>Vis Spil</Label>
                      </div>
                      <Switch
                        checked={localSettings.show_game}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, show_game: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <Label>Vis Seere</Label>
                      </div>
                      <Switch
                        checked={localSettings.show_viewers}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, show_viewers: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <Label>Vis Thumbnail</Label>
                      </div>
                      <Switch
                        checked={localSettings.show_thumbnail}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, show_thumbnail: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                        <Label>Offline Notifikationer</Label>
                      </div>
                      <Switch
                        checked={localSettings.notify_on_offline}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, notify_on_offline: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Live Role */}
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <h4 className="font-medium flex items-center gap-2">
                      <Radio className="h-4 w-4 text-[#9146FF]" />
                      Live Rolle
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Rollen tildeles automatisk en streamer når de går live på Twitch, og fjernes igen når de går offline. Husk at koble en Discord bruger til hver streamer.
                    </p>
                  </div>
                  <Select
                    value={localSettings.live_role_id || 'none'}
                    onValueChange={(v) => setLocalSettings(s => ({ ...s, live_role_id: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ingen live rolle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen live rolle</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          @{role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    💡 Botten skal have <span className="font-mono">Manage Roles</span> tilladelse, og live-rollen skal være under botten's højeste rolle.
                  </p>
                </div>

                <Separator />

                {/* Content Notifications (Clips, VODs, Highlights) */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Indhold Notifikationer
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Få besked når streamere poster nye clips, VODs eller highlights
                  </p>

                  <div className="space-y-4">
                    {/* Clips */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors className="h-4 w-4 text-muted-foreground" />
                        <Label>Clips</Label>
                      </div>
                      <Switch
                        checked={localSettings.notify_clips}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, notify_clips: checked }))}
                      />
                    </div>

                    {/* VODs */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Film className="h-4 w-4 text-muted-foreground" />
                        <Label>VODs</Label>
                      </div>
                      <Switch
                        checked={localSettings.notify_vods}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, notify_vods: checked }))}
                      />
                    </div>

                    {/* Highlights */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <Label>Highlights</Label>
                      </div>
                      <Switch
                        checked={localSettings.notify_highlights}
                        onCheckedChange={(checked) => setLocalSettings(s => ({ ...s, notify_highlights: checked }))}
                      />
                    </div>
                  </div>

                  {/* Channel selections */}
                  {(localSettings.notify_clips || localSettings.notify_vods || localSettings.notify_highlights) && (
                    <div className="space-y-4 pt-2">
                      {localSettings.notify_clips && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Scissors className="h-3.5 w-3.5" />
                            Clips Kanal
                          </Label>
                          <Select 
                            value={localSettings.clips_channel_id || 'none'} 
                            onValueChange={(v) => setLocalSettings(s => ({ ...s, clips_channel_id: v === 'none' ? '' : v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Vælg en kanal til clips" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen (brug per-streamer)</SelectItem>
                              {textChannels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  # {channel.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {localSettings.notify_vods && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Film className="h-3.5 w-3.5" />
                            VODs Kanal
                          </Label>
                          <Select 
                            value={localSettings.vods_channel_id || 'none'} 
                            onValueChange={(v) => setLocalSettings(s => ({ ...s, vods_channel_id: v === 'none' ? '' : v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Vælg en kanal til VODs" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen (brug per-streamer)</SelectItem>
                              {textChannels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  # {channel.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {localSettings.notify_highlights && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5" />
                            Highlights Kanal
                          </Label>
                          <Select 
                            value={localSettings.highlights_channel_id || 'none'} 
                            onValueChange={(v) => setLocalSettings(s => ({ ...s, highlights_channel_id: v === 'none' ? '' : v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Vælg en kanal til highlights" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen (brug per-streamer)</SelectItem>
                              {textChannels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  # {channel.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Separator />

                      {/* Custom messages */}
                      <div className="space-y-2">
                        <Label>Clip Besked</Label>
                        <Textarea
                          placeholder="🎬 Nyt clip fra **{streamer}**: **{title}**"
                          value={localSettings.clip_message}
                          onChange={(e) => setLocalSettings(s => ({ ...s, clip_message: e.target.value }))}
                          className="min-h-[60px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Variabler: {'{streamer}'}, {'{title}'}, {'{url}'}, {'{creator}'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>VOD Besked</Label>
                        <Textarea
                          placeholder="📺 Ny VOD fra **{streamer}**: **{title}**"
                          value={localSettings.vod_message}
                          onChange={(e) => setLocalSettings(s => ({ ...s, vod_message: e.target.value }))}
                          className="min-h-[60px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Highlight Besked</Label>
                        <Textarea
                          placeholder="⭐ Nyt highlight fra **{streamer}**: **{title}**"
                          value={localSettings.highlight_message}
                          onChange={(e) => setLocalSettings(s => ({ ...s, highlight_message: e.target.value }))}
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Gem Indstillinger
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Live Preview
                </CardTitle>
                <CardDescription>
                  Se hvordan dine notifikationer vil se ud i Discord
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="live" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="live" className="flex items-center gap-2">
                      <Radio className="h-3 w-3" />
                      Live
                    </TabsTrigger>
                    <TabsTrigger value="offline" className="flex items-center gap-2">
                      <BellOff className="h-3 w-3" />
                      Offline
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="live" className="mt-0">
                    <div className="rounded-lg bg-[#313338] p-4 -mx-2">
                      <TwitchEmbedPreview
                        streamerName={streamers[0]?.display_name || 'ExampleStreamer'}
                        streamerAvatar={streamers[0]?.profile_image_url}
                        liveMessage={localSettings.live_message}
                        streamTitle="Just a chill stream! Come hang out 🎮"
                        gameName="Just Chatting"
                        viewerCount={1234}
                        embedColor={localSettings.live_embed_color}
                        showGame={localSettings.show_game}
                        showViewers={localSettings.show_viewers}
                        showThumbnail={localSettings.show_thumbnail}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="offline" className="mt-0">
                    <div className="rounded-lg bg-[#313338] p-4 -mx-2">
                      <TwitchEmbedPreview
                        streamerName={streamers[0]?.display_name || 'ExampleStreamer'}
                        streamerAvatar={streamers[0]?.profile_image_url}
                        liveMessage={localSettings.live_message}
                        offlineMessage={localSettings.offline_message}
                        embedColor={localSettings.offline_embed_color}
                        showGame={false}
                        showViewers={false}
                        showThumbnail={false}
                        isOffline
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <p className="text-xs text-muted-foreground mt-4">
                  💡 Preview opdateres automatisk når du ændrer indstillinger
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <StreamScheduleTab streamers={streamers} textChannels={textChannels} />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Notifikations Log
              </CardTitle>
              <CardDescription>
                Historik over sendte notifikationer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationLogTable logs={logs} loading={logsLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern streamer?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil stoppe med at tracke {streamerToDelete?.display_name || streamerToDelete?.twitch_username}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStreamer}>
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters Dialog */}
      <StreamerFiltersDialog
        streamer={selectedStreamer as any}
        open={filtersDialogOpen}
        onOpenChange={setFiltersDialogOpen}
        onSave={(updates) => updateStreamer(selectedStreamer!.id, updates)}
        saving={saving}
      />
    </div>
    </PremiumGate>
  );
}
