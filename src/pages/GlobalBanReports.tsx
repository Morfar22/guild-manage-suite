import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGlobalBanReports, useGlobalBans, useApproveReport, useRejectReport, useRemoveGlobalBan, useCreateDirectBan } from '@/hooks/useGlobalBans';
import { useGlobalBanAppeals, useApproveAppeal, useRejectAppeal } from '@/hooks/useGlobalBanAppeals';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Shield, Check, X, Ban, ExternalLink, Clock, User, BarChart3, MessageSquare, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';
import { Link } from '@tanstack/react-router';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  cheating: 'text-red-600 border-red-600',
  harassment: 'text-orange-600 border-orange-600',
  scam: 'text-amber-600 border-amber-600',
  raiding: 'text-purple-600 border-purple-600',
  tos_violation: 'text-pink-600 border-pink-600',
  other: 'text-muted-foreground border-muted-foreground',
};

const SEVERITY_LABELS: Record<string, string> = {
  cheating: 'Cheating',
  harassment: 'Chikane',
  scam: 'Scam',
  raiding: 'Raiding',
  tos_violation: 'ToS Overtrædelse',
  other: 'Andet',
};

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#a855f7', '#ec4899', '#6b7280'];

function SeverityBadge({ severity }: { severity?: string }) {
  const sev = severity || 'other';
  return (
    <Badge variant="outline" className={SEVERITY_COLORS[sev] || SEVERITY_COLORS.other}>
      {SEVERITY_LABELS[sev] || sev}
    </Badge>
  );
}

