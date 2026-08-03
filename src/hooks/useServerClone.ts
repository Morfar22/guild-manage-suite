import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { toast } from 'sonner';
import { invokeFunction } from '@/lib/functions-client';

export interface ServerTemplate {
  id: string;
  name: string;
  description: string | null;
  guild_id: string | null;
  created_by: string;
  is_public: boolean;
  channels: any[];
  roles: any[];
  categories: any[];
  bot_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Premium data counts
  message_count?: number;
  ban_count?: number;
  member_count?: number;
  thread_count?: number;
}

export interface ExportOptions {
  includeMessages?: boolean;
  messageCount?: number;
  includeBans?: boolean;
  includeMembers?: boolean;
  includeThreads?: boolean;
  includeServerSettings?: boolean;
}

export interface LoadOptions {
  channels?: boolean;
  roles?: boolean;
  deleteChannels?: boolean;
  deleteRoles?: boolean;
  messages?: boolean;
  bans?: boolean;
  members?: boolean;
  threads?: boolean;
  settings?: boolean;
}

export interface CloneResults {
  rolesCreated: number;
  categoriesCreated: number;
  channelsCreated: number;
  rolesDeleted: number;
  channelsDeleted: number;
  messagesCreated?: number;
  bansCreated?: number;
  membersUpdated?: number;
  settingsUpdated?: boolean;
  errors: string[];
}

export function useServerTemplates() {
  return useQuery({
    queryKey: ['server-templates'],
    queryFn: async () => {
      const { data, error } = await invokeFunction('server-clone', {
        body: { action: 'list-templates' },
      });

      if (error) throw error;
      return data.templates as ServerTemplate[];
    },
  });
}

export function useExportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceGuildId,
      templateName,
      templateDescription,
      isPublic,
      options = {},
    }: {
      sourceGuildId: string;
      templateName: string;
      templateDescription?: string;
      isPublic?: boolean;
      options?: ExportOptions;
    }) => {
      const { data, error } = await invokeFunction('server-clone', {
        body: {
          action: 'export',
          sourceGuildId,
          templateName,
          templateDescription,
          isPublic,
          includeMessages: options.includeMessages,
          messageCount: options.messageCount || 100,
          includeBans: options.includeBans,
          includeMembers: options.includeMembers,
          includeThreads: options.includeThreads,
          includeServerSettings: options.includeServerSettings,
        },
      });

      if (error) throw error;
      return data.template as ServerTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-templates'] });
      toast.success('Backup created!');
    },
    onError: (error) => {
      toast.error(`Backup failed: ${error.message}`);
    },
  });
}

export function useCloneServer() {
  return useMutation({
    mutationFn: async ({
      sourceGuildId,
      targetGuildId,
      templateId,
      loadOptions = {
        channels: true,
        roles: true,
        deleteChannels: true,
        deleteRoles: true,
        messages: false,
        bans: false,
        members: false,
        threads: false,
        settings: false,
      },
    }: {
      sourceGuildId?: string;
      targetGuildId: string;
      templateId?: string;
      loadOptions?: LoadOptions;
    }) => {
      const { data, error } = await invokeFunction('server-clone', {
        body: {
          action: 'clone',
          sourceGuildId,
          targetGuildId,
          templateId,
          loadOptions,
        },
      });

      if (error) throw error;
      return data.results as CloneResults;
    },
    onSuccess: (results) => {
      const parts = [];
      if (results.rolesDeleted > 0 || results.channelsDeleted > 0) {
        parts.push(`Deleted: ${results.rolesDeleted} roles, ${results.channelsDeleted} channels`);
      }
      parts.push(`Created: ${results.rolesCreated} roles, ${results.categoriesCreated} categories, ${results.channelsCreated} channels`);
      if (results.messagesCreated) parts.push(`${results.messagesCreated} messages`);
      if (results.bansCreated) parts.push(`${results.bansCreated} bans`);
      if (results.membersUpdated) parts.push(`${results.membersUpdated} members updated`);
      
      toast.success(parts.join('. '));
      if (results.errors.length > 0) {
        toast.warning(`${results.errors.length} errors occurred during cloning.`);
      }
    },
    onError: (error) => {
      toast.error(`Cloning failed: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await invokeFunction('server-clone', {
        body: {
          action: 'delete-template',
          templateId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-templates'] });
      toast.success('Template deleted!');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}
