import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEconomyLeaderboard, useEconomySettings } from '@/hooks/useEconomy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Settings, Trophy, Crown, Medal, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function getRankIcon(rank: number) {
  switch (rank) {
    case 1: return <Crown className="h-5 w-5 text-primary" />;
    case 2: return <Medal className="h-5 w-5 text-muted-foreground" />;
    case 3: return <Award className="h-5 w-5 text-accent-foreground" />;
    default: return <span className="text-muted-foreground font-mono">#{rank}</span>;
  }
}

export default function Economy() {
  const { selectedGuild } = useGuild();
  const { language } = useLanguage();
  const en = language === 'en';
  const { data: leaderboard, isLoading } = useEconomyLeaderboard();
  const { data: settings, isLoading: settingsLoading, updateSettings } = useEconomySettings();

  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});

  const currentSettings = {
    currency_name: (localSettings.currency_name as string) ?? settings?.currency_name ?? 'coins',
    currency_symbol: (localSettings.currency_symbol as string) ?? settings?.currency_symbol ?? '💰',
    daily_amount: (localSettings.daily_amount as number) ?? settings?.daily_amount ?? 100,
    work_min: (localSettings.work_min as number) ?? settings?.work_min ?? 50,
    work_max: (localSettings.work_max as number) ?? settings?.work_max ?? 200,
    work_cooldown_minutes: (localSettings.work_cooldown_minutes as number) ?? settings?.work_cooldown_minutes ?? 60,
  };

  const handleSave = () => {
    updateSettings.mutate(currentSettings);
    setLocalSettings({});
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{en ? 'Select a server first' : 'Vælg en server først'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{en ? 'Economy System' : 'Økonomi-system'}</h1>
        <p className="text-muted-foreground">{en ? 'Manage server currency, daily rewards and work commands' : 'Administrer servervaluta, daglige belønninger og arbejdskommandoer'}</p>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            {en ? 'Leaderboard' : 'Rangliste'}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {en ? 'Settings' : 'Indstillinger'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                {en ? 'Richest Users' : 'Rigeste Brugere'}
              </CardTitle>
              <CardDescription>{en ? 'Top 100 users sorted by total earned' : 'Top 100 brugere sorteret efter total optjent'}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{en ? 'Rank' : 'Rang'}</TableHead>
                      <TableHead>{en ? 'User' : 'Bruger'}</TableHead>
                      <TableHead className="text-right">{en ? 'Wallet' : 'Pung'}</TableHead>
                      <TableHead className="text-right">{en ? 'Bank' : 'Bank'}</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((user, index) => (
                      <TableRow key={user.id}>
                        <TableCell>{getRankIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{user.discord_username || user.user_id}</TableCell>
                        <TableCell className="text-right font-mono">{user.wallet.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{user.bank.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{user.total_earned.toLocaleString()}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{en ? 'No users have earned currency yet' : 'Ingen brugere har optjent valuta endnu'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{en ? 'Economy Settings' : 'Økonomi-indstillinger'}</CardTitle>
              <CardDescription>{en ? 'Configure currency and rewards' : 'Konfigurer valuta og belønninger'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{en ? 'Currency Name' : 'Valutanavn'}</Label>
                      <Input
                        value={currentSettings.currency_name}
                        onChange={(e) => setLocalSettings({ ...localSettings, currency_name: e.target.value })}
                        placeholder="coins"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{en ? 'Currency Symbol' : 'Valutasymbol'}</Label>
                      <Input
                        value={currentSettings.currency_symbol}
                        onChange={(e) => setLocalSettings({ ...localSettings, currency_symbol: e.target.value })}
                        placeholder="💰"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{en ? 'Daily Amount' : 'Dagligt beløb'}</Label>
                      <Input
                        type="number"
                        value={currentSettings.daily_amount}
                        onChange={(e) => setLocalSettings({ ...localSettings, daily_amount: parseInt(e.target.value) || 100 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{en ? 'Work Min Amount' : 'Arbejd min. beløb'}</Label>
                      <Input
                        type="number"
                        value={currentSettings.work_min}
                        onChange={(e) => setLocalSettings({ ...localSettings, work_min: parseInt(e.target.value) || 50 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{en ? 'Work Max Amount' : 'Arbejd maks. beløb'}</Label>
                      <Input
                        type="number"
                        value={currentSettings.work_max}
                        onChange={(e) => setLocalSettings({ ...localSettings, work_max: parseInt(e.target.value) || 200 })}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={updateSettings.isPending}>
                    {en ? 'Save settings' : 'Gem indstillinger'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
