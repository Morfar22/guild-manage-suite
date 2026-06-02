import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface ServerBackup {
  id: string;
  guild_id: string;
  backup_type: string;
  backup_data: any;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export function useServerBackups() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['server-backups', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('server_backups')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ServerBackup[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createBackup = useMutation({
    mutationFn: async (description?: string) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server-backup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ guildId: selectedGuild.id, action: 'create', description }),
        }
      );
      if (!response.ok) throw new Error('Backup fejlede');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-backups'] });
      toast.success('Backup oprettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreBackup = useMutation({
    mutationFn: async (backupId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server-backup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ guildId: selectedGuild.id, action: 'restore', backupId }),
        }
      );
      if (!response.ok) throw new Error('Gendannelse fejlede');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Server gendannet fra backup!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBackup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('server_backups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-backups'] });
      toast.success('Backup slettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, backups: query.data || [], createBackup, restoreBackup, deleteBackup };
}
