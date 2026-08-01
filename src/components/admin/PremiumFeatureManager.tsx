import { useState } from 'react';
import { useAllGuildPremiumFeatures, useTogglePremiumFeature } from '@/hooks/useGuildPremiumFeatures';
import { useAllUserPremiumFeatures, useToggleUserPremiumFeature } from '@/hooks/useUserPremiumFeatures';
import { useAllGuilds, useAllUsers } from '@/hooks/useAdmin';
import { PREMIUM_FEATURES, PREMIUM_FEATURE_KEYS, PremiumFeatureKey } from '@/lib/premium-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Crown, Search, Server, User, Zap, X } from 'lucide-react';

export function PremiumFeatureManager() {
  const { data: guildFeatures, isLoading: guildFeaturesLoading } = useAllGuildPremiumFeatures();
  const { data: userFeatures, isLoading: userFeaturesLoading } = useAllUserPremiumFeatures();
  const { data: guilds, isLoading: guildsLoading } = useAllGuilds();
  const { data: users, isLoading: usersLoading } = useAllUsers();
  const toggleGuildFeature = useTogglePremiumFeature();
  const toggleUserFeature = useToggleUserPremiumFeature();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('guilds');
  const [searchTerm, setSearchTerm] = useState('');

  // Guild activation state
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [selectedGuildFeatures, setSelectedGuildFeatures] = useState<string[]>([]);
  const [guildExpiresAt, setGuildExpiresAt] = useState('');
  const [guildNotes, setGuildNotes] = useState('');

  // User activation state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserFeatures, setSelectedUserFeatures] = useState<string[]>([]);
  const [userExpiresAt, setUserExpiresAt] = useState('');
  const [userNotes, setUserNotes] = useState('');

  const toggleFeatureSelection = (feature: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(feature) ? list.filter(f => f !== feature) : [...list, feature]);
  };

  const selectAllFeatures = (list: string[], setList: (v: string[]) => void) => {
    setList(list.length === PREMIUM_FEATURE_KEYS.length ? [] : [...PREMIUM_FEATURE_KEYS]);
  };

  const handleGuildActivate = async () => {
    if (!selectedGuildId || selectedGuildFeatures.length === 0) {
      toast({ title: 'Vælg server og mindst én feature', variant: 'destructive' });
      return;
    }
    try {
      for (const feature of selectedGuildFeatures) {
        await toggleGuildFeature.mutateAsync({
          guildId: selectedGuildId,
          feature,
          enabled: true,
          expiresAt: guildExpiresAt || null,
          notes: guildNotes || null,
        });
      }
      toast({ title: `${selectedGuildFeatures.length} feature(s) aktiveret for server` });
      setSelectedGuildId('');
      setSelectedGuildFeatures([]);
      setGuildExpiresAt('');
      setGuildNotes('');
    } catch {
      toast({ title: 'Fejl ved aktivering', variant: 'destructive' });
    }
  };

  const handleUserActivate = async () => {
    if (!selectedUserId || selectedUserFeatures.length === 0) {
      toast({ title: 'Vælg bruger og mindst én feature', variant: 'destructive' });
      return;
    }
    try {
      for (const feature of selectedUserFeatures) {
        await toggleUserFeature.mutateAsync({
          userId: selectedUserId,
          feature,
          enabled: true,
          expiresAt: userExpiresAt || null,
          notes: userNotes || null,
        });
      }
      toast({ title: `${selectedUserFeatures.length} feature(s) aktiveret for bruger` });
      setSelectedUserId('');
      setSelectedUserFeatures([]);
      setUserExpiresAt('');
      setUserNotes('');
    } catch {
      toast({ title: 'Fejl ved aktivering', variant: 'destructive' });
    }
  };

  const handleGuildToggle = async (guildId: string, feature: string, enabled: boolean) => {
    try {
      await toggleGuildFeature.mutateAsync({ guildId, feature, enabled });
      toast({ title: enabled ? 'Feature aktiveret' : 'Feature deaktiveret' });
    } catch {
      toast({ title: 'Fejl', variant: 'destructive' });
    }
  };

  const handleUserToggle = async (userId: string, feature: string, enabled: boolean) => {
    try {
      await toggleUserFeature.mutateAsync({ userId, feature, enabled });
      toast({ title: enabled ? 'Feature aktiveret' : 'Feature deaktiveret' });
    } catch {
      toast({ title: 'Fejl', variant: 'destructive' });
    }
  };

  const getGuildName = (guildId: string) =>
    guilds?.find(g => g.id === guildId)?.guild_name || guildId;

  const getUserEmail = (userId: string) =>
    users?.find(u => u.id === userId)?.email || userId;

  // Group features
  const guildFeaturesByGuild = (guildFeatures || []).reduce((acc, pf) => {
    if (!acc[pf.guild_id]) acc[pf.guild_id] = [];
    acc[pf.guild_id]!.push(pf);
    return acc;
  }, {} as Record<string, NonNullable<typeof guildFeatures>[number][]>);

  const userFeaturesByUser = (userFeatures || []).reduce((acc, pf) => {
    if (!acc[pf.user_id]) acc[pf.user_id] = [];
    acc[pf.user_id]!.push(pf);
    return acc;
  }, {} as Record<string, NonNullable<typeof userFeatures>[number][]>);

  const filteredGuildIds = Object.keys(guildFeaturesByGuild).filter(guildId =>
    getGuildName(guildId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUserIds = Object.keys(userFeaturesByUser).filter(userId =>
    getUserEmail(userId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = guildFeaturesLoading || userFeaturesLoading;
  const isPending = toggleGuildFeature.isPending || toggleUserFeature.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          Premium Feature Manager
        </CardTitle>
        <CardDescription>Aktiver premium features for servere og brugere</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="guilds" className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Servere
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Brugere
            </TabsTrigger>
          </TabsList>

          {/* GUILD TAB */}
          <TabsContent value="guilds" className="space-y-4 mt-4">
            <ActivationPanel
              label="Aktiver for server"
              selectPlaceholder="Vælg server"
              options={(guilds || []).map(g => ({ value: g.id, label: g.guild_name }))}
              optionsLoading={guildsLoading}
              selectedId={selectedGuildId}
              onSelectId={setSelectedGuildId}
              selectedFeatures={selectedGuildFeatures}
              onToggleFeature={(f) => toggleFeatureSelection(f, selectedGuildFeatures, setSelectedGuildFeatures)}
              onSelectAll={() => selectAllFeatures(selectedGuildFeatures, setSelectedGuildFeatures)}
              expiresAt={guildExpiresAt}
              onExpiresAtChange={setGuildExpiresAt}
              notes={guildNotes}
              onNotesChange={setGuildNotes}
              onActivate={handleGuildActivate}
              isPending={isPending}
            />

            <FeatureList
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              isLoading={isLoading}
              filteredIds={filteredGuildIds}
              getName={getGuildName}
              featuresByEntity={guildFeaturesByGuild}
              onToggle={handleGuildToggle}
              isPending={isPending}
              searchPlaceholder="Søg efter server..."
            />
          </TabsContent>

          {/* USER TAB */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <ActivationPanel
              label="Aktiver for bruger"
              selectPlaceholder="Vælg bruger"
              options={(users || []).map(u => ({ value: u.id, label: u.email }))}
              optionsLoading={usersLoading}
              selectedId={selectedUserId}
              onSelectId={setSelectedUserId}
              selectedFeatures={selectedUserFeatures}
              onToggleFeature={(f) => toggleFeatureSelection(f, selectedUserFeatures, setSelectedUserFeatures)}
              onSelectAll={() => selectAllFeatures(selectedUserFeatures, setSelectedUserFeatures)}
              expiresAt={userExpiresAt}
              onExpiresAtChange={setUserExpiresAt}
              notes={userNotes}
              onNotesChange={setUserNotes}
              onActivate={handleUserActivate}
              isPending={isPending}
            />

            <FeatureList
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              isLoading={isLoading}
              filteredIds={filteredUserIds}
              getName={getUserEmail}
              featuresByEntity={userFeaturesByUser}
              onToggle={handleUserToggle}
              isPending={isPending}
              searchPlaceholder="Søg efter bruger..."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Reusable Activation Panel ───────────────────────────────────────────────

interface ActivationPanelProps {
  label: string;
  selectPlaceholder: string;
  options: { value: string; label: string }[];
  optionsLoading: boolean;
  selectedId: string;
  onSelectId: (id: string) => void;
  selectedFeatures: string[];
  onToggleFeature: (f: string) => void;
  onSelectAll: () => void;
  expiresAt: string;
  onExpiresAtChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onActivate: () => void;
  isPending: boolean;
}

function ActivationPanel({
  label, selectPlaceholder, options, optionsLoading,
  selectedId, onSelectId, selectedFeatures, onToggleFeature, onSelectAll,
  expiresAt, onExpiresAtChange, notes, onNotesChange, onActivate, isPending,
}: ActivationPanelProps) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
      <Label className="flex items-center gap-2 font-medium">
        <Zap className="h-4 w-4 text-yellow-500" />
        {label}
      </Label>

      <Select value={selectedId} onValueChange={onSelectId}>
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {optionsLoading ? (
            <SelectItem value="loading" disabled>Indlæser...</SelectItem>
          ) : (
            options.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Feature checkboxes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Vælg features</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={onSelectAll}
          >
            {selectedFeatures.length === PREMIUM_FEATURE_KEYS.length ? 'Fravælg alle' : 'Vælg alle'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PREMIUM_FEATURE_KEYS.map(key => {
            const info = PREMIUM_FEATURES[key];
            const Icon = info.icon;
            const isSelected = selectedFeatures.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleFeature(key)}
                className={`flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors border ${
                  isSelected
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-background border-border/50 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Checkbox checked={isSelected} className="pointer-events-none" />
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs">{info.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Udløber (valgfrit)</Label>
          <Input type="datetime-local" value={expiresAt} onChange={e => onExpiresAtChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Note (valgfrit)</Label>
          <Input value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Admin-kommentar..." />
        </div>
      </div>

      <Button
        onClick={onActivate}
        disabled={!selectedId || selectedFeatures.length === 0 || isPending}
        className="w-full"
      >
        Aktiver {selectedFeatures.length > 0 ? `${selectedFeatures.length} feature(s)` : 'features'}
      </Button>
    </div>
  );
}

// ─── Reusable Feature List ───────────────────────────────────────────────────

interface FeatureListProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
  filteredIds: string[];
  getName: (id: string) => string;
  featuresByEntity: Record<string, Array<{ id: string; feature: string; enabled: boolean; expires_at: string | null }>>;
  onToggle: (entityId: string, feature: string, enabled: boolean) => void;
  isPending: boolean;
  searchPlaceholder: string;
}

function FeatureList({
  searchTerm, onSearchChange, isLoading, filteredIds,
  getName, featuresByEntity, onToggle, isPending, searchPlaceholder,
}: FeatureListProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filteredIds.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 text-sm">Ingen premium features aktiveret endnu</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredIds.map(entityId => (
            <div key={entityId} className="p-3 rounded-lg border border-border">
              <p className="font-medium text-sm mb-2 truncate">{getName(entityId)}</p>
              <div className="flex flex-wrap gap-1.5">
                {featuresByEntity[entityId]?.map(pf => {
                  const info = PREMIUM_FEATURES[pf.feature as PremiumFeatureKey];
                  const isExpired = pf.expires_at && new Date(pf.expires_at) < new Date();
                  return (
                    <div key={pf.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/50">
                      <Switch
                        checked={pf.enabled && !isExpired}
                        onCheckedChange={checked => onToggle(entityId, pf.feature, checked)}
                        disabled={isPending}
                        className="scale-75"
                      />
                      <span className="text-xs">{info?.name || pf.feature}</span>
                      {isExpired && <Badge variant="destructive" className="text-[9px] px-1 py-0">Udløbet</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
