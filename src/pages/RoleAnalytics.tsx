import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Loader2, PieChart as PieChartIcon } from 'lucide-react';
import { useRoleAnalytics } from '@/hooks/useRoleAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function RoleAnalytics() {
  const { distribution, totalRoles, totalMembers, isLoading } = useRoleAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const top10 = distribution.slice(0, 10);
  const pieData = distribution.slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          Rolle Analyse
        </h1>
        <p className="text-muted-foreground mt-1">Se hvilke roller der er mest brugte på din server</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Medlemmer</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Crown className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Roller</p>
              <p className="text-2xl font-bold">{totalRoles}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><PieChartIcon className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Mest brugte rolle</p>
              <p className="text-lg font-bold truncate">{distribution[0]?.name ?? 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {distribution.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Ingen rolle-data tilgængelig</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar chart - Top 10 roles */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Roller</CardTitle>
              <CardDescription>Antal medlemmer per rolle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={75} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Medlemmer" radius={[0, 4, 4, 0]}>
                      {top10.map((entry, i) => (
                        <Cell key={i} fill={entry.color === '#000000' ? 'hsl(var(--primary))' : entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle>Rollefordeling</CardTitle>
              <CardDescription>Visuelt overblik over rolle-distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="count" nameKey="name">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color === '#000000' ? 'hsl(var(--primary))' : entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {pieData.map((r) => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color === '#000000' ? 'hsl(var(--primary))' : r.color }} />
                    <span className="text-xs text-muted-foreground">{r.name}: {r.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Full role table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Alle roller</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {distribution.map((role) => (
                  <div key={role.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color === '#000000' ? 'hsl(var(--primary))' : role.color }} />
                      <span className="text-sm font-medium truncate">{role.name}</span>
                    </div>
                    <Badge variant="secondary">{role.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
