import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import {
  useTebexSettings,
  useTebexLookup,
  useTebexPackages,
  useTebexStats,
  useTebexPurchaseHistory,
  useTebexRoleMappings,
} from '@/hooks/useTebex';
import { useDiscordRoles, DiscordRole } from '@/hooks/useDiscordRoles';
import { useDiscordChannels, DiscordChannel } from '@/hooks/useDiscordChannels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingCart, Settings, Search, Package, User, CreditCard, Loader2,
  BarChart3, Shield, Trash2, Plus, TrendingUp, DollarSign, History, Bell,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TebexSettings() {
  const { selectedGuild } = useGuild();
  const { settings, isLoading, saveSettings } = useTebexSettings();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState('');
  const [notifChannel, setNotifChannel] = useState<string | undefined>(undefined);
  const [searchType, setSearchType] = useState<'transaction' | 'player'>('transaction');
  const [searchQuery, setSearchQuery] = useState('');

  const currentEnabled = enabled ?? settings?.enabled ?? false;
  const tebexActive = settings?.enabled ?? false;

  const { lookupPayment, lookupPlayer, recentPayments } = useTebexLookup(tebexActive);
  const packagesQuery = useTebexPackages(tebexActive);
  const statsQuery = useTebexStats(tebexActive);
  const historyQuery = useTebexPurchaseHistory(tebexActive);
  const { mappings, isLoading: mappingsLoading, saveMapping, deleteMapping } = useTebexRoleMappings(tebexActive);

  const handleSave = () => {
    saveSettings.mutate({
      enabled: currentEnabled,
      tebex_secret: secret || undefined,
      notification_channel_id: notifChannel,
    });
    setSecret('');
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (searchType === 'transaction') {
      lookupPayment.mutate(searchQuery.trim());
    } else {
      lookupPlayer.mutate(searchQuery.trim());
    }
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
        <h1 className="text-3xl font-bold text-foreground">Tebex Integration</h1>
        <p className="text-muted-foreground">Administrer køb, pakker, roller og statistik</p>
      </div>

      <Tabs defaultValue="lookup" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lookup" className="gap-2">
            <Search className="h-4 w-4" /> Opslag
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-2">
            <ShoppingCart className="h-4 w-4" /> Seneste køb
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <Package className="h-4 w-4" /> Pakker
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Statistik
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" /> Rolle ved køb
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Historik
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" /> Indstillinger
          </TabsTrigger>
        </TabsList>

        {/* Lookup tab */}
        <TabsContent value="lookup">
          <LookupTab
            currentEnabled={currentEnabled}
            searchType={searchType}
            setSearchType={setSearchType}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
            lookupPayment={lookupPayment}
            lookupPlayer={lookupPlayer}
          />
        </TabsContent>

        {/* Recent payments tab */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Seneste betalinger
              </CardTitle>
              <CardDescription>De seneste 25 betalinger fra Tebex API</CardDescription>
            </CardHeader>
            <CardContent>
              {!tebexActive ? <DisabledMessage /> : recentPayments.isLoading ? (
                <LoadingRows />
              ) : recentPayments.data ? (
                <RecentPaymentsTable payments={recentPayments.data} />
              ) : (
                <p className="text-muted-foreground text-center py-8">Ingen betalinger fundet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packages tab */}
        <TabsContent value="packages">
          <PackagesTab tebexActive={tebexActive} packagesQuery={packagesQuery} />
        </TabsContent>

        {/* Stats tab */}
        <TabsContent value="stats">
          <StatsTab tebexActive={tebexActive} statsQuery={statsQuery} />
        </TabsContent>

        {/* Role mappings tab */}
        <TabsContent value="roles">
          <RoleMappingsTab
            tebexActive={tebexActive}
            mappings={mappings}
            mappingsLoading={mappingsLoading}
            saveMapping={saveMapping}
            deleteMapping={deleteMapping}
            guildId={selectedGuild.id}
          />
        </TabsContent>

        {/* Purchase history tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Købs-historik (Webhook)
              </CardTitle>
              <CardDescription>Køb modtaget via Tebex webhooks</CardDescription>
            </CardHeader>
            <CardContent>
              {!tebexActive ? <DisabledMessage /> : historyQuery.isLoading ? (
                <LoadingRows />
              ) : (historyQuery.data as Array<Record<string, unknown>>)?.length > 0 ? (
                <PurchaseHistoryTable purchases={historyQuery.data as Array<Record<string, unknown>>} />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Ingen webhook-data endnu. Konfigurer din Tebex webhook URL i indstillinger.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings">
          <SettingsTab
            isLoading={isLoading}
            currentEnabled={currentEnabled}
            setEnabled={setEnabled}
            secret={secret}
            setSecret={setSecret}
            notifChannel={notifChannel ?? settings?.notification_channel_id ?? ''}
            setNotifChannel={setNotifChannel}
            handleSave={handleSave}
            saving={saveSettings.isPending}
            guildId={selectedGuild.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Sub components ────────────────────────────────── */

function DisabledMessage() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>Tebex er ikke aktiveret. Gå til Indstillinger for at aktivere.</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

/* ── Lookup ────────────────────────────────── */
function LookupTab({
  currentEnabled, searchType, setSearchType, searchQuery, setSearchQuery,
  handleSearch, lookupPayment, lookupPlayer,
}: {
  currentEnabled: boolean;
  searchType: 'transaction' | 'player';
  setSearchType: (t: 'transaction' | 'player') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: () => void;
  lookupPayment: ReturnType<typeof import('@/hooks/useTebex').useTebexLookup>['lookupPayment'];
  lookupPlayer: ReturnType<typeof import('@/hooks/useTebex').useTebexLookup>['lookupPlayer'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Søg efter køb
        </CardTitle>
        <CardDescription>Slå en betaling op via transaktions-ID (tbx-...) eller et spiller-ID</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentEnabled ? <DisabledMessage /> : (
          <>
            <div className="flex gap-2">
              <Button variant={searchType === 'transaction' ? 'default' : 'outline'} size="sm" onClick={() => setSearchType('transaction')}>
                <CreditCard className="h-4 w-4 mr-1" /> Transaktions-ID
              </Button>
              <Button variant={searchType === 'player' ? 'default' : 'outline'} size="sm" onClick={() => setSearchType('player')}>
                <User className="h-4 w-4 mr-1" /> Spiller-ID
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={searchType === 'transaction' ? 'tbx-xxxxx-xxxxx' : 'Spiller ID / brugernavn'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={lookupPayment.isPending || lookupPlayer.isPending}>
                {(lookupPayment.isPending || lookupPlayer.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {lookupPayment.data && searchType === 'transaction' && <PaymentResult data={lookupPayment.data.payment} />}
            {lookupPayment.isError && searchType === 'transaction' && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(lookupPayment.error as Error).message}</div>
            )}
            {lookupPlayer.data && searchType === 'player' && <PlayerResult data={lookupPlayer.data} />}
            {lookupPlayer.isError && searchType === 'player' && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(lookupPlayer.error as Error).message}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Packages ────────────────────────────────── */
function PackagesTab({ tebexActive, packagesQuery }: { tebexActive: boolean; packagesQuery: ReturnType<typeof import('@/hooks/useTebex').useTebexPackages> }) {
  if (!tebexActive) return <Card><CardContent className="pt-6"><DisabledMessage /></CardContent></Card>;

  const listing = packagesQuery.data;
  const categories = Array.isArray(listing?.categories) ? listing.categories : Array.isArray(listing) ? listing : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Tebex Pakker
        </CardTitle>
        <CardDescription>Alle tilgængelige pakker fra din webshop</CardDescription>
      </CardHeader>
      <CardContent>
        {packagesQuery.isLoading ? <LoadingRows /> : categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Ingen pakker fundet</p>
        ) : (
          <div className="space-y-6">
            {categories.map((cat: Record<string, unknown>, ci: number) => {
              const pkgs = (cat.packages as Array<Record<string, unknown>>) || [];
              return (
                <div key={ci}>
                  <h3 className="font-semibold text-lg mb-3">{String(cat.name || 'Kategori')}</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {pkgs.map((pkg: Record<string, unknown>, pi: number) => {
                      const price = pkg.price as Record<string, unknown> | undefined;
                      return (
                        <Card key={pi} className="border-border">
                          <CardContent className="pt-4 pb-4 space-y-2">
                            {!!pkg.image && (
                              <img src={String(pkg.image)} alt="" className="w-full h-24 object-cover rounded-md mb-2" />
                            )}
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{String(pkg.name || '-')}</p>
                                <p className="text-xs text-muted-foreground">ID: {String(pkg.id || '-')}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {price ? `${String(price.amount || price)} ${String(price.currency || '')}` : String(pkg.price || '-')}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Stats ────────────────────────────────── */
function StatsTab({ tebexActive, statsQuery }: { tebexActive: boolean; statsQuery: ReturnType<typeof import('@/hooks/useTebex').useTebexStats> }) {
  if (!tebexActive) return <Card><CardContent className="pt-6"><DisabledMessage /></CardContent></Card>;

  const stats = statsQuery.data as Record<string, unknown> | null | undefined;

  if (statsQuery.isLoading) return <LoadingRows />;

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            Ingen statistik endnu. Data opsamles automatisk via webhooks.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dailyRevenue = (stats.dailyRevenue || {}) as Record<string, number>;
  const chartData = Object.entries(dailyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: date.slice(5), amount }));

  const topPackages = (stats.topPackages || []) as Array<{ name: string; count: number; revenue: number }>;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Total omsætning" value={`${stats.totalRevenue} ${stats.currency}`} />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Netto omsætning" value={`${stats.netRevenue} ${stats.currency}`} />
        <KpiCard icon={<ShoppingCart className="h-5 w-5" />} label="Antal ordrer" value={String(stats.totalOrders)} />
        <KpiCard icon={<CreditCard className="h-5 w-5" />} label="Refusioner" value={`${stats.refunds} ${stats.currency}`} />
      </div>

      {/* Revenue chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daglig omsætning (30 dage)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                <YAxis className="text-xs fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top packages */}
      {topPackages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top pakker</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pakke</TableHead>
                  <TableHead>Antal solgt</TableHead>
                  <TableHead>Omsætning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPackages.map((pkg, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>{pkg.count}</TableCell>
                    <TableCell className="font-semibold">{pkg.revenue} {String(stats.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Role Mappings ────────────────────────────────── */
function RoleMappingsTab({
  tebexActive, mappings, mappingsLoading, saveMapping, deleteMapping, guildId,
}: {
  tebexActive: boolean;
  mappings: Array<Record<string, unknown>>;
  mappingsLoading: boolean;
  saveMapping: { mutate: (params: { tebex_package_id: number; tebex_package_name: string; discord_role_id: string; discord_role_name: string }) => void; isPending: boolean };
  deleteMapping: { mutate: (id: string) => void; isPending: boolean };
  guildId: string;
}) {
  const { data: roles } = useDiscordRoles();
  const [newPkgId, setNewPkgId] = useState('');
  const [newPkgName, setNewPkgName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  if (!tebexActive) return <Card><CardContent className="pt-6"><DisabledMessage /></CardContent></Card>;

  const handleAdd = () => {
    if (!newPkgId || !newRoleId) return;
    const role = roles?.find((r) => r.id === newRoleId);
    saveMapping.mutate({
      tebex_package_id: Number(newPkgId),
      tebex_package_name: newPkgName || `Pakke #${newPkgId}`,
      discord_role_id: newRoleId,
      discord_role_name: role ? String(role.name) : newRoleId,
    });
    setNewPkgId('');
    setNewPkgName('');
    setNewRoleId('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Rolle ved køb
        </CardTitle>
        <CardDescription>
          Tildel automatisk en Discord-rolle når en bruger køber en bestemt Tebex-pakke. Kræver webhook-opsætning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new */}
        <div className="grid gap-3 md:grid-cols-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tebex Pakke-ID</Label>
            <Input placeholder="123456" value={newPkgId} onChange={(e) => setNewPkgId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pakke-navn (valgfrit)</Label>
            <Input placeholder="VIP Pakke" value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Discord Rolle</Label>
            <Select value={newRoleId} onValueChange={setNewRoleId}>
              <SelectTrigger><SelectValue placeholder="Vælg rolle..." /></SelectTrigger>
              <SelectContent>
                {(roles || []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={saveMapping.isPending || !newPkgId || !newRoleId}>
            <Plus className="h-4 w-4 mr-1" /> Tilføj
          </Button>
        </div>

        {/* Existing mappings */}
        {mappingsLoading ? <LoadingRows /> : mappings.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Ingen rolle-mappings oprettet endnu</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pakke-ID</TableHead>
                <TableHead>Pakke-navn</TableHead>
                <TableHead>Discord Rolle</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={String(m.id)}>
                  <TableCell className="font-mono">{String(m.tebex_package_id)}</TableCell>
                  <TableCell>{String(m.tebex_package_name || '-')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(m.discord_role_name || m.discord_role_id)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMapping.mutate(String(m.id))} disabled={deleteMapping.isPending}>
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
  );
}

/* ── Settings ────────────────────────────────── */
function SettingsTab({
  isLoading, currentEnabled, setEnabled, secret, setSecret,
  notifChannel, setNotifChannel, handleSave, saving, guildId,
}: {
  isLoading: boolean; currentEnabled: boolean;
  setEnabled: (v: boolean) => void; secret: string; setSecret: (v: string) => void;
  notifChannel: string; setNotifChannel: (v: string) => void;
  handleSave: () => void; saving: boolean; guildId: string;
}) {
  const { data: channelsData } = useDiscordChannels();
  const webhookUrl = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/tebex-webhook?guild_id=${guildId}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tebex Indstillinger</CardTitle>
          <CardDescription>Konfigurer din Tebex-integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Aktivér Tebex</Label>
                  <p className="text-sm text-muted-foreground">Slå Tebex-modulet til eller fra</p>
                </div>
                <Switch checked={currentEnabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-2">
                <Label>Tebex Server Secret Key</Label>
                <Input type="password" placeholder="Indtast din Tebex secret key..." value={secret} onChange={(e) => setSecret(e.target.value)} />
                <p className="text-xs text-muted-foreground">Find den under Tebex Dashboard → Game Servers → Din server → Secret Key</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifikationskanal</Label>
                <Select value={notifChannel || 'none'} onValueChange={(v) => setNotifChannel(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Vælg kanal..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {(channelsData?.channels || []).filter((c) => c.type === 0).map((c) => (
                      <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Kanal der modtager notifikationer om køb, refusioner og chargebacks</p>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Gem indstillinger
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Webhook URL
          </CardTitle>
          <CardDescription>Indsæt denne URL i Tebex Dashboard → Webhooks for at modtage købs-notifikationer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); }}>
              Kopiér
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Purchase History ────────────────────────────────── */
function PurchaseHistoryTable({ purchases }: { purchases: Array<Record<string, unknown>> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaktions-ID</TableHead>
          <TableHead>Spiller</TableHead>
          <TableHead>Beløb</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Dato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((p, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{String(p.txn_id || '-')}</TableCell>
            <TableCell>{String(p.player_name || '-')}</TableCell>
            <TableCell className="font-semibold">{String(p.amount || '0')} {String(p.currency || '')}</TableCell>
            <TableCell>
              <Badge variant={p.event_type === 'payment.completed' ? 'default' : 'destructive'}>
                {String(p.event_type === 'payment.completed' ? 'Køb' : p.event_type === 'payment.refunded' ? 'Refusion' : p.event_type)}
              </Badge>
            </TableCell>
            <TableCell>{p.created_at ? new Date(String(p.created_at)).toLocaleDateString('da-DK') : '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── Existing result components ────────────────────────────────── */
function PaymentResult({ data }: { data: Record<string, unknown> }) {
  if (!data) return null;
  const player = data.player as Record<string, unknown> | undefined;
  const packages = (data.packages as Array<Record<string, unknown>>) || [];
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Betalingsdetaljer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Transaktions-ID:</span><p className="font-mono">{String(data.txn_id || data.id || '-')}</p></div>
          <div><span className="text-muted-foreground">Beløb:</span><p className="font-semibold">{String(data.amount || '-')} {String(data.currency || '')}</p></div>
          <div><span className="text-muted-foreground">Status:</span><Badge variant={data.status === 'Complete' ? 'default' : 'secondary'}>{String(data.status || '-')}</Badge></div>
          <div><span className="text-muted-foreground">Dato:</span><p>{data.date ? new Date(String(data.date)).toLocaleString('da-DK') : '-'}</p></div>
          {player && <div><span className="text-muted-foreground">Spiller:</span><p>{String(player.name || player.username || '-')}</p></div>}
        </div>
        {packages.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Pakker:</p>
            <div className="flex flex-wrap gap-2">
              {packages.map((pkg, i) => <Badge key={i} variant="outline"><Package className="h-3 w-3 mr-1" />{String(pkg.name || `Pakke #${pkg.id}`)}</Badge>)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerResult({ data }: { data: { player: Record<string, unknown>; packages: Array<Record<string, unknown>> } }) {
  const { player, packages } = data;
  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Spillerinfo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Brugernavn:</span><p className="font-medium">{String(player.username || player.name || '-')}</p></div>
            <div><span className="text-muted-foreground">ID:</span><p className="font-mono">{String(player.id || '-')}</p></div>
          </div>
        </CardContent>
      </Card>
      {packages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Aktive pakker ({packages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Pakke</TableHead><TableHead>Transaktions-ID</TableHead><TableHead>Dato</TableHead></TableRow></TableHeader>
              <TableBody>
                {packages.map((pkg, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{String((pkg.package as Record<string, unknown>)?.name || pkg.name || '-')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(pkg.txn_id || '-')}</TableCell>
                    <TableCell>{pkg.date ? new Date(String(pkg.date)).toLocaleDateString('da-DK') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecentPaymentsTable({ payments }: { payments: unknown }) {
  const paymentList = Array.isArray(payments) ? payments : (payments as Record<string, unknown>)?.data;
  if (!Array.isArray(paymentList) || paymentList.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Ingen betalinger fundet</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Transaktions-ID</TableHead><TableHead>Spiller</TableHead><TableHead>Beløb</TableHead><TableHead>Status</TableHead><TableHead>Dato</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {paymentList.map((p: Record<string, unknown>, i: number) => {
          const player = p.player as Record<string, unknown> | undefined;
          return (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{String(p.txn_id || p.id || '-')}</TableCell>
              <TableCell>{String(player?.name || player?.username || '-')}</TableCell>
              <TableCell className="font-semibold">{String(p.amount || '-')} {String(p.currency || '')}</TableCell>
              <TableCell><Badge variant={p.status === 'Complete' ? 'default' : 'secondary'}>{String(p.status || '-')}</Badge></TableCell>
              <TableCell>{p.date ? new Date(String(p.date)).toLocaleDateString('da-DK') : '-'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
