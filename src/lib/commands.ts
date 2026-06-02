import { supabase } from '@/integrations/supabase/client';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';

/**
 * Initialize all default commands for a guild if they don't exist
 */
export async function initializeGuildCommands(guildId: string): Promise<void> {
  // Get existing commands for this guild
  const { data: existingCommands, error: fetchError } = await supabase
    .from('guild_commands')
    .select('command_name')
    .eq('guild_id', guildId);

  if (fetchError) {
    console.error('Error fetching existing commands:', fetchError);
    throw fetchError;
  }

  const existingCommandNames = new Set(existingCommands?.map(c => c.command_name) || []);

  // Build list of commands to insert
  const commandsToInsert: Array<{
    guild_id: string;
    command_name: string;
    category: string;
    enabled: boolean;
  }> = [];

  for (const [category, commands] of Object.entries(COMMANDS_BY_CATEGORY)) {
    for (const command of commands) {
      if (!existingCommandNames.has(command.name)) {
        commandsToInsert.push({
          guild_id: guildId,
          command_name: command.name,
          category: category,
          enabled: true, // Enable by default
        });
      }
    }
  }

  if (commandsToInsert.length === 0) {
    console.log('All commands already initialized for guild:', guildId);
    return;
  }

  console.log(`Initializing ${commandsToInsert.length} commands for guild:`, guildId);

  const { error: insertError } = await supabase
    .from('guild_commands')
    .insert(commandsToInsert);

  if (insertError) {
    console.error('Error initializing commands:', insertError);
    throw insertError;
  }

  console.log('Commands initialized successfully');
}

/**
 * Get all commands for a guild with their enabled status
 */
export async function getGuildCommands(guildId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('guild_commands')
    .select('command_name, enabled')
    .eq('guild_id', guildId);

  if (error) {
    console.error('Error fetching guild commands:', error);
    throw error;
  }

  const commandState: Record<string, boolean> = {};
  
  // First, set all commands to enabled by default
  for (const commands of Object.values(COMMANDS_BY_CATEGORY)) {
    for (const command of commands) {
      commandState[command.name] = true;
    }
  }

  // Then override with actual database values
  data?.forEach((c) => {
    commandState[c.command_name] = c.enabled;
  });

  return commandState;
}

/**
 * Toggle a command for a guild
 */
export async function toggleGuildCommand(
  guildId: string,
  commandName: string,
  category: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('guild_commands')
    .upsert(
      {
        guild_id: guildId,
        command_name: commandName,
        category: category,
        enabled: enabled,
      },
      {
        onConflict: 'guild_id,command_name',
      }
    );

  if (error) {
    console.error('Error toggling command:', error);
    throw error;
  }
}

/**
 * Bulk enable/disable commands by category
 */
export async function toggleCategoryCommands(
  guildId: string,
  category: string,
  enabled: boolean
): Promise<void> {
  const commands = COMMANDS_BY_CATEGORY[category];
  if (!commands) return;

  const commandsToUpsert = commands.map(cmd => ({
    guild_id: guildId,
    command_name: cmd.name,
    category: category,
    enabled: enabled,
  }));

  const { error } = await supabase
    .from('guild_commands')
    .upsert(commandsToUpsert, {
      onConflict: 'guild_id,command_name',
    });

  if (error) {
    console.error('Error toggling category commands:', error);
    throw error;
  }
}
