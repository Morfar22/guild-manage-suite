import { useState } from 'react';
import { 
  Gamepad2, 
  Users, 
  Clock, 
  Shield, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Search,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Ban,
  Activity,
  History,
  Key,
  Wifi,
  MapPin,
  Terminal
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useToast } from '@/hooks/use-toast';
import { 
  useFiveMSettings, 
  useUpdateFiveMSettings, 
  useFiveMWhitelist, 
  useAddToWhitelist,
  useUpdateWhitelistEntry,
  useRemoveFromWhitelist,
  useFiveMStats,
  useFiveMBans,
  useAddBan,
  useUnban,
  useFiveMOnlinePlayers,
  useFiveMActionLogs,
  useFiveMRolePermissions,
  useUpdateRolePermission,
  useDeleteRolePermission,
  type FiveMWhitelistEntry
} from '@/hooks/useFiveM';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import CommandPanel from '@/components/fivem/CommandPanel';
import ServerStatusWidget from '@/components/fivem/ServerStatusWidget';
import { PremiumGate } from '@/components/premium/PremiumGate';

export default function FiveMSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useFiveMSettings();
  const { data: whitelist, isLoading: whitelistLoading } = useFiveMWhitelist();
  const { data: roles } = useDiscordRoles();
  const { data: bans, isLoading: bansLoading } = useFiveMBans();
  const { data: onlinePlayers, isLoading: playersLoading } = useFiveMOnlinePlayers();
  const { data: actionLogs, isLoading: logsLoading } = useFiveMActionLogs();
  const { data: rolePermissions, isLoading: permissionsLoading } = useFiveMRolePermissions();
  
  const updateSettings = useUpdateFiveMSettings();
  const addToWhitelist = useAddToWhitelist();
  const updateWhitelistEntry = useUpdateWhitelistEntry();
  const removeFromWhitelist = useRemoveFromWhitelist();
  const addBan = useAddBan();
  const unban = useUnban();
  const updateRolePermission = useUpdateRolePermission();
  const deleteRolePermission = useDeleteRolePermission();
  const stats = useFiveMStats();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  
  const [newEntry, setNewEntry] = useState({
    discord_user_id: '',
    discord_username: '',
    steam_hex: '',
    notes: '',
  });

  const [newBan, setNewBan] = useState({
    discord_user_id: '',
    discord_username: '',
    steam_hex: '',
    reason: '',
    duration: 'permanent',
    banned_by_discord_id: 'dashboard',
    banned_by_name: 'Dashboard',
  });

  const [newPermission, setNewPermission] = useState({
    discord_role_id: '',
    discord_role_name: '',
    permission_level: 'user' as string,
    ace_permissions: '',
  });

  const filteredWhitelist = whitelist?.filter(entry => 
    entry.discord_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.discord_user_id.includes(searchQuery) ||
    entry.steam_hex?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBans = bans?.filter(b => b.is_active);

  const handleSettingsUpdate = async (key: string, value: unknown) => {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast({ title: 'Indstillinger gemt' });
    } catch {
      toast({ title: 'Fejl ved gemning', variant: 'destructive' });
    }
  };

  const handleAddPlayer = async () => {
    if (!newEntry.discord_user_id) {
      toast({ title: 'Discord ID er påkrævet', variant: 'destructive' });
      return;
    }

    try {
      await addToWhitelist.mutateAsync({
        discord_user_id: newEntry.discord_user_id,
        discord_username: newEntry.discord_username || null,
        steam_hex: newEntry.steam_hex || null,
        notes: newEntry.notes || null,
        is_whitelisted: true,
        whitelisted_at: new Date().toISOString(),
      });
      toast({ title: 'Spiller tilføjet til whitelist' });
      setIsAddDialogOpen(false);
      setNewEntry({ discord_user_id: '', discord_username: '', steam_hex: '', notes: '' });
    } catch {
      toast({ title: 'Fejl ved tilføjelse', variant: 'destructive' });
    }
  };

  const handleAddBan = async () => {
    if (!newBan.discord_user_id || !newBan.reason) {
      toast({ title: 'Discord ID og årsag er påkrævet', variant: 'destructive' });
      return;
    }

    let expiresAt: string | null = null;
    if (newBan.duration !== 'permanent') {
      const now = new Date();
      const durationMap: Record<string, number> = {
        '1h': 3600000,
        '1d': 86400000,
        '7d': 604800000,
        '30d': 2592000000,
      };
      expiresAt = new Date(now.getTime() + (durationMap[newBan.duration] || 0)).toISOString();
    }

    try {
      await addBan.mutateAsync({
        discord_user_id: newBan.discord_user_id,
        discord_username: newBan.discord_username || null,
        steam_hex: newBan.steam_hex || null,
        license: null,
        ip_address: null,
        reason: newBan.reason,
        banned_by_discord_id: newBan.banned_by_discord_id,
        banned_by_name: newBan.banned_by_name,
        expires_at: expiresAt,
      });
      toast({ title: 'Ban tilføjet' });
      setIsBanDialogOpen(false);
      setNewBan({
        discord_user_id: '',
        discord_username: '',
        steam_hex: '',
        reason: '',
        duration: 'permanent',
        banned_by_discord_id: 'dashboard',
        banned_by_name: 'Dashboard',
      });
    } catch {
      toast({ title: 'Fejl ved ban', variant: 'destructive' });
    }
  };

  const handleUnban = async (id: string) => {
    try {
      await unban.mutateAsync({ id, unbannedBy: 'Dashboard' });
      toast({ title: 'Spiller unbanned' });
    } catch {
      toast({ title: 'Fejl ved unban', variant: 'destructive' });
    }
  };

  const handleAddPermission = async () => {
    if (!newPermission.discord_role_id) {
      toast({ title: 'Vælg en rolle', variant: 'destructive' });
      return;
    }

    const role = roles?.find(r => r.id === newPermission.discord_role_id);

    try {
      await updateRolePermission.mutateAsync({
        discord_role_id: newPermission.discord_role_id,
        discord_role_name: role?.name || null,
        permission_level: newPermission.permission_level,
        ace_permissions: newPermission.ace_permissions 
          ? newPermission.ace_permissions.split(',').map(s => s.trim()) 
          : null,
      });
      toast({ title: 'Rolle permission opdateret' });
      setIsPermissionDialogOpen(false);
      setNewPermission({ discord_role_id: '', discord_role_name: '', permission_level: 'user', ace_permissions: '' });
    } catch {
      toast({ title: 'Fejl ved opdatering', variant: 'destructive' });
    }
  };

  const handleToggleWhitelist = async (entry: FiveMWhitelistEntry) => {
    try {
      await updateWhitelistEntry.mutateAsync({
        id: entry.id,
        is_whitelisted: !entry.is_whitelisted,
        whitelisted_at: !entry.is_whitelisted ? new Date().toISOString() : null,
      });
      toast({ 
        title: entry.is_whitelisted 
          ? 'Spiller fjernet fra whitelist' 
          : 'Spiller tilføjet til whitelist' 
      });
    } catch {
      toast({ title: 'Fejl ved opdatering', variant: 'destructive' });
    }
  };

  const handleRemovePlayer = async (id: string) => {
    try {
      await removeFromWhitelist.mutateAsync(id);
      toast({ title: 'Spiller slettet' });
    } catch {
      toast({ title: 'Fejl ved sletning', variant: 'destructive' });
    }
  };

  const formatPlaytime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}t ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('da-DK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'ban': return 'destructive';
      case 'kick': return 'secondary';
      case 'kill': return 'destructive';
      case 'revive': return 'default';
      case 'announcement': return 'outline';
      default: return 'secondary';
    }
  };

  const getPermissionBadgeVariant = (level: string) => {
    switch (level) {
      case 'god': return 'destructive';
      case 'admin': return 'default';
      case 'mod': return 'secondary';
      default: return 'outline';
    }
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <PremiumGate feature="fivem">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-primary" />
            FiveM Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Whitelist, moderation og synkronisering mellem Discord og FiveM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="fivem-enabled">Aktivér FiveM</Label>
          <Switch
            id="fivem-enabled"
            checked={settings?.enabled ?? false}
            onCheckedChange={(checked) => handleSettingsUpdate('enabled', checked)}
          />
        </div>
      </div>

      {/* Server Status Widget */}
      <ServerStatusWidget />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Wifi className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.onlineCount}</div>
                <div className="text-sm text-muted-foreground">Online</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalPlayers}</div>
                <div className="text-sm text-muted-foreground">Registreret</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.whitelistedPlayers}</div>
                <div className="text-sm text-muted-foreground">Whitelistede</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.pendingPlayers}</div>
                <div className="text-sm text-muted-foreground">Afventer</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Ban className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.activeBans}</div>
                <div className="text-sm text-muted-foreground">Bans</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Gamepad2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatPlaytime(stats.totalPlaytime)}</div>
                <div className="text-sm text-muted-foreground">Spilletid</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commands" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="commands">
            <Terminal className="h-4 w-4 mr-2" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="online">
            <Activity className="h-4 w-4 mr-2" />
            Online ({stats.onlineCount})
          </TabsTrigger>
          <TabsTrigger value="whitelist">
            <Shield className="h-4 w-4 mr-2" />
            Whitelist
          </TabsTrigger>
          <TabsTrigger value="bans">
            <Ban className="h-4 w-4 mr-2" />
            Bans ({stats.activeBans})
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Key className="h-4 w-4 mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Indstillinger
          </TabsTrigger>
        </TabsList>

        {/* Commands Tab */}
        <TabsContent value="commands">
          <CommandPanel />
        </TabsContent>

        {/* Online Players Tab */}
        <TabsContent value="online" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Online Spillere
              </CardTitle>
              <CardDescription>
                Live oversigt over spillere på serveren (opdateres automatisk)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playersLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : onlinePlayers?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen spillere online</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Spiller</TableHead>
                      <TableHead>Karakter</TableHead>
                      <TableHead>Ping</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Tilsluttet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onlinePlayers?.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <Badge variant="outline">{player.player_id}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{player.discord_username || 'Ukendt'}</div>
                            <div className="text-xs text-muted-foreground">{player.discord_user_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>{player.character_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={player.ping && player.ping > 100 ? 'destructive' : 'secondary'}>
                            {player.ping || 0}ms
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {player.coords ? (
                            <span className="text-xs font-mono flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {Math.round(player.coords.x)}, {Math.round(player.coords.y)}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(player.joined_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Whitelist Tab */}
        <TabsContent value="whitelist" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Whitelist Administration</CardTitle>
                  <CardDescription>
                    Administrer hvem der har adgang til din FiveM server
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Tilføj Spiller
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tilføj til Whitelist</DialogTitle>
                      <DialogDescription>
                        Tilføj en ny spiller til whitelisten
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="discord_user_id">Discord User ID *</Label>
                        <Input
                          id="discord_user_id"
                          placeholder="123456789012345678"
                          value={newEntry.discord_user_id}
                          onChange={(e) => setNewEntry({ ...newEntry, discord_user_id: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="discord_username">Discord Brugernavn</Label>
                        <Input
                          id="discord_username"
                          placeholder="username"
                          value={newEntry.discord_username}
                          onChange={(e) => setNewEntry({ ...newEntry, discord_username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="steam_hex">Steam Hex ID</Label>
                        <Input
                          id="steam_hex"
                          placeholder="steam:1100001xxxxxxxx"
                          value={newEntry.steam_hex}
                          onChange={(e) => setNewEntry({ ...newEntry, steam_hex: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Noter</Label>
                        <Textarea
                          id="notes"
                          placeholder="Evt. noter om spilleren..."
                          value={newEntry.notes}
                          onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Annuller
                      </Button>
                      <Button onClick={handleAddPlayer} disabled={addToWhitelist.isPending}>
                        {addToWhitelist.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Tilføj
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg efter Discord ID, brugernavn eller Steam Hex..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {whitelistLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : filteredWhitelist?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen spillere fundet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spiller</TableHead>
                      <TableHead>Steam Hex</TableHead>
                      <TableHead>Spilletid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sidst Set</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWhitelist?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.discord_username || 'Ukendt'}</div>
                            <div className="text-xs text-muted-foreground">{entry.discord_user_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {entry.steam_hex || 'Ikke registreret'}
                          </code>
                        </TableCell>
                        <TableCell>{formatPlaytime(entry.playtime_minutes)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.is_whitelisted ? 'default' : 'secondary'}>
                            {entry.is_whitelisted ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Whitelistet</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Afventer</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.last_seen_at 
                            ? new Date(entry.last_seen_at).toLocaleDateString('da-DK')
                            : 'Aldrig'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleWhitelist(entry)}
                            >
                              {entry.is_whitelisted ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Slet spiller?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på at du vil slette {entry.discord_username || entry.discord_user_id}? 
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemovePlayer(entry.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Slet
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bans Tab */}
        <TabsContent value="bans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-red-500" />
                    Ban Administration
                  </CardTitle>
                  <CardDescription>Administrer bannede spillere</CardDescription>
                </div>
                <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Ban className="h-4 w-4 mr-2" />
                      Tilføj Ban
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ban Spiller</DialogTitle>
                      <DialogDescription>Tilføj en ny ban</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Discord User ID *</Label>
                        <Input
                          placeholder="123456789012345678"
                          value={newBan.discord_user_id}
                          onChange={(e) => setNewBan({ ...newBan, discord_user_id: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Discord Brugernavn</Label>
                        <Input
                          placeholder="username"
                          value={newBan.discord_username}
                          onChange={(e) => setNewBan({ ...newBan, discord_username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Årsag *</Label>
                        <Textarea
                          placeholder="Årsag til ban..."
                          value={newBan.reason}
                          onChange={(e) => setNewBan({ ...newBan, reason: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Varighed</Label>
                        <Select value={newBan.duration} onValueChange={(v) => setNewBan({ ...newBan, duration: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1h">1 time</SelectItem>
                            <SelectItem value="1d">1 dag</SelectItem>
                            <SelectItem value="7d">7 dage</SelectItem>
                            <SelectItem value="30d">30 dage</SelectItem>
                            <SelectItem value="permanent">Permanent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBanDialogOpen(false)}>Annuller</Button>
                      <Button variant="destructive" onClick={handleAddBan} disabled={addBan.isPending}>
                        {addBan.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
                        Ban
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {bansLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : activeBans?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen aktive bans</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spiller</TableHead>
                      <TableHead>Årsag</TableHead>
                      <TableHead>Banned af</TableHead>
                      <TableHead>Udløber</TableHead>
                      <TableHead className="text-right">Handling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeBans?.map((ban) => (
                      <TableRow key={ban.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{ban.discord_username || 'Ukendt'}</div>
                            <div className="text-xs text-muted-foreground">{ban.discord_user_id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{ban.reason}</TableCell>
                        <TableCell>{ban.banned_by_name || ban.banned_by_discord_id}</TableCell>
                        <TableCell>
                          {ban.expires_at ? (
                            <Badge variant="secondary">{formatDate(ban.expires_at)}</Badge>
                          ) : (
                            <Badge variant="destructive">Permanent</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleUnban(ban.id)}>
                            Unban
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Action Logs
              </CardTitle>
              <CardDescription>Seneste moderation handlinger</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : actionLogs?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen logs endnu</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Handling</TableHead>
                      <TableHead>Mål</TableHead>
                      <TableHead>Moderator</TableHead>
                      <TableHead>Årsag</TableHead>
                      <TableHead>Tidspunkt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action_type)}>
                            {log.action_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.target_name || log.target_discord_id || '-'}</TableCell>
                        <TableCell>{log.moderator_name || log.moderator_discord_id}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.reason || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Rolle Permissions
                  </CardTitle>
                  <CardDescription>Map Discord roller til FiveM permissions og ACE</CardDescription>
                </div>
                <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Tilføj Rolle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tilføj Rolle Permission</DialogTitle>
                      <DialogDescription>Map en Discord rolle til FiveM permissions</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Discord Rolle</Label>
                        <Select 
                          value={newPermission.discord_role_id} 
                          onValueChange={(v) => setNewPermission({ ...newPermission, discord_role_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg rolle..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Permission Level</Label>
                        <Select 
                          value={newPermission.permission_level} 
                          onValueChange={(v) => setNewPermission({ ...newPermission, permission_level: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="mod">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="god">God (Owner)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>ACE Permissions (kommasepareret)</Label>
                        <Input
                          placeholder="command.kick, command.ban, ..."
                          value={newPermission.ace_permissions}
                          onChange={(e) => setNewPermission({ ...newPermission, ace_permissions: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Disse ACE permissions gives automatisk til spillere med denne rolle
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>Annuller</Button>
                      <Button onClick={handleAddPermission} disabled={updateRolePermission.isPending}>
                        {updateRolePermission.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                        Tilføj
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : rolePermissions?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen rolle permissions konfigureret</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Permission Level</TableHead>
                      <TableHead>ACE Permissions</TableHead>
                      <TableHead className="text-right">Handling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolePermissions?.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell className="font-medium">{perm.discord_role_name || perm.discord_role_id}</TableCell>
                        <TableCell>
                          <Badge variant={getPermissionBadgeVariant(perm.permission_level)}>
                            {perm.permission_level.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {perm.ace_permissions?.slice(0, 3).map((ace, i) => (
                              <code key={i} className="text-xs bg-muted px-1 rounded">{ace}</code>
                            ))}
                            {perm.ace_permissions && perm.ace_permissions.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{perm.ace_permissions.length - 3} mere</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteRolePermission.mutateAsync(perm.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Information</CardTitle>
              <CardDescription>Indstillinger for din FiveM server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="server_name">Server Navn</Label>
                  <Input
                    id="server_name"
                    placeholder="Min FiveM Server"
                    defaultValue={settings?.server_name || ''}
                    onBlur={(e) => handleSettingsUpdate('server_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server_ip">Server IP</Label>
                  <Input
                    id="server_ip"
                    placeholder="123.456.789.0:30120"
                    defaultValue={settings?.server_ip || ''}
                    onBlur={(e) => handleSettingsUpdate('server_ip', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfx_code">CFX Join Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="cfx_code"
                    placeholder="cfx.re/join/xxxxxx"
                    defaultValue={settings?.cfx_code || ''}
                    onBlur={(e) => handleSettingsUpdate('cfx_code', e.target.value)}
                  />
                  {settings?.cfx_code && (
                    <Button variant="outline" asChild>
                      <a href={`https://${settings.cfx_code}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Whitelist Indstillinger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Whitelist Påkrævet</Label>
                  <p className="text-sm text-muted-foreground">Spillere skal være whitelistet for at joine</p>
                </div>
                <Switch
                  checked={settings?.whitelist_enabled ?? true}
                  onCheckedChange={(checked) => handleSettingsUpdate('whitelist_enabled', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label>Auto-Whitelist Rolle</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings?.auto_whitelist_role_id || ''}
                  onChange={(e) => handleSettingsUpdate('auto_whitelist_role_id', e.target.value || null)}
                >
                  <option value="">Ingen (manuel whitelist)</option>
                  {roles?.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Log Kanal</Label>
                <ChannelSelect
                  value={settings?.log_channel_id || ''}
                  onValueChange={(value) => handleSettingsUpdate('log_channel_id', value || null)}
                  placeholder="Vælg kanal til logs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Discord Status Embed
              </CardTitle>
              <CardDescription>
                Send live server status til Discord (ligesom txAdmin)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status_webhook">Discord Webhook URL</Label>
                <Input
                  id="status_webhook"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  defaultValue={settings?.status_webhook_url || ''}
                  onBlur={(e) => handleSettingsUpdate('status_webhook_url', e.target.value || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Opret en webhook i din Discord kanal → Rediger kanal → Integrationer → Webhooks → Ny webhook
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium mb-2">Status embed inkluderer:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>🟢 Online/Offline status</li>
                  <li>👥 Spillerantal med progress bar</li>
                  <li>⏱️ Server uptime</li>
                  <li>🗺️ Current map</li>
                  <li>📦 Loaded resources</li>
                  <li>🔗 Connect info</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Synkronisering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Synkroniser Discord Roller</Label>
                  <p className="text-sm text-muted-foreground">Synkroniser Discord roller til FiveM ACE permissions</p>
                </div>
                <Switch
                  checked={settings?.sync_discord_roles ?? true}
                  onCheckedChange={(checked) => handleSettingsUpdate('sync_discord_roles', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Track Spilletid</Label>
                  <p className="text-sm text-muted-foreground">Hold styr på spilletid</p>
                </div>
                <Switch
                  checked={settings?.sync_playtime ?? true}
                  onCheckedChange={(checked) => handleSettingsUpdate('sync_playtime', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </PremiumGate>
  );
}
