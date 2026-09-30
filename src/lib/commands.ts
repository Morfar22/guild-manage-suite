import { supabase } from '@/integrations/supabase/client';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';

export interface GuildCommandSettings {
  command_name: string;
  category: string;
  enabled: boolean;
  cooldown_seconds: number;
  allowed_role_ids: string[];
  allowed_channel_ids: string[];
}

const getDefaultCommandSettings = (): Record<string, GuildCommandSettings> => {
  const out: Record<string, GuildCommandSettings> = {};
  for (const [category, commands] of Object.entries(COMMANDS_BY_CATEGORY)) {
    for (const command of commands) {
      out[command.name] = {
        command_name: command.name,
        category,
        enabled: true,
        cooldown_seconds: 0,
        allowed_role_ids: [],
        allowed_channel_ids: [],
      };
    }
  }
  return out;
};

export async function initializeGuildCommands(guildId: string): Promise<void> {
  const { data: existingCommands, error: fetchError } = await supabase
    .from('guild_commands')
    .select('command_name')
    .eq('guild_id', guildId);

  if (fetchError) throw fetchError;

  const existingCommandNames = new Set(existingCommands?.map((c) => c.command_name) || []);
  const commandsToInsert = Object.entries(COMMANDS_BY_CATEGORY).flatMap(([category, commands]) =>
    commands
      .filter((command) => !existingCommandNames.has(command.name))
      .map((command) => ({
        guild_id: guildId,
        command_name: command.name,
        category,
        enabled: true,
        cooldown_seconds: 0,
        allowed_role_ids: [] as string[],
        allowed_channel_ids: [] as string[],
      }))
  );

  if (!commandsToInsert.length) return;

  const { error } = await supabase.from('guild_commands').insert(commandsToInsert);
  if (error) throw error;
}

export async function getGuildCommandSettings(guildId: string): Promise<Record<string, GuildCommandSettings>> {
  const defaults = getDefaultCommandSettings();

  const { data, error } = await supabase
    .from('guild_commands')
    .select('command_name, category, enabled, cooldown_seconds, allowed_role_ids, allowed_channel_ids')
    .eq('guild_id', guildId);

  if (error) throw error;

  for (const row of data || []) {
    defaults[row.command_name] = {
      command_name: row.command_name,
      category: row.category,
      enabled: row.enabled,
      cooldown_seconds: row.cooldown_seconds ?? 0,
      allowed_role_ids: row.allowed_role_ids ?? [],
      allowed_channel_ids: row.allowed_channel_ids ?? [],
    };
  }

  return defaults;
}

export async function toggleGuildCommand(
  guildId: string,
  commandName: string,
  category: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('guild_commands')
    .upsert(
      { guild_id: guildId, command_name: commandName, category, enabled },
      { onConflict: 'guild_id,command_name' }
    );

  if (error) throw error;
}

export async function updateGuildCommandSettings(
  guildId: string,
  commandName: string,
  category: string,
  updates: Partial<Pick<GuildCommandSettings, 'enabled' | 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>
): Promise<void> {
  const { error } = await supabase
    .from('guild_commands')
    .upsert(
      {
        guild_id: guildId,
        command_name: commandName,
        category,
        ...updates,
      },
      { onConflict: 'guild_id,command_name' }
    );

  if (error) throw error;
}

export async function bulkUpdateGuildCommandSettings(
  guildId: string,
  entries: Array<{
    commandName: string;
    category: string;
    updates: Partial<Pick<GuildCommandSettings, 'enabled' | 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>;
  }>
): Promise<void> {
  if (!entries.length) return;

  const { error } = await supabase
    .from('guild_commands')
    .upsert(
      entries.map(({ commandName, category, updates }) => ({
        guild_id: guildId,
        command_name: commandName,
        category,
        ...updates,
      })),
      { onConflict: 'guild_id,command_name' }
    );

  if (error) throw error;
}

export async function toggleCategoryCommands(
  guildId: string,
  category: string,
  enabled: boolean
): Promise<void> {
  const commands = COMMANDS_BY_CATEGORY[category];
  if (!commands) return;

  const { error } = await supabase
    .from('guild_commands')
    .upsert(
      commands.map((cmd) => ({
        guild_id: guildId,
        command_name: cmd.name,
        category,
        enabled,
      })),
      { onConflict: 'guild_id,command_name' }
    );

  if (error) throw error;
}
