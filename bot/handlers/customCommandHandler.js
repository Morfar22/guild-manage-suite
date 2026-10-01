'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  StringSelectMenuBuilder,
} = require('discord.js');

const cooldowns = new Map();

function setupCustomCommandHandler(client, supabase, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);
  const commandCache = new Map();
  const CACHE_TTL = 30_000;

  async function getGuildCommands(discordGuildId) {
    const cached = commandCache.get(discordGuildId);
    if (cached && Date.now() - cached.time < CACHE_TTL) return cached.commands;

    const { data: guild, error: guildError } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', discordGuildId)
      .maybeSingle();

    if (guildError || !guild) return [];

    const { data, error } = await supabase
      .from('custom_commands')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('enabled', true);

    if (error) {
      console.error('[CustomCmd] Fetch error:', error.message);
      return cached?.commands || [];
    }

    const commands = data || [];
    commandCache.set(discordGuildId, { commands, time: Date.now() });
    return commands;
  }

  function replacePlaceholders(text, context) {
    const raw = String(text || '');
    const userId = context.userId || context.authorId || '';
    const username = context.username || 'unknown';
    return raw
      .replace(/\{user\}/g, userId ? `<@${userId}>` : '')
      .replace(/\{username\}/g, username)
      .replace(/\{server\}/g, context.guildName || '')
      .replace(/\{channel\}/g, context.channelId ? `<#${context.channelId}>` : '')
      .replace(/\{membercount\}/g, String(context.memberCount ?? ''));
  }

  function checkCooldown(commandId, userId, cooldownSeconds) {
    const seconds = Math.max(0, Number(cooldownSeconds) || 0);
    if (!seconds) return 0;

    const key = `${commandId}:${userId}`;
    const now = Date.now();
    const expiresAt = cooldowns.get(key) || 0;

    if (expiresAt > now) {
      return Math.max(1, Math.ceil((expiresAt - now) / 1000));
    }

    cooldowns.set(key, now + seconds * 1000);

    if (cooldowns.size > 5000) {
      for (const [entryKey, entryExpiresAt] of cooldowns) {
        if (entryExpiresAt <= now) cooldowns.delete(entryKey);
      }
    }

    return 0;
  }

  function roleIdsFor(member) {
    return member?.roles?.cache ? [...member.roles.cache.keys()] : [];
  }

  function checkCommandAccess(cmd, member, channel) {
    const memberRoleIds = roleIdsFor(member);

    if (cmd.required_role_id && !memberRoleIds.includes(cmd.required_role_id)) {
      return { allowed: false, reason: 'required_role' };
    }

    const allowedRoles = Array.isArray(cmd.allowed_role_ids) ? cmd.allowed_role_ids : [];
    if (allowedRoles.length && !memberRoleIds.some((id) => allowedRoles.includes(id))) {
      return { allowed: false, reason: 'allowed_roles' };
    }

    const blockedRoles = Array.isArray(cmd.blocked_role_ids) ? cmd.blocked_role_ids : [];
    if (blockedRoles.some((id) => memberRoleIds.includes(id))) {
      return { allowed: false, reason: 'blocked_role' };
    }

    const allowedChannels = Array.isArray(cmd.allowed_channels) ? cmd.allowed_channels : [];
    if (allowedChannels.length && !allowedChannels.includes(channel.id)) {
      return { allowed: false, reason: 'allowed_channel' };
    }

    const blockedChannels = Array.isArray(cmd.blocked_channel_ids) ? cmd.blocked_channel_ids : [];
    if (blockedChannels.includes(channel.id)) {
      return { allowed: false, reason: 'blocked_channel' };
    }

    const conditions = cmd.conditions && typeof cmd.conditions === 'object'
      ? cmd.conditions
      : {};

    const minAccountAgeDays = Math.max(0, Number(conditions.min_account_age_days) || 0);
    if (minAccountAgeDays > 0 && member?.user?.createdTimestamp) {
      const ageDays = (Date.now() - member.user.createdTimestamp) / 86400000;
      if (ageDays < minAccountAgeDays) {
        return { allowed: false, reason: 'account_age' };
      }
    }

    const minMemberAgeDays = Math.max(0, Number(conditions.min_member_age_days) || 0);
    if (minMemberAgeDays > 0 && member?.joinedTimestamp) {
      const ageDays = (Date.now() - member.joinedTimestamp) / 86400000;
      if (ageDays < minMemberAgeDays) {
        return { allowed: false, reason: 'member_age' };
      }
    }

    if (conditions.require_nsfw === true && !channel.nsfw) {
      return { allowed: false, reason: 'nsfw_only' };
    }

    return { allowed: true };
  }

  function contextFromMessage(message) {
    return {
      userId: message.author.id,
      authorId: message.author.id,
      username: message.author.username,
      guildName: message.guild.name,
      channelId: message.channel.id,
      memberCount: message.guild.memberCount,
    };
  }

  function contextFromInteraction(interaction) {
    return {
      userId: interaction.user.id,
      authorId: interaction.user.id,
      username: interaction.user.username,
      guildName: interaction.guild?.name || '',
      channelId: interaction.channelId,
      memberCount: interaction.guild?.memberCount ?? '',
    };
  }

  function buttonStyle(style) {
    switch (style) {
      case 'secondary': return ButtonStyle.Secondary;
      case 'success': return ButtonStyle.Success;
      case 'danger': return ButtonStyle.Danger;
      case 'link': return ButtonStyle.Link;
      default: return ButtonStyle.Primary;
    }
  }

  function buildComponents(cmd) {
    const rows = [];
    const buttons = Array.isArray(cmd.response_buttons) ? cmd.response_buttons.slice(0, 5) : [];

    if (buttons.length) {
      const row = new ActionRowBuilder();
      for (let index = 0; index < buttons.length; index += 1) {
        const buttonConfig = buttons[index] || {};
        const builder = new ButtonBuilder()
          .setLabel(String(buttonConfig.label || `Button ${index + 1}`).slice(0, 80))
          .setStyle(buttonStyle(buttonConfig.style));

        if (buttonConfig.emoji) builder.setEmoji(String(buttonConfig.emoji));

        if (buttonConfig.style === 'link') {
          if (!buttonConfig.url) continue;
          builder.setURL(String(buttonConfig.url));
        } else {
          builder.setCustomId(`customcmd_btn:${cmd.id}:${index}`);
        }

        row.addComponents(builder);
      }
      if (row.components.length) rows.push(row);
    }

    const selects = Array.isArray(cmd.response_selects) ? cmd.response_selects : [];
    for (let index = 0; index < selects.length && rows.length < 5; index += 1) {
      const selectConfig = selects[index] || {};
      const options = Array.isArray(selectConfig.options) ? selectConfig.options.slice(0, 25) : [];
      if (!options.length) continue;

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`customcmd_select:${cmd.id}:${index}`)
        .setPlaceholder(String(selectConfig.placeholder || 'Vælg en mulighed').slice(0, 150))
        .setMinValues(Math.max(1, Math.min(options.length, Number(selectConfig.min_values) || 1)))
        .setMaxValues(Math.max(1, Math.min(options.length, Number(selectConfig.max_values) || 1)))
        .addOptions(
          options.map((option, optionIndex) => ({
            label: String(option.label || option.value || `Option ${optionIndex + 1}`).slice(0, 100),
            value: String(option.value || optionIndex).slice(0, 100),
            description: option.description ? String(option.description).slice(0, 100) : undefined,
            emoji: option.emoji ? String(option.emoji) : undefined,
          }))
        );

      rows.push(new ActionRowBuilder().addComponents(menu));
    }

    return rows;
  }

  function buildEmbed(cmd, context) {
    if (!cmd.response_embed || typeof cmd.response_embed !== 'object') return null;
    const embedData = cmd.response_embed;
    const embed = new EmbedBuilder();

    if (embedData.title) embed.setTitle(replacePlaceholders(embedData.title, context).slice(0, 256));
    if (embedData.description) embed.setDescription(replacePlaceholders(embedData.description, context).slice(0, 4096));
    if (embedData.color) embed.setColor(embedData.color);
    if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
    if (embedData.image) embed.setImage(embedData.image);
    if (embedData.footer) embed.setFooter({ text: replacePlaceholders(embedData.footer, context).slice(0, 2048) });

    return embed;
  }

  async function incrementUsage(cmd) {
    const next = Number(cmd.usage_count || 0) + 1;
    cmd.usage_count = next;
    await supabase
      .from('custom_commands')
      .update({ usage_count: next })
      .eq('id', cmd.id)
      .then(() => {})
      .catch(() => {});
  }

  async function executeCommand(cmd, message) {
    const context = contextFromMessage(message);
    const components = buildComponents(cmd);

    if (cmd.response_type === 'role_toggle' && cmd.role_id) {
      const member = message.member || await message.guild.members.fetch(message.author.id);
      if (member.roles.cache.has(cmd.role_id)) {
        await member.roles.remove(cmd.role_id);
        await message.reply({ content: 'Rolle fjernet!', components });
      } else {
        await member.roles.add(cmd.role_id);
        await message.reply({ content: 'Rolle tilføjet!', components });
      }
      return;
    }

    if (cmd.response_type === 'random') {
      const options = Array.isArray(cmd.response_options) ? cmd.response_options : [];
      if (!options.length) return;
      const pick = options[Math.floor(Math.random() * options.length)];
      await message.reply({ content: replacePlaceholders(String(pick), context), components });
      return;
    }

    if (cmd.response_type === 'embed') {
      const embed = buildEmbed(cmd, context);
      const payload = {
        embeds: embed ? [embed] : [],
        components,
      };
      if (cmd.response_content) payload.content = replacePlaceholders(cmd.response_content, context);
      await message.reply(payload);
      return;
    }

    if (cmd.response_content || components.length) {
      await message.reply({
        content: cmd.response_content
          ? replacePlaceholders(cmd.response_content, context)
          : undefined,
        components,
      });
    }
  }

  async function getCommandById(discordGuildId, commandId) {
    const commands = await getGuildCommands(discordGuildId);
    return commands.find((cmd) => cmd.id === commandId) || null;
  }

  async function applyComponentRoleAction(config, interaction) {
    const roleId = config.role_id;
    const action = config.role_action;
    if (!roleId || !action || !interaction.member) return false;

    if (action === 'add') {
      await interaction.member.roles.add(roleId, 'Custom command button');
      return true;
    }
    if (action === 'remove') {
      await interaction.member.roles.remove(roleId, 'Custom command button');
      return true;
    }
    if (action === 'toggle') {
      if (interaction.member.roles.cache.has(roleId)) {
        await interaction.member.roles.remove(roleId, 'Custom command button');
      } else {
        await interaction.member.roles.add(roleId, 'Custom command button');
      }
      return true;
    }

    return false;
  }

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild || !shouldHandleGuild(message.guild.id)) return;

    try {
      const commands = await getGuildCommands(message.guild.id);
      if (!commands.length) return;
      const content = message.content || '';

      for (const cmd of commands) {
        let matched = false;

        if (cmd.trigger_type === 'command') {
          matched =
            content.toLowerCase() === String(cmd.trigger).toLowerCase() ||
            content.toLowerCase().startsWith(String(cmd.trigger).toLowerCase() + ' ');
        } else if (cmd.trigger_type === 'keyword') {
          matched = content.toLowerCase().includes(String(cmd.trigger).toLowerCase());
        } else if (cmd.trigger_type === 'startswith') {
          matched = content.toLowerCase().startsWith(String(cmd.trigger).toLowerCase());
        }

        if (!matched) continue;

        const access = checkCommandAccess(cmd, message.member, message.channel);
        if (!access.allowed) continue;

        const retryAfter = checkCooldown(cmd.id, message.author.id, cmd.cooldown_seconds);
        if (retryAfter > 0) continue;

        await executeCommand(cmd, message);
        await incrementUsage(cmd);
        break;
      }
    } catch (error) {
      console.error('[CustomCmd] Error:', error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const isButton = interaction.customId?.startsWith('customcmd_btn:');
    const isSelect = interaction.customId?.startsWith('customcmd_select:');
    if (!isButton && !isSelect) return;

    try {
      const [, commandId, rawIndex] = interaction.customId.split(':');
      const index = Number(rawIndex);
      const cmd = await getCommandById(interaction.guild.id, commandId);
      if (!cmd) {
        return interaction.reply({ content: 'Denne custom command findes ikke længere.', flags: 64 });
      }

      const access = checkCommandAccess(cmd, interaction.member, interaction.channel);
      if (!access.allowed) {
        return interaction.reply({ content: 'Du har ikke adgang til denne handling.', flags: 64 });
      }

      const context = contextFromInteraction(interaction);

      if (isButton) {
        const config = Array.isArray(cmd.response_buttons) ? cmd.response_buttons[index] : null;
        if (!config) return interaction.reply({ content: 'Button-konfiguration mangler.', flags: 64 });

        const roleChanged = await applyComponentRoleAction(config, interaction);
        const response = config.response
          ? replacePlaceholders(config.response, context)
          : roleChanged
            ? '✅ Rolle opdateret.'
            : '✅ Handling udført.';

        return interaction.reply({ content: response, flags: config.ephemeral === false ? 0 : 64 });
      }

      const selectConfig = Array.isArray(cmd.response_selects) ? cmd.response_selects[index] : null;
      if (!selectConfig) return interaction.reply({ content: 'Select-konfiguration mangler.', flags: 64 });

      const selected = interaction.values?.[0];
      const option = Array.isArray(selectConfig.options)
        ? selectConfig.options.find((item) => String(item.value) === String(selected))
        : null;

      if (option) await applyComponentRoleAction(option, interaction);
      const response = option?.response
        ? replacePlaceholders(option.response, context)
        : `Valgt: **${option?.label || selected}**`;

      return interaction.reply({ content: response, flags: option?.ephemeral === false ? 0 : 64 });
    } catch (error) {
      console.error('[CustomCmd] Component error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Custom command handling fejlede.', flags: 64 }).catch(() => {});
      }
    }
  });

  console.log('[CustomCmd] Handler initialized');
}

module.exports = { setupCustomCommandHandler };
