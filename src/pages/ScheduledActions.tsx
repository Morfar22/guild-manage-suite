import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Clock, CheckCircle2, Timer } from 'lucide-react';
import { useScheduledActions } from '@/hooks/useScheduledActions';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

const ACTION_LABELS: Record<string, string> = {
  mute: 'Mute',
  ban: 'Ban',
  unban: 'Unban',
  role_add: 'Tilføj Rolle',
  role_remove: 'Fjern Rolle',
};

const ACTION_COLORS: Record<string, string> = {
  mute: 'bg-yellow-500/10 text-yellow-500',
  ban: 'bg-destructive/10 text-destructive',
  unban: 'bg-green-500/10 text-green-500',
  role_add: 'bg-primary/10 text-primary',
  role_remove: 'bg-orange-500/10 text-orange-500',
};

export default function ScheduledActions() {
  const { pendingActions, executedActions, isLoading, createAction, deleteAction } = useScheduledActions();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState('mute');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [executeAt, setExecuteAt] = useState('');
  const [reason, setReason] = useState('');
  const [roleId, setRoleId] = useState('');

  const showRoleField = actionType === 'role_add' || actionType === 'role_remove';

  const handleCreate = () => {
    if (!targetId || !executeAt) return;

    createAction.mutate(
      {
        action_type: actionType,
        target_discord_id: targetId,
        target_name: targetName || undefined,
        execute_at: new Date(executeAt).toISOString(),
        reason: reason || undefined,
        role_id: showRoleField ? roleId || undefined : undefined,
        created_by: user?.email?.split('@')[0] ?? 'unknown',
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTargetId('');
          setTargetName('');
          setExecuteAt('');
          setReason('');
          setRoleId('');
          setActionType('mute');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planlagte Handlinger</h1>
          <p className="text-muted-foreground">
            Planlæg moderationshandlinger der udføres automatisk på et specifikt tidspunkt
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny Handling
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Planlæg Handling</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Handlingstype</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mute">Mute</SelectItem>
                    <SelectItem value="ban">Ban</SelectItem>
                    <SelectItem value="unban">Unban</SelectItem>
                    <SelectItem value="role_add">Tilføj Rolle</SelectItem>
                    <SelectItem value="role_remove">Fjern Rolle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Discord ID</Label>
                <Input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="123456789012345678"
                />
              </div>

              <div className="space-y-2">
                <Label>Target Navn (valgfrit)</Label>
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Brugernavn"
                />
              </div>

              {showRoleField && (
                <div className="space-y-2">
                  <Label>Rolle ID</Label>
                  <Input
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    placeholder="Rolle ID"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Udfør på tidspunkt</Label>
                <Input
                  type="datetime-local"
                  value={executeAt}
                  onChange={(e) => setExecuteAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Grund (valgfrit)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Årsag for handlingen..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={!targetId || !executeAt || createAction.isPending}
                className="w-full"
              >
                {createAction.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Timer className="mr-2 h-4 w-4" />
                )}
                Planlæg Handling
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Afventende ({pendingActions.length})
            </CardTitle>
            <CardDescription>Handlinger der afventer udførelse</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Timer className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Ingen planlagte handlinger</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={ACTION_COLORS[action.action_type] ?? ''}>
                          {ACTION_LABELS[action.action_type] ?? action.action_type}
                        </Badge>
                        <Badge variant="outline">
                          {format(new Date(action.execute_at), 'PPP HH:mm', { locale: da })}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {action.target_name ?? action.target_discord_id}
                      </p>
                      {action.reason && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {action.reason}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAction.mutate(action.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Executed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Udført ({executedActions.length})
            </CardTitle>
            <CardDescription>Handlinger der er blevet udført</CardDescription>
          </CardHeader>
          <CardContent>
            {executedActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Ingen udførte handlinger endnu</p>
              </div>
            ) : (
              <div className="space-y-4">
                {executedActions.slice(0, 20).map((action) => (
                  <div key={action.id} className="rounded-lg border p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <Badge className={ACTION_COLORS[action.action_type] ?? ''}>
                        {ACTION_LABELS[action.action_type] ?? action.action_type}
                      </Badge>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        Udført {action.executed_at && format(new Date(action.executed_at), 'PPP HH:mm', { locale: da })}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm">
                      {action.target_name ?? action.target_discord_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
