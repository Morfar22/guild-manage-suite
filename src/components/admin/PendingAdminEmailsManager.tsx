import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Mail, Plus, Trash2, CheckCircle, Clock } from 'lucide-react';

export function PendingAdminEmailsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');

  const { data: emails, isLoading } = useQuery({
    queryKey: ['pending-admin-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_admin_emails')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addEmail = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('pending_admin_emails')
        .insert({ email: email.toLowerCase().trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-admin-emails'] });
      setNewEmail('');
      toast({ title: 'Tilføjet', description: 'Email tilføjet til pending admins' });
    },
    onError: (err: any) => {
      toast({ title: 'Fejl', description: err.message, variant: 'destructive' });
    },
  });

  const removeEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pending_admin_emails')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-admin-emails'] });
      toast({ title: 'Fjernet', description: 'Email fjernet' });
    },
  });

  const handleAdd = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast({ title: 'Fejl', description: 'Indtast en gyldig email', variant: 'destructive' });
      return;
    }
    addEmail.mutate(newEmail);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Admin Emails
        </CardTitle>
        <CardDescription>
          Emails her får automatisk admin-rolle ved næste Discord login
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="email@eksempel.dk"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={addEmail.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Tilføj
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : emails && emails.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {emails.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{e.email}</span>
                  {e.processed ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Behandlet
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Afventer
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEmail.mutate(e.id)}
                  disabled={removeEmail.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">Ingen pending emails</p>
        )}
      </CardContent>
    </Card>
  );
}