function useGlobalBanStats() {
  return useQuery({
    queryKey: ['global-ban-stats'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-ban-handler?action=stats`,
        { headers: { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Failed');
      return (await res.json()).stats as {
        totalBans: number;
        pendingReports: number;
        approvedReports: number;
        rejectedReports: number;
        approvalRate: number;
        pendingAppeals: number;
        severityCounts: Record<string, number>;
        monthlyTrend: { month: string; count: number }[];
      };
    },
  });
}

export default function GlobalBanReports() {
  const [tab, setTab] = useState('pending');
  const [reviewNote, setReviewNote] = useState('');
  const [directBanOpen, setDirectBanOpen] = useState(false);
  const [directBanForm, setDirectBanForm] = useState({ target_discord_id: '', target_discord_name: '', reason: '', severity: 'other' });

  const { data: reports, isLoading: reportsLoading } = useGlobalBanReports(tab === 'active' || tab === 'appeals' || tab === 'stats' ? undefined : tab);
  const { data: bans, isLoading: bansLoading } = useGlobalBans();
  const { data: appeals, isLoading: appealsLoading } = useGlobalBanAppeals(tab === 'appeals' ? 'pending' : undefined);
  const { data: stats, isLoading: statsLoading } = useGlobalBanStats();
  const approve = useApproveReport();
  const reject = useRejectReport();
  const removeBan = useRemoveGlobalBan();
  const directBan = useCreateDirectBan();
  const approveAppeal = useApproveAppeal();
  const rejectAppeal = useRejectAppeal();

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Afventer</Badge>;
      case 'approved': return <Badge className="bg-green-600">Godkendt</Badge>;
      case 'rejected': return <Badge variant="destructive">Afvist</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Global Ban System</h1>
            <p className="text-muted-foreground">Administrer globale ban-rapporter</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={directBanOpen} onOpenChange={setDirectBanOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Opret Global Ban
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opret direkte global ban</DialogTitle>
                <DialogDescription>Ban en bruger på tværs af alle servere uden rapport-flow.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Discord User ID *</Label>
                  <Input placeholder="f.eks. 123456789012345678" value={directBanForm.target_discord_id} onChange={(e) => setDirectBanForm(p => ({ ...p, target_discord_id: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Discord Brugernavn</Label>
                  <Input placeholder="f.eks. bruger#1234" value={directBanForm.target_discord_name} onChange={(e) => setDirectBanForm(p => ({ ...p, target_discord_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Begrundelse *</Label>
                  <Textarea placeholder="Beskriv grunden til ban..." value={directBanForm.reason} onChange={(e) => setDirectBanForm(p => ({ ...p, reason: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={directBanForm.severity} onValueChange={(v) => setDirectBanForm(p => ({ ...p, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheating">Cheating</SelectItem>
                      <SelectItem value="harassment">Chikane</SelectItem>
                      <SelectItem value="scam">Scam</SelectItem>
                      <SelectItem value="raiding">Raiding</SelectItem>
                      <SelectItem value="tos_violation">ToS Overtrædelse</SelectItem>
                      <SelectItem value="other">Andet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDirectBanOpen(false)}>Annuller</Button>
                <Button
                  disabled={!directBanForm.target_discord_id || !directBanForm.reason || directBan.isPending}
                  onClick={() => {
                    directBan.mutate(directBanForm, {
                      onSuccess: () => {
                        setDirectBanOpen(false);
                        setDirectBanForm({ target_discord_id: '', target_discord_name: '', reason: '', severity: 'other' });
                      },
                    });
                  }}
                >
                  {directBan.isPending ? 'Opretter...' : 'Opret Ban'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link to="/admin">
            <Button variant="outline">Tilbage til Admin</Button>
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">Afventende</TabsTrigger>
          <TabsTrigger value="approved">Godkendte</TabsTrigger>
          <TabsTrigger value="rejected">Afviste</TabsTrigger>
          <TabsTrigger value="active">Aktive Bans</TabsTrigger>
          <TabsTrigger value="appeals" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Appeals
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Statistik
          </TabsTrigger>
        </TabsList>

        {/* Reports tabs */}
        {['pending', 'approved', 'rejected'].map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            {reportsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {statusBadge(report.status)}
                            <SeverityBadge severity={(report as any).severity} />
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: da })}
                            </span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Anmeldt bruger</p>
                              <p className="font-medium flex items-center gap-1">
                                <Ban className="h-4 w-4 text-destructive" />
                                {report.target_discord_name}
                                <span className="text-xs text-muted-foreground font-mono">({report.target_discord_id})</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Anmelder</p>
                              <p className="font-medium flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {report.reporter_discord_name}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Begrundelse</p>
                            <p className="text-sm">{report.reason}</p>
                          </div>

                          {report.evidence_urls && report.evidence_urls.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Beviser</p>
                              <div className="flex gap-2 flex-wrap">
                                {report.evidence_urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-primary flex items-center gap-1 hover:underline">
                                    <ExternalLink className="h-3 w-3" /> Bevis {i + 1}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {report.review_note && (
                            <div className="p-2 rounded bg-muted text-sm">
                              <p className="text-xs text-muted-foreground">Staff-kommentar</p>
                              <p>{report.review_note}</p>
                            </div>
                          )}
                        </div>

                        {tabKey === 'pending' && (
                          <div className="flex flex-col gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="default" onClick={() => setReviewNote('')}>
                                  <Check className="h-4 w-4 mr-1" /> Godkend
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Godkend global ban?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {report.target_discord_name} ({report.target_discord_id}) vil blive banned på alle servere.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Textarea placeholder="Kommentar (valgfri)..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => approve.mutate({ reportId: report.id, reviewNote })} disabled={approve.isPending}>
                                    Godkend Ban
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" onClick={() => setReviewNote('')}>
                                  <X className="h-4 w-4 mr-1" /> Afvis
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Afvis rapport?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Rapporten mod {report.target_discord_name} vil blive afvist.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Textarea placeholder="Begrundelse for afvisning..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => reject.mutate({ reportId: report.id, reviewNote })}
                                    disabled={reject.isPending}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Afvis
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Ingen {tabKey === 'pending' ? 'afventende' : tabKey === 'approved' ? 'godkendte' : 'afviste'} rapporter
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}

        {/* Active Bans tab */}
        <TabsContent value="active">
          {bansLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : bans && bans.length > 0 ? (
            <div className="space-y-3">
              {bans.map((ban) => (
                <Card key={ban.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium flex items-center gap-2">
                          <Ban className="h-4 w-4 text-destructive" />
                          {ban.target_discord_name}
                          <span className="text-xs font-mono text-muted-foreground">({ban.target_discord_id})</span>
                          <SeverityBadge severity={(ban as any).severity} />
                        </p>
                        <p className="text-sm text-muted-foreground">{ban.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ban.created_at), { addSuffix: true, locale: da })}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">Fjern Ban</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Fjern global ban?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {ban.target_discord_name} vil ikke længere være globalt banned.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuller</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeBan.mutate(ban.id)} disabled={removeBan.isPending}>
                              Fjern Ban
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Ingen aktive globale bans
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Appeals tab */}
        <TabsContent value="appeals">
          {appealsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : appeals && appeals.length > 0 ? (
            <div className="space-y-3">
              {appeals.map((appeal) => (
                <Card key={appeal.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {statusBadge(appeal.status)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true, locale: da })}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ansøger</p>
                          <p className="font-medium">{appeal.appellant_discord_name} <span className="text-xs font-mono text-muted-foreground">({appeal.appellant_discord_id})</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Begrundelse for appeal</p>
                          <p className="text-sm">{appeal.reason}</p>
                        </div>
                        {appeal.review_note && (
                          <div className="p-2 rounded bg-muted text-sm">
                            <p className="text-xs text-muted-foreground">Staff-kommentar</p>
                            <p>{appeal.review_note}</p>
                          </div>
                        )}
                      </div>
                      {appeal.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="default" onClick={() => setReviewNote('')}>
                                <Check className="h-4 w-4 mr-1" /> Godkend
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Godkend appeal?</AlertDialogTitle>
                                <AlertDialogDescription>Bannet vil blive fjernet.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea placeholder="Kommentar (valgfri)..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction onClick={() => approveAppeal.mutate({ appealId: appeal.id, reviewNote })} disabled={approveAppeal.isPending}>
                                  Godkend Appeal
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" onClick={() => setReviewNote('')}>
                                <X className="h-4 w-4 mr-1" /> Afvis
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Afvis appeal?</AlertDialogTitle>
                                <AlertDialogDescription>Bannet forbliver aktivt.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea placeholder="Begrundelse..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => rejectAppeal.mutate({ appealId: appeal.id, reviewNote })}
                                  disabled={rejectAppeal.isPending}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Afvis
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Ingen afventende appeals
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Stats tab */}
        <TabsContent value="stats">
          {statsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{stats.totalBans}</p>
                    <p className="text-sm text-muted-foreground">Totale Bans</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-yellow-600">{stats.pendingReports}</p>
                    <p className="text-sm text-muted-foreground">Afventende Rapporter</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.approvalRate}%</p>
                    <p className="text-sm text-muted-foreground">Godkendelsesrate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-blue-600">{stats.pendingAppeals}</p>
                    <p className="text-sm text-muted-foreground">Afventende Appeals</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-4">Ban Trend (6 måneder)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stats.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Bans" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-4">Severity Fordeling</h3>
                    {Object.keys(stats.severityCounts).length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={Object.entries(stats.severityCounts).map(([name, value]) => ({ name: SEVERITY_LABELS[name] || name, value }))}
                            cx="50%" cy="50%" outerRadius={90}
                            dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                          >
                            {Object.keys(stats.severityCounts).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-12">Ingen data endnu</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
