import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLeaderboard, useLevelRoles, useLevelingSettings } from '@/hooks/useLeveling';
import { useXPMultipliers } from '@/hooks/useXPMultipliers';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
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
import { ChannelSelect } from '@/components/ui/channel-select';
import { Trophy, Settings, Star, Plus, Trash2, Medal, Award, Crown, Send, Loader2, Zap, VolumeX, Mic, Hash, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function xpForLevel(level: number): number {
  return Math.pow((level - 1) * 10, 2);
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1: return <Crown className="h-5 w-5 text-primary" />;
    case 2: return <Medal className="h-5 w-5 text-muted-foreground" />;
    case 3: return <Award className="h-5 w-5 text-accent-foreground" />;
    default: return <span className="text-muted-foreground font-mono">#{rank}</span>;
  }
}

export default function Leveling() {
  const { selectedGuild } = useGuild();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();
  const { data: levelRoles, isLoading: rolesLoading, addLevelRole, deleteLevelRole } = useLevelRoles();
  const { data: settings, isLoading: settingsLoading, updateSettings } = useLevelingSettings();
  const { data: multipliers, isLoading: multipliersLoading, addMultiplier, updateMultiplier, deleteMultiplier } = useXPMultipliers();
  const { data: discordRoles } = useDiscordRoles();
  const { data: channelsData } = useDiscordChannels();
  const { toast } = useToast();

  const [newRoleLevel, setNewRoleLevel] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Multiplier form state
  const [newMultiplierName, setNewMultiplierName] = useState('');
  const [newMultiplierType, setNewMultiplierType] = useState<'role' | 'channel' | 'global'>('role');
  const [newMultiplierTargetId, setNewMultiplierTargetId] = useState('');
  const [newMultiplierValue, setNewMultiplierValue] = useState('1.5');

  const [localSettings, setLocalSettings] = useState<{
    enabled?: boolean;
    xp_per_message_min?: number;
    xp_per_message_max?: number;
    cooldown_seconds?: number;
    level_up_channel_id?: string;
    level_up_message?: string;
    blacklist_channels?: string[];
    voice_xp_enabled?: boolean;
    voice_xp_per_minute?: number;
    voice_xp_cooldown_seconds?: number;
  }>({});

  const currentSettings = {
    enabled: localSettings.enabled ?? settings?.enabled ?? true,
    xp_per_message_min: localSettings.xp_per_message_min ?? settings?.xp_per_message_min ?? 15,
    xp_per_message_max: localSettings.xp_per_message_max ?? settings?.xp_per_message_max ?? 25,
    cooldown_seconds: localSettings.cooldown_seconds ?? settings?.cooldown_seconds ?? 60,
    level_up_channel_id: localSettings.level_up_channel_id ?? settings?.level_up_channel_id ?? '',
    level_up_message: localSettings.level_up_message ?? settings?.level_up_message ?? 'Congratulations {user}! You are now level {level}! 🎉',
    blacklist_channels: localSettings.blacklist_channels ?? settings?.blacklist_channels ?? [],
    voice_xp_enabled: localSettings.voice_xp_enabled ?? settings?.voice_xp_enabled ?? false,
    voice_xp_per_minute: localSettings.voice_xp_per_minute ?? settings?.voice_xp_per_minute ?? 5,
    voice_xp_cooldown_seconds: localSettings.voice_xp_cooldown_seconds ?? settings?.voice_xp_cooldown_seconds ?? 60,
  };

  const handleAddLevelRole = () => {
    const level = parseInt(newRoleLevel);
    if (!level || !newRoleId) return;

    const role = discordRoles?.find(r => r.id === newRoleId);
    addLevelRole.mutate({
      level_required: level,
      role_id: newRoleId,
      role_name: role?.name || 'Unknown Role',
    });
    setNewRoleLevel('');
    setNewRoleId('');
  };

  const handleAddMultiplier = () => {
    if (!newMultiplierName || !newMultiplierValue) return;
    if (newMultiplierType !== 'global' && !newMultiplierTargetId) return;

    addMultiplier.mutate({
      name: newMultiplierName,
      multiplier_type: newMultiplierType,
      target_id: newMultiplierType === 'global' ? null : newMultiplierTargetId,
      multiplier: parseFloat(newMultiplierValue),
    });

    setNewMultiplierName('');
    setNewMultiplierType('role');
    setNewMultiplierTargetId('');
    setNewMultiplierValue('1.5');
  };

  const handleToggleBlacklistChannel = (channelId: string) => {
    const current = currentSettings.blacklist_channels || [];
    const updated = current.includes(channelId)
      ? current.filter(id => id !== channelId)
      : [...current, channelId];
    setLocalSettings({ ...localSettings, blacklist_channels: updated });
  };

  const handleSaveSettings = () => {
    updateSettings.mutate(currentSettings);
    setLocalSettings({});
  };

  const handleTestLevelUp = async () => {
    if (!selectedGuild?.id) {
      toast({ title: 'Error', description: 'No server selected.', variant: 'destructive' });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('xp-handler', {
        body: { action: 'testLevelUp', guildId: selectedGuild.id, username: 'TestUser', level: 5 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Test sent!', description: 'Check the level-up channel on Discord.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Could not send test message.', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Vælg en server først</p>
      </div>
    );
  }

  const textChannels = channelsData?.channels?.filter(c => c.type === 0) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leveling-system</h1>
          <p className="text-muted-foreground">Administrer XP, niveauer og niveau-roller for din server</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleTestLevelUp} 
          disabled={isTesting || !currentSettings.enabled || !currentSettings.level_up_channel_id}
          title={!currentSettings.level_up_channel_id ? 'Vælg en level-up kanal først' : undefined}
        >
          {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Test Level-up
        </Button>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            Rangliste
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Star className="h-4 w-4" />
            Niveau-roller
          </TabsTrigger>
          <TabsTrigger value="multipliers" className="gap-2">
            <Zap className="h-4 w-4" />
            XP-multiplikatorer
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Indstillinger
          </TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Top 100 Rangliste
              </CardTitle>
              <CardDescription>
                Se hvem der har mest XP på serveren
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rang</TableHead>
                      <TableHead>Bruger</TableHead>
                      <TableHead className="text-right">Niveau</TableHead>
                      <TableHead className="text-right">XP</TableHead>
                      <TableHead className="text-right">Beskeder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((user, index) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {getRankIcon(index + 1)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {user.discord_username || user.user_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            Level {user.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {user.xp.toLocaleString()} XP
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {user.total_messages.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen brugere har optjent XP endnu</p>
                  <p className="text-sm mt-2">XP optjenes automatisk når brugere chatter på serveren</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Level Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Niveau-roller
              </CardTitle>
              <CardDescription>
                Tildel automatisk roller når brugere når bestemte niveauer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Niveau</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={newRoleLevel}
                    onChange={(e) => setNewRoleLevel(e.target.value)}
                    className="w-24"
                    min="1"
                  />
                </div>
                <div className="space-y-2 flex-1 min-w-[200px]">
                   <Label>Rolle</Label>
                   <Select value={newRoleId} onValueChange={setNewRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg rolle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {discordRoles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddLevelRole} disabled={!newRoleLevel || !newRoleId}>
                  <Plus className="h-4 w-4 mr-2" />
                   Tilføj
                </Button>
              </div>

              {rolesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : levelRoles && levelRoles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead>Niveau</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>XP Påkrævet</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levelRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Badge>Level {role.level_required}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {role.role_name || role.role_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {xpForLevel(role.level_required).toLocaleString()} XP
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteLevelRole.mutate(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p>Ingen niveau-roller oprettet endnu</p>
                   <p className="text-sm mt-2">Tilføj en rolle ovenfor for at komme i gang</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* XP Multipliers Tab */}
        <TabsContent value="multipliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                XP-multiplikatorer
              </CardTitle>
              <CardDescription>
                Boost XP for specifikke roller, kanaler eller hele serveren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <Label>Navn</Label>
                  <Input
                    placeholder="Booster Bonus"
                    value={newMultiplierName}
                    onChange={(e) => setNewMultiplierName(e.target.value)}
                  />
                </div>
                <div className="space-y-2 min-w-[120px]">
                  <Label>Type</Label>
                  <Select value={newMultiplierType} onValueChange={(v: 'role' | 'channel' | 'global') => {
                    setNewMultiplierType(v);
                    setNewMultiplierTargetId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                           Rolle
                        </div>
                      </SelectItem>
                      <SelectItem value="channel">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                           Kanal
                        </div>
                      </SelectItem>
                      <SelectItem value="global">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Global
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newMultiplierType === 'role' && (
                   <div className="space-y-2 flex-1 min-w-[150px]">
                     <Label>Rolle</Label>
                     <Select value={newMultiplierTargetId} onValueChange={setNewMultiplierTargetId}>
                       <SelectTrigger>
                         <SelectValue placeholder="Vælg rolle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {discordRoles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {newMultiplierType === 'channel' && (
                   <div className="space-y-2 flex-1 min-w-[150px]">
                     <Label>Kanal</Label>
                     <Select value={newMultiplierTargetId} onValueChange={setNewMultiplierTargetId}>
                       <SelectTrigger>
                         <SelectValue placeholder="Vælg kanal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {textChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4" />
                              {channel.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 w-24">
                  <Label>Multiplikator</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={newMultiplierValue}
                    onChange={(e) => setNewMultiplierValue(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleAddMultiplier} 
                  disabled={!newMultiplierName || !newMultiplierValue || (newMultiplierType !== 'global' && !newMultiplierTargetId)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                   Tilføj
                </Button>
              </div>

              {multipliersLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : multipliers && multipliers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead>Navn</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mål</TableHead>
                      <TableHead>Multiplikator</TableHead>
                      <TableHead>Aktiv</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multipliers.map((mult) => {
                      const targetName = mult.multiplier_type === 'role'
                        ? discordRoles?.find(r => r.id === mult.target_id)?.name || mult.target_id
                        : mult.multiplier_type === 'channel'
                        ? textChannels.find(c => c.id === mult.target_id)?.name || mult.target_id
                        : 'Alle brugere';

                      return (
                        <TableRow key={mult.id}>
                          <TableCell className="font-medium">{mult.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {mult.multiplier_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {targetName}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-primary/20 text-primary">
                              {mult.multiplier}x XP
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={mult.enabled}
                              onCheckedChange={(checked) => 
                                updateMultiplier.mutate({ id: mult.id, enabled: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMultiplier.mutate(mult.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p>Ingen XP-multiplikatorer oprettet endnu</p>
                   <p className="text-sm mt-2">Opret en multiplikator for at booste XP for roller eller kanaler</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                   Generelle Indstillinger
                 </CardTitle>
                 <CardDescription>
                   Konfigurer XP-optjening og level-up beskeder
                 </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                         <Label>Aktiver Leveling</Label>
                         <p className="text-sm text-muted-foreground">
                           Slå XP og leveling til/fra
                         </p>
                      </div>
                      <Switch
                        checked={currentSettings.enabled}
                        onCheckedChange={(checked) => 
                          setLocalSettings({ ...localSettings, enabled: checked })
                        }
                      />
                    </div>

                    <div className="grid gap-4 grid-cols-3">
                      <div className="space-y-2">
                        <Label>Min XP</Label>
                        <Input
                          type="number"
                          value={currentSettings.xp_per_message_min}
                          onChange={(e) => 
                            setLocalSettings({ ...localSettings, xp_per_message_min: parseInt(e.target.value) || 15 })
                          }
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max XP</Label>
                        <Input
                          type="number"
                          value={currentSettings.xp_per_message_max}
                          onChange={(e) => 
                            setLocalSettings({ ...localSettings, xp_per_message_max: parseInt(e.target.value) || 25 })
                          }
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cooldown (s)</Label>
                        <Input
                          type="number"
                          value={currentSettings.cooldown_seconds}
                          onChange={(e) => 
                            setLocalSettings({ ...localSettings, cooldown_seconds: parseInt(e.target.value) || 60 })
                          }
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <Label>Level-up kanal</Label>
                       <ChannelSelect
                         value={currentSettings.level_up_channel_id}
                         onValueChange={(value) => 
                           setLocalSettings({ ...localSettings, level_up_channel_id: value })
                         }
                         placeholder="Vælg kanal..."
                       />
                    </div>

                    <div className="space-y-2">
                      <Label>Level-up besked</Label>
                      <Textarea
                        value={currentSettings.level_up_message}
                        onChange={(e) => 
                          setLocalSettings({ ...localSettings, level_up_message: e.target.value })
                        }
                        placeholder="Congratulations {user}! Level {level}!"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variabler: {'{user}'}, {'{level}'}, {'{xp}'}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Voice XP Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Voice XP
                </CardTitle>
                <CardDescription>
                   Optjen XP i stemmekanaler
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                         <Label>Aktiver Voice XP</Label>
                         <p className="text-sm text-muted-foreground">
                           Optjen XP i stemmekanaler
                         </p>
                      </div>
                      <Switch
                        checked={currentSettings.voice_xp_enabled}
                        onCheckedChange={(checked) => 
                          setLocalSettings({ ...localSettings, voice_xp_enabled: checked })
                        }
                      />
                    </div>

                    {currentSettings.voice_xp_enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>XP pr. minut</Label>
                          <Input
                            type="number"
                            value={currentSettings.voice_xp_per_minute}
                            onChange={(e) => 
                              setLocalSettings({ ...localSettings, voice_xp_per_minute: parseInt(e.target.value) || 5 })
                            }
                            min="1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cooldown (sekunder)</Label>
                          <Input
                            type="number"
                            value={currentSettings.voice_xp_cooldown_seconds}
                            onChange={(e) => 
                              setLocalSettings({ ...localSettings, voice_xp_cooldown_seconds: parseInt(e.target.value) || 60 })
                            }
                            min="0"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Blacklist Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <VolumeX className="h-5 w-5" />
                Sortlistede Kanaler
               </CardTitle>
               <CardDescription>
                 Kanaler hvor brugere ikke optjener XP
               </CardDescription>
            </CardHeader>
            <CardContent>
              {textChannels.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {textChannels.map((channel) => {
                    const isBlacklisted = currentSettings.blacklist_channels.includes(channel.id);
                    return (
                      <div
                        key={channel.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isBlacklisted 
                            ? 'bg-destructive/10 border-destructive/50' 
                            : 'bg-muted/50 border-border hover:bg-muted'
                        }`}
                        onClick={() => handleToggleBlacklistChannel(channel.id)}
                      >
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{channel.name}</span>
                        {isBlacklisted && <VolumeX className="h-4 w-4 text-destructive" />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen kanaler fundet</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Gem Indstillinger
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
