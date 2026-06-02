import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Archive, Plus, RotateCcw, Trash2, Loader2, Clock, CalendarClock } from 'lucide-react';
import { useServerBackups } from '@/hooks/useServerBackups';
import { useBackupSchedule } from '@/hooks/useBackupSchedule';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function BackupSettings() {
  const { backups, isLoading, createBackup, restoreBackup, deleteBackup } = useServerBackups();
  const { schedule, isLoading: scheduleLoading, upsertSchedule } = useBackupSchedule();
  const [description, setDescription] = useState('');
  
  const [scheduleForm, setScheduleForm] = useState<{
    enabled: boolean;
    frequency: string;
    max_backups: number;
  } | null>(null);

  const currentSchedule = scheduleForm ?? {
    enabled: schedule?.enabled ?? false,
    frequency: schedule?.frequency ?? 'daily',
    max_backups: schedule?.max_backups ?? 5,
  };

  const handleCreate = () => {
    createBackup.mutate(description || undefined);
    setDescription('');
  };

  const handleSaveSchedule = () => {
    upsertSchedule.mutate(currentSchedule);
    setScheduleForm(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Archive className="h-8 w-8" /> Backups</h1>
        <p className="text-muted-foreground">Opret og gendan server-konfiguration snapshots</p>
      </div>

      {/* Backup Scheduler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Automatisk Backup
          </CardTitle>
          <CardDescription>Planlæg automatiske backups af din server-konfiguration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleLoading ? (
            <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aktiver automatisk backup</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Botten opretter automatisk backups efter planen</p>
                </div>
                <Switch
                  checked={currentSchedule.enabled}
                  onCheckedChange={(v) => setScheduleForm({ ...currentSchedule, enabled: v })}
                />
              </div>

              {currentSchedule.enabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frekvens</Label>
                    <Select value={currentSchedule.frequency} onValueChange={(v) => setScheduleForm({ ...currentSchedule, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Dagligt</SelectItem>
                        <SelectItem value="weekly">Ugentligt</SelectItem>
                        <SelectItem value="monthly">Månedligt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Maks antal backups</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={currentSchedule.max_backups}
                      onChange={(e) => setScheduleForm({ ...currentSchedule, max_backups: parseInt(e.target.value) || 5 })}
                    />
                    <p className="text-xs text-muted-foreground">Ældre backups slettes automatisk</p>
                  </div>
                </div>
              )}

              {schedule?.last_backup_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Sidste automatiske backup: {format(new Date(schedule.last_backup_at), 'dd/MM/yyyy HH:mm')}
                </div>
              )}
              {schedule?.next_backup_at && currentSchedule.enabled && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  Næste backup: {format(new Date(schedule.next_backup_at), 'dd/MM/yyyy HH:mm')}
                </div>
              )}

              <Button onClick={handleSaveSchedule} disabled={upsertSchedule.isPending}>
                {upsertSchedule.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Gem plan
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual backup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opret Manuel Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Backup beskrivelse (valgfrit)..."
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={createBackup.isPending}>
              {createBackup.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Opret Backup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backups ({backups.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen backups endnu</p>
          ) : (
            backups.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{b.backup_type}</Badge>
                    <span className="text-sm font-medium">{b.description || 'Ingen beskrivelse'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(b.created_at), 'dd/MM/yyyy HH:mm:ss')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <RotateCcw className="h-4 w-4 mr-1" /> Gendan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Gendan fra backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Dette vil gendanne server-konfigurationen fra denne backup. Eksisterende konfiguration vil blive overskrevet.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={() => restoreBackup.mutate(b.id)}>Gendan</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button size="icon" variant="ghost" onClick={() => deleteBackup.mutate(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
