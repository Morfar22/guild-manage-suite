import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, Clock, CheckCircle2, XCircle, Sparkles, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { useApplicationSubmissions } from '@/hooks/useApplicationSubmissions';
import { useApplicationForms } from '@/hooks/useApplicationForms';
import { useGuildPremium } from '@/hooks/useGuildPremium';
import { PremiumLock } from '@/components/applications/PremiumLock';
import { format, subDays, startOfDay } from 'date-fns';
import { da } from 'date-fns/locale';

function Kpi({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  icon: any;
  gradient: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
          </div>
          <div className={`rounded-xl bg-gradient-to-br ${gradient} p-3`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(45 95% 60%)',
  approved: 'hsl(150 70% 50%)',
  denied: 'hsl(0 75% 60%)',
};

function AnalyticsContent() {
  const { data: submissions, isLoading } = useApplicationSubmissions();
  const { data: forms } = useApplicationForms();

  const stats = useMemo(() => {
    if (!submissions) return null;

    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const approved = submissions.filter((s) => s.status === 'approved').length;
    const denied = submissions.filter((s) => s.status === 'denied').length;
    const reviewed = approved + denied;
    const approvalRate = reviewed ? Math.round((approved / reviewed) * 100) : 0;

    const aiScored = submissions.filter((s: any) => s.ai_score != null);
    const avgAiScore = aiScored.length
      ? Math.round(aiScored.reduce((sum: number, s: any) => sum + (s.ai_score || 0), 0) / aiScored.length)
      : null;

    // Submissions over time (sidste 14 dage)
    const days = Array.from({ length: 14 }).map((_, i) => {
      const date = startOfDay(subDays(new Date(), 13 - i));
      const dayStr = format(date, 'd. MMM', { locale: da });
      const count = submissions.filter((s) => startOfDay(new Date(s.created_at)).getTime() === date.getTime()).length;
      return { day: dayStr, count };
    });

    const statusData = [
      { name: 'Afventer', value: pending, key: 'pending' },
      { name: 'Godkendt', value: approved, key: 'approved' },
      { name: 'Afvist', value: denied, key: 'denied' },
    ];

    // AI score buckets
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];
    aiScored.forEach((s: any) => {
      const b = buckets.find((b) => s.ai_score >= b.min && s.ai_score <= b.max);
      if (b) b.count++;
    });

    // Pr. form
    const perForm = (forms || []).map((f) => ({
      name: f.name,
      count: submissions.filter((s) => s.form_id === f.id).length,
    }));

    return { total, pending, approved, denied, approvalRate, avgAiScore, days, statusData, buckets, perForm };
  }, [submissions, forms]);

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI'er */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total" value={stats.total} icon={Users} gradient="from-blue-500 to-indigo-600" />
        <Kpi label="Afventer" value={stats.pending} icon={Clock} gradient="from-amber-500 to-orange-600" />
        <Kpi label="Godkendt" value={stats.approved} icon={CheckCircle2} gradient="from-emerald-500 to-teal-600" />
        <Kpi label="Afvist" value={stats.denied} icon={XCircle} gradient="from-rose-500 to-pink-600" />
        <Kpi
          label="Godkendelses-rate"
          value={`${stats.approvalRate}%`}
          icon={TrendingUp}
          gradient="from-violet-500 to-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ansøgninger sidste 14 dage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.days}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#grad1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status-fordeling</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {stats.statusData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Score-fordeling
              {stats.avgAiScore != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Gennemsnit: <span className="font-bold text-foreground">{stats.avgAiScore}</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pr. ansøgningsform</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.perForm} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="hsl(280 70% 60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ApplicationAnalytics() {
  const { data: hasPremium } = useGuildPremium();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/dashboard/applications">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Tilbage
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Dyk ned i tendenser, AI-scores og staff-performance</p>
        </div>
      </div>

      {hasPremium ? (
        <AnalyticsContent />
      ) : (
        <PremiumLock
          title="Avanceret analytics"
          description="Få realtime dashboards over ansøgninger, AI-score fordeling, staff response-tider og meget mere — som en del af Applications Pro."
        >
          <AnalyticsContent />
        </PremiumLock>
      )}
    </div>
  );
}
