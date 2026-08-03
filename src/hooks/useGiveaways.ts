import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/lib/functions-client';

export interface Giveaway {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  prize: string;
  description: string | null;
  winners_count: number;
  ends_at: string;
  ended: boolean;
  required_role_id: string | null;
  host_user_id: string;
  host_username: string | null;
  entries: string[];
  winners: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useGiveaways() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: giveaways, isLoading, error } = useQuery({
    queryKey: ['giveaways', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Giveaway[];
    },
    enabled: !!selectedGuild?.id,
  });

  const createGiveaway = useMutation({
    mutationFn: async (giveaway: {
      channel_id: string;
      prize: string;
      description?: string;
      winners_count: number;
      ends_at: string;
      required_role_id?: string;
      host_user_id: string;
      host_username?: string;
    }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      // Use edge function to create giveaway AND send embed to Discord
      const { data, error } = await invokeFunction('giveaway-handler', {
        body: {
          action: 'create',
          giveawayData: {
            guild_id: selectedGuild.id,
            channel_id: giveaway.channel_id,
            prize: giveaway.prize,
            description: giveaway.description || null,
            winners_count: giveaway.winners_count,
            ends_at: giveaway.ends_at,
            required_role_id: giveaway.required_role_id || null,
            host_user_id: giveaway.host_user_id,
            host_username: giveaway.host_username || 'Dashboard',
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Show warning if embed couldn't be sent
      if (data?.warning) {
        toast({
          title: 'Advarsel',
          description: data.warning,
          variant: 'default',
        });
      }

      return data.giveaway;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giveaways', selectedGuild?.id] });
      toast({
        title: 'Giveaway oprettet',
        description: 'Din giveaway er nu aktiv og sendt til Discord.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fejl',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const endGiveaway = useMutation({
    mutationFn: async (giveawayId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await invokeFunction('giveaway-handler', {
        body: {
          action: 'end',
          guildId: selectedGuild.id,
          giveawayId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['giveaways', selectedGuild?.id] });
      const winnerCount = data?.winners?.length || 0;
      toast({
        title: 'Giveaway afsluttet',
        description: winnerCount > 0
          ? `${winnerCount} vinder${winnerCount > 1 ? 'e' : ''} er blevet trukket og annonceret i Discord.`
          : 'Ingen deltagere - ingen vindere trukket.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fejl',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rerollGiveaway = useMutation({
    mutationFn: async (giveawayId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await invokeFunction('giveaway-handler', {
        body: {
          action: 'reroll',
          guildId: selectedGuild.id,
          giveawayId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['giveaways', selectedGuild?.id] });
      toast({
        title: 'Ny vinder trukket',
        description: `En ny vinder er blevet trukket og annonceret i Discord.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fejl',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteGiveaway = useMutation({
    mutationFn: async (giveawayId: string) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');

      const { data, error } = await invokeFunction('giveaway-handler', {
        body: {
          action: 'delete',
          guildId: selectedGuild.id,
          giveawayId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giveaways', selectedGuild?.id] });
      toast({
        title: 'Giveaway slettet',
        description: 'Giveaway er blevet fjernet.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fejl',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  const activeGiveaways = giveaways?.filter(g => !g.ended && new Date(g.ends_at) > new Date()) || [];
  const endedGiveaways = giveaways?.filter(g => g.ended || new Date(g.ends_at) <= new Date()) || [];

  return {
    giveaways,
    activeGiveaways,
    endedGiveaways,
    isLoading,
    error,
    createGiveaway,
    endGiveaway,
    rerollGiveaway,
    deleteGiveaway,
  };
}
