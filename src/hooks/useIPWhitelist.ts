import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface IPWhitelistEntry {
  id: string;
  ip_address: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

interface IPCheckResult {
  allowed: boolean;
  ip: string;
  whitelistEmpty: boolean;
  message: string;
}

export function useIPWhitelist() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_ip_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as IPWhitelistEntry[];
    },
    enabled: !!user,
  });
}

export function useCheckIPAccess() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['ip-access-check'],
    queryFn: async () => {
      // IMPORTANT:
      // If the user is not authenticated, supabase-js will send the anon key as
      // the Authorization header, which will be rejected by admin-check-ip.
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('admin-check-ip', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        console.error('IP check error:', error);
        throw error;
      }
      
      return data as IPCheckResult;
    },
    enabled: !!session?.access_token,
    retry: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useAddIPToWhitelist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ip_address, description }: { ip_address: string; description?: string }) => {
      const { data, error } = await supabase
        .from('admin_ip_whitelist')
        .insert({
          ip_address,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['ip-access-check'] });
      toast.success('IP adresse tilføjet til whitelist');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Denne IP adresse er allerede på whitelist');
      } else {
        toast.error('Kunne ikke tilføje IP adresse');
      }
    },
  });
}

export function useRemoveIPFromWhitelist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_ip_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['ip-access-check'] });
      toast.success('IP adresse fjernet fra whitelist');
    },
    onError: () => {
      toast.error('Kunne ikke fjerne IP adresse');
    },
  });
}
