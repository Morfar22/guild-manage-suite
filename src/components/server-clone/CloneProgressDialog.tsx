import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Trash2, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CloneProgress {
  phase: 'preparing' | 'deleting_channels' | 'deleting_roles' | 'creating_roles' | 'creating_categories' | 'creating_channels' | 'creating_messages' | 'creating_bans' | 'updating_members' | 'complete' | 'error';
  current: number;
  total: number;
  currentItem?: string;
  results: {
    channelsDeleted: number;
    rolesDeleted: number;
    rolesCreated: number;
    categoriesCreated: number;
    channelsCreated: number;
    messagesCreated?: number;
    bansCreated?: number;
    membersUpdated?: number;
    errors: string[];
  };
}

interface CloneProgressDialogProps {
  open: boolean;
  progress: CloneProgress | null;
  targetGuildName: string;
}

const phaseLabels: Record<CloneProgress['phase'], string> = {
  preparing: 'Forbereder...',
  deleting_channels: 'Sletter kanaler',
  deleting_roles: 'Sletter roller',
  creating_roles: 'Opretter roller',
  creating_categories: 'Opretter kategorier',
  creating_channels: 'Opretter kanaler',
  creating_messages: 'Gendanner beskeder',
  creating_bans: 'Kopierer bans',
  updating_members: 'Opdaterer medlemmer',
  complete: 'Færdig!',
  error: 'Fejl',
};

const phaseIcons: Record<CloneProgress['phase'], React.ReactNode> = {
  preparing: <Loader2 className="h-4 w-4 animate-spin" />,
  deleting_channels: <Trash2 className="h-4 w-4 text-destructive" />,
  deleting_roles: <Trash2 className="h-4 w-4 text-destructive" />,
  creating_roles: <Plus className="h-4 w-4 text-green-500" />,
  creating_categories: <Plus className="h-4 w-4 text-green-500" />,
  creating_channels: <Plus className="h-4 w-4 text-green-500" />,
  creating_messages: <Plus className="h-4 w-4 text-blue-500" />,
  creating_bans: <Plus className="h-4 w-4 text-orange-500" />,
  updating_members: <Plus className="h-4 w-4 text-purple-500" />,
  complete: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
};

export function CloneProgressDialog({ open, progress, targetGuildName }: CloneProgressDialogProps) {
  const percentage = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  const isComplete = progress?.phase === 'complete';
  const isError = progress?.phase === 'error';

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress && phaseIcons[progress.phase]}
            Kloner til {targetGuildName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Phase */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {progress ? phaseLabels[progress.phase] : 'Starter...'}
            </span>
            <Badge variant={isComplete ? 'default' : isError ? 'destructive' : 'secondary'}>
              {isComplete ? 'Færdig' : isError ? 'Fejl' : `${percentage}%`}
            </Badge>
          </div>

          {/* Progress Bar */}
          <Progress value={isComplete ? 100 : percentage} className="h-2" />

          {/* Current Item */}
          {progress?.currentItem && !isComplete && (
            <p className="text-xs text-muted-foreground truncate">
              {progress.currentItem}
            </p>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <StatCard
              label="Kanaler slettet"
              value={progress?.results.channelsDeleted || 0}
              variant="destructive"
            />
            <StatCard
              label="Roller slettet"
              value={progress?.results.rolesDeleted || 0}
              variant="destructive"
            />
            <StatCard
              label="Roller oprettet"
              value={progress?.results.rolesCreated || 0}
              variant="success"
            />
            <StatCard
              label="Kategorier oprettet"
              value={progress?.results.categoriesCreated || 0}
              variant="success"
            />
            <StatCard
              label="Kanaler oprettet"
              value={progress?.results.channelsCreated || 0}
              variant="success"
            />
            {(progress?.results.messagesCreated ?? 0) > 0 && (
              <StatCard
                label="Beskeder gendannet"
                value={progress?.results.messagesCreated || 0}
                variant="info"
              />
            )}
            {(progress?.results.bansCreated ?? 0) > 0 && (
              <StatCard
                label="Bans kopieret"
                value={progress?.results.bansCreated || 0}
                variant="warning"
              />
            )}
            {(progress?.results.membersUpdated ?? 0) > 0 && (
              <StatCard
                label="Medlemmer opdateret"
                value={progress?.results.membersUpdated || 0}
                variant="info"
              />
            )}
          </div>

          {/* Errors */}
          {progress?.results.errors && progress.results.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-destructive mb-1">
                {progress.results.errors.length} fejl:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {progress.results.errors.slice(0, 5).map((error, i) => (
                  <li key={i} className="truncate">• {error}</li>
                ))}
                {progress.results.errors.length > 5 && (
                  <li className="text-muted-foreground">
                    ... og {progress.results.errors.length - 5} mere
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  label, 
  value, 
  variant,
  className 
}: { 
  label: string; 
  value: number; 
  variant: 'destructive' | 'success' | 'info' | 'warning';
  className?: string;
}) {
  const variantClasses = {
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-green-500/30 bg-green-500/5 text-green-500",
    info: "border-blue-500/30 bg-blue-500/5 text-blue-500",
    warning: "border-orange-500/30 bg-orange-500/5 text-orange-500",
  };

  return (
    <div className={cn(
      "rounded-lg border p-2 text-center",
      variantClasses[variant].split(' ').slice(0, 2).join(' '),
      className
    )}>
      <p className={cn(
        "text-lg font-bold",
        variantClasses[variant].split(' ')[2]
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
