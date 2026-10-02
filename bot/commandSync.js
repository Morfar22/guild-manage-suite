/**
 * Semantic Discord application-command comparison.
 *
 * Discord may omit default-valued fields (false/null/empty arrays) in GET
 * responses even when a SlashCommandBuilder emitted them during deployment.
 * Compare normalized command meaning instead of raw REST payload shape.
 */

function normalizeChoice(choice) {
  return {
    name: choice?.name ?? '',
    value: choice?.value,
    ...(choice?.name_localizations ? { name_localizations: choice.name_localizations } : {}),
  };
}

function normalizeOption(option) {
  const normalized = {
    type: Number(option?.type || 0),
    name: option?.name ?? '',
    description: option?.description ?? '',
  };

  if (option?.name_localizations) normalized.name_localizations = option.name_localizations;
  if (option?.description_localizations) normalized.description_localizations = option.description_localizations;

  // Discord defaults these flags to false when omitted.
  if ([3, 4, 5, 6, 7, 8, 9, 10, 11].includes(normalized.type)) {
    normalized.required = Boolean(option?.required);
  }

  if (option?.autocomplete !== undefined || normalized.type === 3 || normalized.type === 4 || normalized.type === 10) {
    normalized.autocomplete = Boolean(option?.autocomplete);
  }

  if (Array.isArray(option?.choices) && option.choices.length) {
    normalized.choices = option.choices.map(normalizeChoice);
  }

  if (Array.isArray(option?.options) && option.options.length) {
    normalized.options = option.options.map(normalizeOption);
  }

  if (Array.isArray(option?.channel_types) && option.channel_types.length) {
    normalized.channel_types = [...option.channel_types].map(Number).sort((a, b) => a - b);
  }

  for (const key of ['min_value', 'max_value', 'min_length', 'max_length']) {
    if (option?.[key] !== undefined && option?.[key] !== null) {
      normalized[key] = option[key];
    }
  }

  return normalized;
}

function normalizeCommand(command) {
  const normalized = {
    type: Number(command?.type || 1),
    name: command?.name ?? '',
    description: command?.description ?? '',
    nsfw: Boolean(command?.nsfw),
    default_member_permissions:
      command?.default_member_permissions === undefined || command?.default_member_permissions === null
        ? null
        : String(command.default_member_permissions),
    options: Array.isArray(command?.options)
      ? command.options.map(normalizeOption)
      : [],
  };

  if (command?.name_localizations) normalized.name_localizations = command.name_localizations;
  if (command?.description_localizations) normalized.description_localizations = command.description_localizations;

  return normalized;
}

function commandSetsEqual(existingCommands, desiredCommands) {
  if (!Array.isArray(existingCommands) || !Array.isArray(desiredCommands)) return false;
  if (existingCommands.length !== desiredCommands.length) return false;

  const existingByKey = new Map(
    existingCommands.map((command) => [
      `${Number(command?.type || 1)}:${command?.name || ''}`,
      normalizeCommand(command),
    ])
  );

  return desiredCommands.every((desired) => {
    const key = `${Number(desired?.type || 1)}:${desired?.name || ''}`;
    const existing = existingByKey.get(key);
    if (!existing) return false;
    return JSON.stringify(existing) === JSON.stringify(normalizeCommand(desired));
  });
}

module.exports = {
  normalizeCommand,
  commandSetsEqual,
};
