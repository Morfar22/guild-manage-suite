import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { FileText, Settings, Clock, CheckCircle, XCircle, User, Filter, BarChart3, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplicationSubmissions, ApplicationSubmission } from '@/hooks/useApplicationSubmissions';
import { useApplicationForms } from '@/hooks/useApplicationForms';

const statusConfig = {
  pending: { label: 'Pending', variant: 'default' as const, icon: Clock },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  denied: { label: 'Denied', variant: 'destructive' as const, icon: XCircle },
};

function ApplicationCard({ submission, onClick }: { submission: ApplicationSubmission; onClick: () => void }) {
  const config = statusConfig[submission.status];
  const StatusIcon = config.icon;
  const aiScore = (submission as any).ai_score as number | null;

  const scoreColor =
    aiScore == null
      ? ''
      : aiScore >= 80
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : aiScore >= 60
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : aiScore >= 40
      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={submission.discord_avatar || undefined} />
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium truncate">{submission.discord_username || 'Unknown User'}</span>
              <Badge variant={config.variant} className="shrink-0">
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {aiScore != null && (
                <Badge variant="outline" className={`shrink-0 ${scoreColor}`}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI {aiScore}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{submission.form?.emoji}</span>
              <span>{submission.form?.name}</span>
              <span>•</span>
              <span>{format(new Date(submission.created_at), 'MMM d, yyyy', { locale: enUS })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationList() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'approved' | 'denied' | undefined>(undefined);
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  
  const { data: submissions, isLoading } = useApplicationSubmissions(selectedStatus);
  const { data: forms } = useApplicationForms();

  const filteredSubmissions = submissions?.filter(s => 
    selectedFormId === 'all' || s.form_id === selectedFormId
  );

  const pendingCount = submissions?.filter(s => s.status === 'pending').length || 0;
  const approvedCount = submissions?.filter(s => s.status === 'approved').length || 0;
  const deniedCount = submissions?.filter(s => s.status === 'denied').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Review and manage application submissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/dashboard/applications/analytics')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard/applications/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-2xl font-bold">{pendingCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{approvedCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{deniedCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <Select value={selectedFormId} onValueChange={setSelectedFormId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All forms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All forms</SelectItem>
            {forms?.map((form) => (
              <SelectItem key={form.id} value={form.id}>
                {form.emoji} {form.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedStatus || 'all'} onValueChange={(v) => setSelectedStatus(v === 'all' ? undefined : v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="denied">Denied</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus || 'all'} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredSubmissions?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No applications</h3>
                <p className="text-muted-foreground text-sm">
                  {selectedStatus === 'pending' 
                    ? 'No pending applications to review'
                    : 'No applications match your filters'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions?.map((submission) => (
                <ApplicationCard
                  key={submission.id}
                  submission={submission}
                  onClick={() => navigate(`/dashboard/applications/${submission.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
