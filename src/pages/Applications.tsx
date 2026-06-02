import { useState } from 'react';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApplications, useApplicationStats, useUpdateApplicationStatus, ApplicationStatus, Application } from '@/hooks/useApplications';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClipboardList, CheckCircle, XCircle, Clock, TrendingUp, Calendar, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = {
    pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
    approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
    denied: { label: 'Denied', variant: 'destructive' as const, icon: XCircle },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface ApplicationCardProps {
  application: Application;
  onApprove: (app: Application) => void;
  onDeny: (app: Application) => void;
}

function ApplicationCard({ application, onApprove, onDeny }: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: roles } = useDiscordRoles();

  // Find role name for granted_role_id
  const grantedRole = application.granted_role_id 
    ? roles?.find((r) => r.id === application.granted_role_id)
    : null;

  const getRoleColorHex = (color: number) => {
    if (color === 0) return '#99AAB5';
    return '#' + color.toString(16).padStart(6, '0');
  };

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {application.discord_username || `User ${application.discord_user_id}`}
            </CardTitle>
            <CardDescription className="text-xs">
              {application.application_type} • {formatDistanceToNow(new Date(application.created_at), { addSuffix: true, locale: enUS })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {application.status === 'approved' && grantedRole && (
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: getRoleColorHex(grantedRole.color), color: getRoleColorHex(grantedRole.color) }}
              >
                🎭 {grantedRole.name}
              </Badge>
            )}
            {application.status === 'approved' && application.granted_role_id && !grantedRole && (
              <Badge variant="outline" className="text-xs">
                🎭 Role assigned
              </Badge>
            )}
            <StatusBadge status={application.status} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {application.answers.length > 0 && (
          <>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpanded(!expanded)}
              className="mb-2 p-0 h-auto text-muted-foreground"
            >
              {expanded ? 'Hide answers' : 'Show answers'} ({application.answers.length})
            </Button>
            {expanded && (
              <div className="space-y-2 mt-2">
                {application.answers.map((qa: any, i: number) => (
                  <div key={i} className="bg-muted/50 rounded-md p-2">
                    <p className="text-xs font-medium text-muted-foreground">{qa.question}</p>
                    <p className="text-sm">{qa.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {application.status === 'pending' ? (
          <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="default"
                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onApprove(application)}
              >
                <ThumbsUp className="h-3 w-3" />
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                className="gap-1"
                onClick={() => onDeny(application)}
              >
                <ThumbsDown className="h-3 w-3" />
                Deny
              </Button>
            </div>
          ) : (
            application.reviewer_name && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Reviewed by: {application.reviewer_name}
                </p>
                {application.reviewer_notes && (
                  <p className="text-xs text-muted-foreground">
                    Note: {application.reviewer_notes}
                  </p>
                )}
              </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default function Applications() {
  return (
    <PremiumGate feature="applications">
      <ApplicationsContent />
    </PremiumGate>
  );
}

function ApplicationsContent() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const { data: stats, isLoading: statsLoading } = useApplicationStats();
  const { data: roles, isLoading: rolesLoading } = useDiscordRoles();
  const { toast } = useToast();
  
  const statusFilter = activeTab === 'all' ? undefined : activeTab as ApplicationStatus;
  const { data: applications, isLoading } = useApplications(statusFilter);
  const updateStatus = useUpdateApplicationStatus();

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');
  const [sendDmOnDeny, setSendDmOnDeny] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const handleApprove = (app: Application) => {
    setSelectedApp(app);
    setActionType('approve');
    setNotes('');
    setSelectedRoleId('');
  };

  const handleDeny = (app: Application) => {
    setSelectedApp(app);
    setActionType('deny');
    setNotes('');
    setSendDmOnDeny(true);
  };

  const confirmAction = async () => {
    if (!selectedApp || !actionType) return;

    try {
      await updateStatus.mutateAsync({
        id: selectedApp.id,
        status: actionType === 'approve' ? 'approved' : 'denied',
        notes: notes || undefined,
        sendDm: actionType === 'deny' ? sendDmOnDeny : false,
        roleId: actionType === 'approve' && selectedRoleId ? selectedRoleId : undefined,
      });

      toast({
        title: actionType === 'approve' ? 'Application approved' : 'Application denied',
        description: `The application from ${selectedApp.discord_username || selectedApp.discord_user_id} has been ${actionType === 'approve' ? 'approved' : 'denied'}.`,
      });

      setSelectedApp(null);
      setActionType(null);
      setNotes('');
      setSelectedRoleId('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not update application',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Overview and administration of all applications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ClipboardList className="h-4 w-4" />
                Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-500">{stats?.pending || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Approval Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-500">{stats?.approvalRate || 0}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                This Week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.weekCount || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Applications List */}
          <Card>
            <CardHeader>
              <CardTitle>Application List</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All ({stats?.total || 0})</TabsTrigger>
                  <TabsTrigger value="pending">Pending ({stats?.pending || 0})</TabsTrigger>
                  <TabsTrigger value="approved">Approved ({stats?.approved || 0})</TabsTrigger>
                  <TabsTrigger value="denied">Denied ({stats?.denied || 0})</TabsTrigger>
              </TabsList>

                <ScrollArea className="h-[500px]">
                  {isLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : applications && applications.length > 0 ? (
                    applications.map((app) => (
                      <ApplicationCard 
                        key={app.id} 
                        application={app}
                        onApprove={handleApprove}
                        onDeny={handleDeny}
                      />
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No applications found
                    </p>
                )}
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={!!selectedApp && !!actionType} onOpenChange={() => { setSelectedApp(null); setActionType(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Approve application' : 'Deny application'}
              </DialogTitle>
              <DialogDescription>
                You are about to {actionType === 'approve' ? 'approve' : 'deny'} the application from{' '}
                <strong>{selectedApp?.discord_username || selectedApp?.discord_user_id}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {actionType === 'approve' && (
                <div className="space-y-2">
                  <Label className="text-sm">Assign role on approval</Label>
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select role (optional)"} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="none">No role</SelectItem>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5' }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If no role is selected, the server's default whitelist role will be used (if configured).
                  </p>
                </div>
              )}
              {actionType === 'deny' && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Send DM to user</Label>
                    <p className="text-xs text-muted-foreground">
                      Sends a Discord message with the denial (if bot can DM the user)
                    </p>
                  </div>
                  <Switch checked={sendDmOnDeny} onCheckedChange={setSendDmOnDeny} />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note to this decision..."
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedApp(null); setActionType(null); }}>
                Cancel
              </Button>
              <Button 
                onClick={confirmAction}
                disabled={updateStatus.isPending}
                variant={actionType === 'approve' ? 'default' : 'destructive'}
                className={actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {updateStatus.isPending ? 'Saving...' : actionType === 'approve' ? 'Approve' : 'Deny'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
