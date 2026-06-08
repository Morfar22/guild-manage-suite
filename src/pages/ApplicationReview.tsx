import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ArrowLeft, User, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApplicationSubmission, useReviewApplication } from '@/hooks/useApplicationSubmissions';
import { useAuth } from '@/contexts/AuthContext';
import { AiScoreCard } from '@/components/applications/AiScoreCard';
import { useGuildPremium } from '@/hooks/useGuildPremium';
import { PremiumBadge } from '@/components/applications/PremiumLock';

const statusConfig = {
  pending: { label: 'Pending', variant: 'default' as const, icon: Clock },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  denied: { label: 'Denied', variant: 'destructive' as const, icon: XCircle },
};

export default function ApplicationReview() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: submission, isLoading } = useApplicationSubmission(submissionId);
  const { data: hasPremium } = useGuildPremium();
  const reviewMutation = useReviewApplication();

  const [notes, setNotes] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);

  const handleReview = async (status: 'approved' | 'denied') => {
    if (!submission || !user) return;

    const meta = (user.user_metadata || {}) as Record<string, any>;
    const discordName =
      meta.custom_claims?.global_name ||
      meta.full_name ||
      meta.name ||
      meta.user_name ||
      meta.preferred_username ||
      user.email ||
      'Dashboard User';
    const discordId = meta.provider_id || meta.sub || '';

    await reviewMutation.mutateAsync({
      submissionId: submission.id,
      status,
      reviewerName: discordName,
      reviewerDiscordId: discordId,
      notes: notes || undefined,
    });

    setApproveDialogOpen(false);
    setDenyDialogOpen(false);
    navigate('/dashboard/applications');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Application not found</h2>
        <Button onClick={() => navigate('/dashboard/applications')}>
          Go back
        </Button>
      </div>
    );
  }

  const config = statusConfig[submission.status];
  const StatusIcon = config.icon;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/applications')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Review Application</h1>
            <p className="text-muted-foreground">
              {submission.form?.emoji} {submission.form?.name}
            </p>
          </div>
          {submission.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setDenyDialogOpen(true)}
                disabled={reviewMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Deny
              </Button>
              <Button
                onClick={() => setApproveDialogOpen(true)}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {hasPremium && (
              <AiScoreCard
                submissionId={submission.id}
                score={(submission as any).ai_score ?? null}
                summary={(submission as any).ai_summary ?? null}
                flags={((submission as any).ai_flags as string[]) ?? null}
                reasoning={(submission as any).ai_reasoning ?? null}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Application Answers
                  {hasPremium && <PremiumBadge />}
                </CardTitle>
                <CardDescription>
                  Submitted on {format(new Date(submission.created_at), "MMMM d, yyyy 'at' HH:mm", { locale: enUS })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {submission.answers.length === 0 ? (
                  <p className="text-muted-foreground">No answers provided</p>
                ) : (
                  submission.answers.map((answer, index) => (
                    <div key={index}>
                      <Label className="text-sm font-medium text-muted-foreground">
                        {answer.question}
                      </Label>
                      <p className="mt-1 whitespace-pre-wrap">{answer.answer || '—'}</p>
                      {index < submission.answers.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {submission.status !== 'pending' && submission.reviewer_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Review Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{submission.reviewer_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Applicant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={submission.discord_avatar || undefined} />
                    <AvatarFallback>
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{submission.discord_username || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">ID: {submission.discord_user_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={config.variant} className="text-sm">
                    <StatusIcon className="h-4 w-4 mr-1" />
                    {config.label}
                  </Badge>
                </div>
                {submission.reviewed_at && (
                  <div className="text-sm text-muted-foreground">
                    <p>Reviewed by: {submission.reviewer_name || 'Unknown'}</p>
                    <p>On: {format(new Date(submission.reviewed_at), "MMM d, yyyy 'at' HH:mm", { locale: enUS })}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Application</DialogTitle>
            <DialogDescription>
              This will approve the application and grant any configured roles to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleReview('approved')}
              disabled={reviewMutation.isPending}
            >
              Approve Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Application</DialogTitle>
            <DialogDescription>
              This will deny the application. The user will be notified if DM notifications are enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a reason for the denial..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview('denied')}
              disabled={reviewMutation.isPending}
            >
              Deny Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
