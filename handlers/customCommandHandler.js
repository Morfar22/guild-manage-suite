// customCommandHandler.js
// Handles custom commands created via the dashboard

const { EmbedBuilder } = require('discord.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Cooldown tracking
const cooldowns = new Map();

async function fetchCustomCommands(guildInternalId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/custom_commands?guild_id=eq.${guildInternalId}&enabled=eq.true&select=*`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('[CustomCmd] Fetch error:', error);
    return [];
  }
}

async function incrementUsage(commandId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      // Use PATCH instead
    }).catch(() => {});

    // Simple increment via PATCH
    await fetch(`${SUPABASE_URL}/rest/v1/custom_commands?id=eq.${commandId}`, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ usage_count: undefined }), // handled below
    }).catch(() => {});
  } catch {
    // Non-critical
  }
}

function checkCooldown(commandId, userId, cooldownSeconds) {
  if (cooldownSeconds <= 0) return false;
  const key = `${commandId}:${userId}`;
  const now = Date.now();
  const lastUsed = cooldowns.get(key);
  if (lastUsed && (now - lastUsed) < cooldownSeconds * 1000) {
    return true; // On cooldown
  }
  cooldowns.set(key, now);
  // Cleanup
  if (cooldowns.size > 5000) {
    for (const [k, v] of cooldowns) {
      if (now - v > 300000) cooldowns.delete(k);
    }
  }
  return false;
}

function replacePlaceholders(text, message) {
  return text
    .replace(/\{user\}/g, `<@${message.author.id}>`)
    .replace(/\{username\}/g, message.author.username)
    .replace(/\{server\}/g, message.guild.name)
    .replace(/\{channel\}/g, `<#${message.channel.id}>`)
    .replace(/\{membercount\}/g, message.guild.memberCount.toString());
}

function setupCustomCommandHandler(client, supabase, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  // Cache commands per guild (refresh every 60s)
  const commandCache = new Map();
  const CACHE_TTL = 60000;

  async function getGuildCommands(guildDiscordId) {
    const cached = commandCache.get(guildDiscordId);
    if (cached && Date.now() - cached.time < CACHE_TTL) return cached.commands;

    // Find guild internal id
    const { data: guild } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guildDiscordId)
      .single();

    if (!guild) return [];

    const { data: commands } = await supabase
      .from('custom_commands')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('enabled', true);

    const cmds = commands || [];
    commandCache.set(guildDiscordId, { commands: cmds, time: Date.now() });
    return cmds;
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!shouldHandleGuild(message.guild.id)) return;

    try {
      const commands = await getGuildCommands(message.guild.id);
      if (!commands.length) return;

      const content = message.content;

      for (const cmd of commands) {
        let matched = false;

        switch (cmd.trigger_type) {
          case 'command':
            matched = content.toLowerCase() === cmd.trigger.toLowerCase() ||
                      content.toLowerCase().startsWith(cmd.trigger.toLowerCase() + ' ');
            break;
          case 'keyword':
            matched = content.toLowerCase().includes(cmd.trigger.toLowerCase());
            break;
          case 'startswith':
            matched = content.toLowerCase().startsWith(cmd.trigger.toLowerCase());
            break;
        }

        if (!matched) continue;

        // Check required role
        if (cmd.required_role_id) {
          const member = await message.guild.members.fetch(message.author.id).catch(() => null);
          if (!member || !member.roles.cache.has(cmd.required_role_id)) continue;
        }

        // Check allowed channels
        if (cmd.allowed_channels && cmd.allowed_channels.length > 0) {
          if (!cmd.allowed_channels.includes(message.channel.id)) continue;
        }

        // Check cooldown
        if (checkCooldown(cmd.id, message.author.id, cmd.cooldown_seconds)) {
          continue;
        }

        // Execute command
        if (cmd.response_type === 'text' && cmd.response_content) {
          const text = replacePlaceholders(cmd.response_content, message);
          await message.reply(text);
        } else if (cmd.response_type === 'embed' && cmd.response_embed) {
          const embedData = cmd.response_embed;
          const embed = new EmbedBuilder();
          if (embedData.title) embed.setTitle(replacePlaceholders(embedData.title, message));
          if (embedData.description) embed.setDescription(replacePlaceholders(embedData.description, message));
          if (embedData.color) embed.setColor(embedData.color);
          if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
          if (embedData.image) embed.setImage(embedData.image);
          if (embedData.footer) embed.setFooter({ text: replacePlaceholders(embedData.footer, message) });
          await message.reply({ embeds: [embed] });
        } else if (cmd.response_type === 'role_toggle' && cmd.role_id) {
          const member = await message.guild.members.fetch(message.author.id);
          if (member.roles.cache.has(cmd.role_id)) {
            await member.roles.remove(cmd.role_id);
            await message.reply(`Rolle fjernet!`);
          } else {
            await member.roles.add(cmd.role_id);
            await message.reply(`Rolle tilføjet!`);
          }
        } else if (cmd.response_type === 'random' && cmd.response_options) {
          const options = Array.isArray(cmd.response_options) ? cmd.response_options : [];
          if (options.length > 0) {
            const pick = options[Math.floor(Math.random() * options.length)];
            const text = replacePlaceholders(String(pick), message);
            await message.reply(text);
          }
        }

        // Increment usage
        await supabase
          .from('custom_commands')
          .update({ usage_count: (cmd.usage_count || 0) + 1 })
          .eq('id', cmd.id)
          .then(() => {})
          .catch(() => {});

        break; // Only execute first matching command
      }
    } catch (error) {
      console.error('[CustomCmd] Error:', error);
    }
  });

  console.log('[CustomCmd] Handler initialized');
}

module.exports = { setupCustomCommandHandler };
