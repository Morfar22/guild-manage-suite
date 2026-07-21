import { useTicketInsights } from '@/hooks/useTicketInsights';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Users, Clock } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function TicketInsights() {
  const { data, isLoading } = useTicketInsights();

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No data yet.</p>;

  const totalTickets = data.daily.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Tickets (30d)" value={String(totalTickets)} />
        <StatCard icon={<Star className="h-4 w-4" />} label="Avg. rating" value={data.avgRating ? `${data.avgRating} / 5` : '—'} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Ratings" value={String(data.totalRatings)} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Active staff" value={String(data.staff.length)} />
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Ticket volume (30 days)</CardTitle>
          <CardDescription>Daily new tickets opened</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Staff performance</CardTitle>
          <CardDescription>Ranked by tickets handled</CardDescription>
        </CardHeader>
        <CardContent>
          {data.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Avg. rating</TableHead>
                  <TableHead className="text-right">Ratings</TableHead>
                  <TableHead className="text-right">Avg. resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.staff.map((s) => (
                  <TableRow key={s.staff_id}>
                    <TableCell className="font-medium">{s.staff_name}</TableCell>
                    <TableCell className="text-right">{s.tickets_handled}</TableCell>
                    <TableCell className="text-right">
                      {s.avg_rating != null ? (
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {s.avg_rating}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{s.ratings_count}</TableCell>
                    <TableCell className="text-right">{s.avg_resolution_hours != null ? `${s.avg_resolution_hours}h` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.ratings.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Latest ratings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ratings.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-start justify-between rounded-md border border-border/40 p-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/40'}`} />
                    ))}
                    <span className="text-xs text-muted-foreground">for {r.staff_name || 'staff'}</span>
                  </div>
                  {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
