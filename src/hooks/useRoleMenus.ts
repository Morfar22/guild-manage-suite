import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface RoleMenuOption {
  role_id: string;
  role_name: string;
  emoji?: string;
  label?: string;
  description?: string;
}

export interface RoleMenu {
  id: string;
  guild_id: string;
  name: string;
  channel_id: string | null;
  message_id: string | null;
  menu_type: string;
  roles: RoleMenuOption[];
  max_roles: number;
  created_at: string;
  updated_at: string;
}

export function useRoleMenus() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const menusQuery = useQuery({
    queryKey: ['role-menus', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('role_menus')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        roles: Array.isArray(d.roles) ? d.roles : [],
      })) as RoleMenu[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createMenu = useMutation({
    mutationFn: async (data: { name: string; menu_type?: string; max_roles?: number }) => {
      if (!selectedGuild?.id) throw new Error('No guild');
      const { data: result, error } = await supabase
        .from('role_menus')
        .insert({
          guild_id: selectedGuild.id,
          name: data.name,
          menu_type: data.menu_type || 'dropdown',
          max_roles: data.max_roles || 0,
          roles: [],
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-menus'] });
      toast.success('Role menu oprettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMenu = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; menu_type?: string; max_roles?: number; roles?: RoleMenuOption[]; channel_id?: string; message_id?: string }) => {
      const { error } = await supabase.from('role_menus').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-menus'] });
      toast.success('Role menu opdateret!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMenu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('role_menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-menus'] });
      toast.success('Role menu slettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    menus: menusQuery.data ?? [],
    isLoading: menusQuery.isLoading,
    createMenu,
    updateMenu,
    deleteMenu,
  };
}
