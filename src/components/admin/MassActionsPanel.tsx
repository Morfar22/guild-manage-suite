import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
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

export function MassActionsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cleanupInactiveGuilds = useMutation({
    mutationFn: async () => {
      // Find guilds where bot has been offline > 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('bot_status')
        .select('guild_id')
        .eq('is_online', false)
        .lt('last_heartbeat', thirtyDaysAgo);

      if (error) throw error;
      return { cleaned: data?.length || 0 };
    },
    onSuccess: (result) => {
      toast({ title: 'Resultat', description: `Fandt ${result.cleaned} inaktive guilds (30+ dage offline)` });
    },
    onError: (err: any) => {
      toast({ title: 'Fejl', description: err.message, variant: 'destructive' });
    },
  });

  const clearOldAnalytics = useMutation({
    mutationFn: async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from('analytics_events')
        .delete()
        .lt('created_at', ninetyDaysAgo);
      if (error) throw error;
      return { deleted: count || 0 };
    },
    onSuccess: (result) => {
      toast({ title: 'Ryddet op', description: `${result.deleted} gamle analytics events slettet` });
    },
    onError: (err: any) => {
      toast({ title: 'Fejl', description: err.message, variant: 'destructive' });
    },
  });

  const clearOldLogs = useMutation({
    mutationFn: async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from('moderation_logs')
        .delete()
        .lt('created_at', sixtyDaysAgo);
      if (error) throw error;
      return { deleted: count || 0 };
    },
    onSuccess: (result) => {
      toast({ title: 'Ryddet op', description: `${result.deleted} gamle moderation logs slettet` });
    },
    onError: (err: any) => {
      toast({ title: 'Fejl', description: err.message, variant: 'destructive' });
    },
  });

  const actions = [
    {
      label: 'Find inaktive guilds',
      description: 'Find guilds hvor botten har været offline i 30+ dage',
      icon: RefreshCw,
      mutation: cleanupInactiveGuilds,
      destructive: false,
    },
    {
      label: 'Ryd gamle analytics',
      description: 'Slet analytics events ældre end 90 dage',
      icon: Trash2,
      mutation: clearOldAnalytics,
      destructive: true,
    },
    {
      label: 'Ryd gamle mod-logs',
      description: 'Slet moderation logs ældre end 60 dage',
      icon: Trash2,
      mutation: clearOldLogs,
      destructive: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Massehandlinger
        </CardTitle>
        <CardDescription>Oprydning og vedligeholdelse af systemet</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {actions.map((action) => (
            <div key={action.label} className="p-4 rounded-lg border space-y-3">
              <div className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">{action.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{action.description}</p>
              {action.destructive ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full" disabled={action.mutation.isPending}>
                      {action.mutation.isPending ? 'Kører...' : 'Udfør'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                      <AlertDialogDescription>{action.description} — denne handling kan ikke fortrydes.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuller</AlertDialogCancel>
                      <AlertDialogAction onClick={() => action.mutation.mutate()}>Fortsæt</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => action.mutation.mutate()} disabled={action.mutation.isPending}>
                  {action.mutation.isPending ? 'Kører...' : 'Udfør'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
