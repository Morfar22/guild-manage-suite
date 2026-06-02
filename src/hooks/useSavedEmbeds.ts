import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';

export interface EmbedButton {
  label: string;
  url: string;
  emoji?: string;
}

export interface EmbedData {
  title?: string;
  description?: string;
  color?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
  thumbnail?: string;
  image?: string;
  author?: { name: string; icon_url?: string };
  timestamp?: boolean;
  buttons?: EmbedButton[];
}

export interface SavedEmbed {
  id: string;
  guild_id: string;
  name: string;
  embed_data: EmbedData;
  created_at: string;
  updated_at: string;
}

export function useSavedEmbeds() {
  const { selectedGuild } = useGuild();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['saved-embeds', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('saved_embeds')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedEmbed[];
    },
    enabled: !!selectedGuild?.id,
  });

  const saveEmbed = useMutation({
    mutationFn: async ({ name, embed_data }: { name: string; embed_data: EmbedData }) => {
      if (!selectedGuild?.id) throw new Error('No guild selected');
      const { error } = await supabase.from('saved_embeds').insert({
        guild_id: selectedGuild.id,
        name,
        embed_data: embed_data as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-embeds'] });
      toast.success('Embed gemt!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEmbed = useMutation({
    mutationFn: async ({ id, name, embed_data }: { id: string; name: string; embed_data: EmbedData }) => {
      const { error } = await supabase.from('saved_embeds').update({
        name,
        embed_data: embed_data as any,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-embeds'] });
      toast.success('Embed opdateret!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEmbed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_embeds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-embeds'] });
      toast.success('Embed slettet!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, saveEmbed, updateEmbed, deleteEmbed };
}
