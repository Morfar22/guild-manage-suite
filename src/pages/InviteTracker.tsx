import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInviteLeaderboard, useRecentInvites } from '@/hooks/useInviteTracker';
import { Trophy, UserPlus, AlertTriangle, LogOut, Users, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export default function InviteTracker() {
  const { data: leaderboard = [], isLoading: lbLoading } = useInviteLeaderboard();
  const { data: recent = [], isLoading: recentLoading } = useRecentInvites(100);

  const totals = leaderboard.reduce(
    (acc, e) => ({
      real: acc.real + e.real,
      fake: acc.fake + e.fake,
      left: acc.left + e.left,
      total: acc.total + e.total,
    }),
    { real: 0, fake: 0, left: 0, total: 0 }
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invite Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Se hvem der inviterer flest medlemmer til serveren
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={UserPlus} label="Rigtige invites" value={totals.real} tone="success" />
        <StatCard icon={AlertTriangle} label="Fake (nye konti)" value={totals.fake} tone="warning" />
        <StatCard icon={LogOut} label="Forladt" value={totals.left} tone="destructive" />
        <StatCard icon={Users} label="Total joins" value={totals.total} />
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">
            <Trophy className="h-4 w-4 mr-2" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="recent">
            <UserPlus className="h-4 w-4 mr-2" /> Seneste joins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>Top invitere</CardTitle>
              <CardDescription>Sorteret efter antal rigtige invites</CardDescription>
            </CardHeader>
            <CardContent>
              {lbLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Ingen invite data endnu. Når et medlem joiner via et invite, vises de her.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Bruger</TableHead>
                      <TableHead className="text-right">Rigtige</TableHead>
                      <TableHead className="text-right">Fake</TableHead>
                      <TableHead className="text-right">Forladt</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((e, i) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-bold text-muted-foreground">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{e.username}</div>
                          <div className="text-xs text-muted-foreground">{e.id}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">{e.real}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="border-yellow-600 text-yellow-600">{e.fake}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="border-red-600 text-red-600">{e.left}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{e.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Seneste joins</CardTitle>
              <CardDescription>De seneste 100 medlemmer der har joinet</CardDescription>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : recent.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ingen joins registreret endnu.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medlem</TableHead>
                      <TableHead>Inviteret af</TableHead>
                      <TableHead>Invite</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Joinede</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.joined_username || 'Ukendt'}</div>
                          <div className="text-xs text-muted-foreground">{r.joined_user_id}</div>
                        </TableCell>
                        <TableCell>{r.inviter_username || <span className="text-muted-foreground italic">Ukendt</span>}</TableCell>
                        <TableCell><code className="text-xs">{r.invite_code || '-'}</code></TableCell>
                        <TableCell>
                          {r.has_left ? (
                            <Badge variant="outline" className="border-red-600 text-red-600">Forladt</Badge>
                          ) : r.is_fake ? (
                            <Badge variant="outline" className="border-yellow-600 text-yellow-600">Fake</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Aktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(r.joined_at), { addSuffix: true, locale: da })}
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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'destructive';
}) {
  const toneClass =
    tone === 'success' ? 'text-green-600' :
    tone === 'warning' ? 'text-yellow-600' :
    tone === 'destructive' ? 'text-red-600' :
    'text-primary';
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
