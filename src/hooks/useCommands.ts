import { useState, useEffect, useCallback } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import {
  GuildCommandSettings,
  initializeGuildCommands,
  getGuildCommandSettings,
  toggleGuildCommand,
  toggleCategoryCommands,
  updateGuildCommandSettings,
  bulkUpdateGuildCommandSettings,
  recordCommandAudits,
} from '@/lib/commands';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { toast } from 'sonner';

export function useCommands() {
  const { selectedGuild } = useGuild();
  const [commandSettings, setCommandSettings] = useState<Record<string, GuildCommandSettings>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!selectedGuild) {
      setCommandSettings({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await initializeGuildCommands(selectedGuild.id);
      setCommandSettings(await getGuildCommandSettings(selectedGuild.id));
    } catch (err) {
      console.error('Error fetching commands:', err);
      toast.error('Kunne ikke hente kommandoer');
    } finally {
      setLoading(false);
    }
  }, [selectedGuild]);

  useEffect(() => {
    void load();
  }, [load]);

  const findCategory = useCallback((commandName: string) => {
    for (const [category, commands] of Object.entries(COMMANDS_BY_CATEGORY)) {
      if (commands.some((command) => command.name === commandName)) return category;
    }
    return 'utility';
  }, []);

  const toggleCommand = useCallback(async (commandName: string, enabled: boolean) => {
    if (!selectedGuild) return;
    const category = findCategory(commandName);
    const previous = commandSettings[commandName];

    setCommandSettings((prev) => ({
      ...prev,
      [commandName]: {
        ...(prev[commandName] || {
          command_name: commandName,
          category,
          cooldown_seconds: 0,
          allowed_role_ids: [],
          allowed_channel_ids: [],
        }),
        enabled,
      },
    }));

    try {
      setUpdating(true);
      await toggleGuildCommand(selectedGuild.id, commandName, category, enabled);
      await recordCommandAudits(selectedGuild.id, [{
        commandName,
        action: 'command_enabled_changed',
        details: {
          before: { enabled: previous?.enabled ?? true },
          after: { enabled },
        },
      }]);
      toast.success(`/${commandName} ${enabled ? 'aktiveret' : 'deaktiveret'}`);
    } catch {
      if (previous) setCommandSettings((prev) => ({ ...prev, [commandName]: previous }));
      toast.error('Kunne ikke opdatere kommandoen');
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild, findCategory, commandSettings]);

  const updateCommandSettings = useCallback(async (
    commandName: string,
    updates: Partial<Pick<GuildCommandSettings, 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>
  ) => {
    if (!selectedGuild) return;
    const category = findCategory(commandName);
    const previous = commandSettings[commandName];

    setCommandSettings((prev) => ({
      ...prev,
      [commandName]: {
        ...(prev[commandName] || {
          command_name: commandName,
          category,
          enabled: true,
          cooldown_seconds: 0,
          allowed_role_ids: [],
          allowed_channel_ids: [],
        }),
        ...updates,
      },
    }));

    try {
      setUpdating(true);
      await updateGuildCommandSettings(selectedGuild.id, commandName, category, updates);
      await recordCommandAudits(selectedGuild.id, [{
        commandName,
        action: 'command_settings_changed',
        details: {
          before: previous ?? null,
          changes: updates,
          after: {
            ...(previous || {}),
            ...updates,
          },
        },
      }]);
      toast.success(`Indstillinger for /${commandName} gemt`);
    } catch (error) {
      if (previous) setCommandSettings((prev) => ({ ...prev, [commandName]: previous }));
      console.error(error);
      toast.error('Kunne ikke gemme command-indstillinger');
      throw error;
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild, findCategory, commandSettings]);

  const toggleCategory = useCallback(async (category: string, enabled: boolean) => {
    if (!selectedGuild) return;
    const commands = COMMANDS_BY_CATEGORY[category];
    if (!commands) return;

    const snapshot = { ...commandSettings };
    setCommandSettings((prev) => {
      const next = { ...prev };
      for (const cmd of commands) {
        next[cmd.name] = {
          ...(next[cmd.name] || {
            command_name: cmd.name,
            category,
            cooldown_seconds: 0,
            allowed_role_ids: [],
            allowed_channel_ids: [],
          }),
          enabled,
        };
      }
      return next;
    });

    try {
      setUpdating(true);
      await toggleCategoryCommands(selectedGuild.id, category, enabled);
      await recordCommandAudits(
        selectedGuild.id,
        commands.map((cmd) => ({
          commandName: cmd.name,
          action: 'command_category_enabled_changed',
          details: {
            category,
            before: { enabled: snapshot[cmd.name]?.enabled ?? true },
            after: { enabled },
          },
        }))
      );
      toast.success(`Alle ${category}-kommandoer ${enabled ? 'aktiveret' : 'deaktiveret'}`);
    } catch {
      setCommandSettings(snapshot);
      toast.error('Kunne ikke opdatere kategorien');
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild, commandSettings]);

  const bulkUpdateCommands = useCallback(async (
    commandNames: string[],
    updates: Partial<Pick<GuildCommandSettings, 'enabled' | 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>
  ) => {
    if (!selectedGuild || commandNames.length === 0) return;

    const snapshot = { ...commandSettings };
    const entries = commandNames.map((commandName) => ({
      commandName,
      category: findCategory(commandName),
      updates,
    }));

    setCommandSettings((prev) => {
      const next = { ...prev };
      for (const { commandName, category } of entries) {
        next[commandName] = {
          ...(next[commandName] || {
            command_name: commandName,
            category,
            enabled: true,
            cooldown_seconds: 0,
            allowed_role_ids: [],
            allowed_channel_ids: [],
          }),
          ...updates,
        };
      }
      return next;
    });

    try {
      setUpdating(true);
      await bulkUpdateGuildCommandSettings(selectedGuild.id, entries);
      await recordCommandAudits(
        selectedGuild.id,
        entries.map(({ commandName, updates }) => ({
          commandName,
          action: 'command_bulk_settings_changed',
          details: {
            before: snapshot[commandName] ?? null,
            changes: updates,
            after: {
              ...(snapshot[commandName] || {}),
              ...updates,
            },
          },
        }))
      );
      toast.success(`${commandNames.length} commands opdateret`);
    } catch (error) {
      setCommandSettings(snapshot);
      console.error(error);
      toast.error('Kunne ikke bulk-opdatere commands');
      throw error;
    } finally {
      setUpdating(false);
    }
  }, [selectedGuild, commandSettings, findCategory]);

  const copyCommandRules = useCallback(async (sourceCommand: string, targetCommands: string[]) => {
    const source = commandSettings[sourceCommand];
    if (!source || targetCommands.length === 0) return;

    await bulkUpdateCommands(targetCommands.filter((name) => name !== sourceCommand), {
      cooldown_seconds: source.cooldown_seconds,
      allowed_role_ids: [...source.allowed_role_ids],
      allowed_channel_ids: [...source.allowed_channel_ids],
    });
  }, [commandSettings, bulkUpdateCommands]);

  const getCategoryStats = useCallback((category: string) => {
    const commands = COMMANDS_BY_CATEGORY[category] || [];
    const enabled = commands.filter((cmd) => commandSettings[cmd.name]?.enabled !== false).length;
    return {
      total: commands.length,
      enabled,
      allEnabled: enabled === commands.length,
      noneEnabled: enabled === 0,
    };
  }, [commandSettings]);

  const enabledCommands = Object.fromEntries(
    Object.entries(commandSettings).map(([name, settings]) => [name, settings.enabled])
  );

  return {
    commandSettings,
    enabledCommands,
    loading,
    updating,
    reload: load,
    toggleCommand,
    updateCommandSettings,
    bulkUpdateCommands,
    copyCommandRules,
    toggleCategory,
    getCategoryStats,
  };
}
