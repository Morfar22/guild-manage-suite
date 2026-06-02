import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAllUsers } from '@/hooks/useAdmin';
import { ShieldCheck, Trash2, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function UserRoleManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users } = useAllUsers();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [search, setSearch] = useState('');

  const { data: roles, isLoading } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast({ title: 'Rolle tilføjet' });
      setSelectedUserId('');
      setSelectedRole('');
    },
    onError: (err: any) => {
      toast({ title: 'Fejl', description: err.message, variant: 'destructive' });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['is-admin'] });
      toast({ title: 'Rolle fjernet' });
    },
  });

  const getUserEmail = (userId: string) => {
    return users?.find(u => u.id === userId)?.email || userId.slice(0, 8) + '...';
  };

  const filteredRoles = roles?.filter(r =>
    getUserEmail(r.user_id).toLowerCase().includes(search.toLowerCase()) ||
    (r.role as string).toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Bruger Roller
        </CardTitle>
        <CardDescription>Tildel og fjern admin/staff roller</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add role */}
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Vælg bruger" />
            </SelectTrigger>
            <SelectContent>
              {users?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rolle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => selectedUserId && selectedRole && addRole.mutate({ userId: selectedUserId, role: selectedRole })}
            disabled={!selectedUserId || !selectedRole || addRole.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tilføj
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Søg..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Role list */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filteredRoles.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredRoles.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{getUserEmail(r.user_id)}</span>
                  <Badge variant={r.role === 'admin' ? 'default' : 'secondary'}>
                    {r.role}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeRole.mutate(r.id)} disabled={removeRole.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">Ingen roller fundet</p>
        )}
      </CardContent>
    </Card>
  );
}
