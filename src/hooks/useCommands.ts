import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { 
  initializeGuildCommands, 
  getGuildCommands, 
  toggleGuildCommand,
  toggleCategoryCommands 
} from '@/lib/commands';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { toast } from 'sonner';

export function useCommands() {
  const { selectedGuild } = useGuild();
  const [enabledCommands, setEnabledCommands] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch and initialize commands
  useEffect(() => {
    if (!selectedGuild) {
      setEnabledCommands({});
      setLoading(false);
      return;
    }

    const fetchAndInitialize = async () => {
      setLoading(true);
      try {
        // Initialize commands if not already done
        if (!initialized) {
          await initializeGuildCommands(selectedGuild.id);
          setInitialized(true);
        }

        // Fetch command states
        const commands = await getGuildCommands(selectedGuild.id);
        setEnabledCommands(commands);
      } catch (err) {
        console.error('Error fetching commands:', err);
        toast.error('Failed to load commands');
      } finally {
        setLoading(false);
      }
    };

    fetchAndInitialize();
  }, [selectedGuild, initialized]);

  // Toggle a single command
  const toggleCommand = useCallback(async (commandName: string, enabled: boolean) => {
    if (!selectedGuild) return;

    // Find the category for this command
    let category = '';
    for (const [cat, commands] of Object.entries(COMMANDS_BY_CATEGORY)) {
      if (commands.some((c) => c.name === commandName)) {
        category = cat;
        break;
      }
    }

    // Optimistic update
    setEnabledCommands((prev) => ({ ...prev, [commandName]: enabled }));
    setUpdating(true);

    try {
      await toggleGuildCommand(selectedGuild.id, commandName, category, enabled);
      toast.success(`Command "${commandName}" ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Revert on error
      setEnabledCommands((prev) => ({ ...prev, [commandName]: !enabled }));
      toast.error('Failed to update command');
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild]);

  // Toggle all commands in a category
  const toggleCategory = useCallback(async (category: string, enabled: boolean) => {
    if (!selectedGuild) return;

    const commands = COMMANDS_BY_CATEGORY[category];
    if (!commands) return;

    // Optimistic update
    const updates: Record<string, boolean> = {};
    commands.forEach(cmd => {
      updates[cmd.name] = enabled;
    });
    setEnabledCommands((prev) => ({ ...prev, ...updates }));
    setUpdating(true);

    try {
      await toggleCategoryCommands(selectedGuild.id, category, enabled);
      toast.success(`All ${category} commands ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Revert on error
      const reverts: Record<string, boolean> = {};
      commands.forEach(cmd => {
        reverts[cmd.name] = !enabled;
      });
      setEnabledCommands((prev) => ({ ...prev, ...reverts }));
      toast.error('Failed to update commands');
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild]);

  // Calculate enabled count per category
  const getCategoryStats = useCallback((category: string) => {
    const commands = COMMANDS_BY_CATEGORY[category] || [];
    const enabledCount = commands.filter(cmd => enabledCommands[cmd.name] !== false).length;
    return {
      total: commands.length,
      enabled: enabledCount,
      allEnabled: enabledCount === commands.length,
      noneEnabled: enabledCount === 0,
    };
  }, [enabledCommands]);

  return {
    enabledCommands,
    loading,
    updating,
    toggleCommand,
    toggleCategory,
    getCategoryStats,
  };
}
