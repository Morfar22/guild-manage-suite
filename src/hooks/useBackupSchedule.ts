import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface BackupSchedule {
  id: string;
  guild_id: string;
  enabled: boolean;
  frequency: string;
  max_backups: number;
  last_backup_at: string | null;
  next_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useBackupSchedule() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['backup-schedule', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return null;
      const { data, error } = await supabase
        .from('backup_schedules')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as BackupSchedule | null;
    },
    enabled: !!selectedGuild?.id,
  });

  const upsertSchedule = useMutation({
    mutationFn: async (data: { enabled: boolean; frequency: string; max_backups: number }) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { error } = await supabase
        .from('backup_schedules')
        .upsert({
          guild_id: selectedGuild.id,
          ...data,
          next_backup_at: data.enabled ? calculateNextBackup(data.frequency) : null,
        }, { onConflict: 'guild_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedule'] });
      toast.success('Backup-plan opdateret!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    schedule: query.data,
    isLoading: query.isLoading,
    upsertSchedule,
  };
}

function calculateNextBackup(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
  }
  now.setHours(3, 0, 0, 0); // 3 AM
  return now.toISOString();
}
