/**
 * GuildOS Bot - Welcome / leave / autorole runtime handler.
 *
 * This handler runs directly inside the Discord client that owns the guild.
 * It reads settings from Supabase and performs Discord actions through discord.js,
 * so member joins do not depend on the public web API or Cloudflare availability.
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000;

function isDuplicateEvent(key) {
  const now = Date.now();
  const previous = recentEvents.get(key);

  if (previous && now - previous < DEDUP_WINDOW_MS) {
    console.log(`[Welcome] Duplicate event skipped: ${key}`);
    return true;
  }

  recentEvents.set(key, now);

  if (recentEvents.size > 250) {
    for (const [eventKey, timestamp] of recentEvents) {
      if (now - timestamp > DEDUP_WINDOW_MS * 2) recentEvents.delete(eventKey);
    }
  }

  return false;
}

function formatMessage(template, context) {
  return String(template || '')
    .replace(/{user}/g, context.userMention || context.username || 'Ukendt')
    .replace(/{username}/g, context.username || 'Ukendt')
    .replace(/{server}/g, context.serverName || 'Server')
    .replace(/{membercount}/g, String(context.memberCount ?? '?'))
    .replace(/{inviter}/g, context.inviterMention || context.inviterName || 'Ukendt')
    .replace(/{invitercount}/g, String(context.inviterCount ?? 0));
}

function safeHexColor(value, fallback = 0x5865F2) {
  const normalized = String(value || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return parseInt(normalized, 16);
}

async function getGuildSettings(discordGuildId) {
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY mangler');

  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id, guild_id, guild_name')
    .eq('guild_id', discordGuildId)
    .maybeSingle();

  if (guildError) throw guildError;
  if (!guild) return { guild: null, settings: null };

  const { data: settings, error: settingsError } = await supabase
    .from('welcome_settings')
    .select('*')
    .eq('guild_id', guild.id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  return { guild, settings };
}

async function getInviterInfo(internalGuildId, joinedUserId) {
  if (!supabase || !internalGuildId || !joinedUserId) return null;

  try {
    let latestUse = null;

    // InviteTracker and Welcome receive the same guildMemberAdd event.
    // Give the tracker a short window to persist attribution before we build
    // the welcome embed.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase
        .from('invite_uses')
        .select('inviter_discord_id, inviter_username')
        .eq('guild_id', internalGuildId)
        .eq('joined_user_id', joinedUserId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      latestUse = data;

      if (latestUse) break;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }

    if (!latestUse) return null;

    if (!latestUse.inviter_discord_id) {
      return {
        discordId: null,
        username: latestUse.inviter_username || 'Ukendt',
        total: 0,
      };
    }

    const { count, error: countError } = await supabase
      .from('invite_uses')
      .select('id', { count: 'exact', head: true })
      .eq('guild_id', internalGuildId)
      .eq('inviter_discord_id', latestUse.inviter_discord_id)
      .eq('has_left', false)
      .eq('is_fake', false);

    if (countError) throw countError;

    return {
      discordId: latestUse.inviter_discord_id,
      username: latestUse.inviter_username || null,
      total: count || 0,
    };
  } catch (error) {
    console.warn('[Welcome] Inviter lookup failed:', error?.message || error);
    return null;
  }
}

function createWelcomeEmbed(settings, context, avatarUrl, serverIconUrl) {
  const embed = new EmbedBuilder()
    .setColor(safeHexColor(settings.embed_color))
    .setTitle(formatMessage(settings.embed_title || '🎉 Et nyt medlem er ankommet!', context))
    .setDescription(formatMessage(settings.welcome_message || 'Velkommen, {user}! 🎉', context))
    .setTimestamp();

  if (avatarUrl) {
    embed.setAuthor({ name: `Velkommen, ${context.username}!`, iconURL: avatarUrl });
  } else {
    embed.setAuthor({ name: `Velkommen, ${context.username}!` });
  }

  if (settings.thumbnail_type === 'server_icon' && serverIconUrl) {
    embed.setThumbnail(serverIconUrl);
  } else if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.addFields(
    { name: '👤 Bruger', value: context.userMention, inline: true },
    { name: '📊 Medlem #', value: String(context.memberCount ?? '?'), inline: true },
    { name: '📅 Joined', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
  );

  if (context.inviterMention || context.inviterName) {
    embed.addFields({
      name: '🎟️ Inviteret af',
      value: `${context.inviterMention || context.inviterName}\n*(${context.inviterCount || 0} invites total)*`,
      inline: false,
    });
  }

  const footer = settings.embed_footer
    ? formatMessage(settings.embed_footer, context)
    : `${context.serverName} • Vi er glade for at have dig her!`;

  if (footer) embed.setFooter({ text: footer });

  if (settings.embed_image_url) {
    try {
      new URL(settings.embed_image_url);
      embed.setImage(settings.embed_image_url);
    } catch {
      console.warn(`[Welcome] Ignorerer ugyldig embed_image_url i ${context.serverName}`);
    }
  }

  return embed;
}

function createLeaveEmbed(settings, context) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('👋 Et medlem har forladt os')
    .setDescription(formatMessage(settings.leave_message || '{user} har forladt serveren.', context))
    .setFooter({ text: context.serverName })
    .setTimestamp();
}

async function getSendableChannel(guild, channelId, needsEmbed = false) {
  if (!channelId) return { channel: null, reason: 'ingen kanal valgt' };

  const channel = guild.channels.cache.get(channelId)
    || await guild.channels.fetch(channelId).catch(() => null);

  if (!channel) return { channel: null, reason: 'kanalen findes ikke længere' };
  if (typeof channel.send !== 'function') {
    return { channel: null, reason: 'den valgte kanal understøtter ikke almindelige beskeder' };
  }

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me) return { channel: null, reason: 'kunne ikke hente bot-medlemmet' };

  const permissions = channel.permissionsFor(me);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    return { channel: null, reason: 'mangler View Channel' };
  }
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    return { channel: null, reason: 'mangler Send Messages' };
  }
  if (needsEmbed && !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
    return { channel: null, reason: 'mangler Embed Links' };
  }

  return { channel, reason: null };
}

async function sendWelcomeMessage(member, settings, context, avatarUrl, serverIconUrl) {
  if (!settings.enabled) return { skipped: true, reason: 'welcome_disabled' };
  if (!settings.welcome_channel_id) return { ok: false, reason: 'ingen velkomstkanal valgt' };

  const { channel, reason } = await getSendableChannel(
    member.guild,
    settings.welcome_channel_id,
    Boolean(settings.embed_enabled),
  );

  if (!channel) return { ok: false, reason };

  const payload = settings.embed_enabled
    ? { embeds: [createWelcomeEmbed(settings, context, avatarUrl, serverIconUrl)] }
    : { content: formatMessage(settings.welcome_message || 'Velkommen, {user}! 🎉', context) };

  await channel.send(payload);
  return { ok: true };
}

async function sendWelcomeDM(member, settings, context) {
  if (!settings.dm_enabled || !settings.dm_message) {
    return { skipped: true, reason: 'dm_disabled' };
  }

  try {
    await member.send(formatMessage(settings.dm_message, context));
    return { ok: true };
  } catch (error) {
    // Closed DMs are normal and should not make the entire welcome flow fail.
    return {
      ok: false,
      soft: true,
      reason: `DM kunne ikke sendes: ${error?.message || error}`,
    };
  }
}

async function assignAutoRoles(member, settings) {
  if (!settings.auto_role_enabled) return { skipped: true, reason: 'autorole_disabled' };

  const configured = Array.isArray(settings.auto_role_ids) && settings.auto_role_ids.length
    ? settings.auto_role_ids
    : (settings.auto_role_id ? [settings.auto_role_id] : []);

  const roleIds = [...new Set(configured.filter(Boolean).map(String))];

  if (!roleIds.length) {
    return { ok: false, errors: ['Auto-rolle er slået til, men ingen roller er valgt'] };
  }

  const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
  if (!me) return { ok: false, errors: ['Kunne ikke hente bot-medlemmet'] };

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, errors: ['Botten mangler Manage Roles'] };
  }

  const errors = [];
  const assigned = [];

  for (const roleId of roleIds) {
    const role = member.guild.roles.cache.get(roleId)
      || await member.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      errors.push(`Rolle ${roleId} findes ikke længere`);
      continue;
    }

    if (role.id === member.guild.id) {
      errors.push('@everyone kan ikke tildeles som auto-rolle');
      continue;
    }

    if (role.managed) {
      errors.push(`${role.name}: managed/integration-rolle kan ikke tildeles manuelt`);
      continue;
    }

    if (me.roles.highest.comparePositionTo(role) <= 0) {
      errors.push(`${role.name}: bot-rollen skal ligge højere i rollehierarkiet`);
      continue;
    }

    try {
      await member.roles.add(role, 'GuildOS Bot auto-role on member join');
      assigned.push(role.name);
    } catch (error) {
      errors.push(`${role.name}: ${error?.message || error}`);
    }
  }

  return {
    ok: errors.length === 0,
    partial: assigned.length > 0 && errors.length > 0,
    assigned,
    errors,
  };
}

function setupWelcomeHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  const onMemberAdd = async (member) => {
    if (!shouldHandleGuild(member.guild.id)) return;

    const dedupKey = `join:${member.guild.id}:${member.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      const { guild: guildRow, settings } = await getGuildSettings(member.guild.id);

      if (!guildRow || !settings) {
        console.log(`[Welcome] Ingen settings for ${member.guild.name}; springer over`);
        return;
      }

      const inviter = await getInviterInfo(guildRow.id, member.id);
      const context = {
        userMention: `<@${member.id}>`,
        username: member.user.username,
        serverName: guildRow.guild_name || member.guild.name,
        memberCount: member.guild.memberCount,
        inviterMention: inviter?.discordId ? `<@${inviter.discordId}>` : null,
        inviterName: inviter?.username || null,
        inviterCount: inviter?.total || 0,
      };

      const avatarUrl = member.user.displayAvatarURL({ size: 256, extension: 'png' });
      const serverIconUrl = member.guild.iconURL({ size: 256, extension: 'png' }) || null;

      const [welcomeResult, dmResult, roleResult] = await Promise.all([
        sendWelcomeMessage(member, settings, context, avatarUrl, serverIconUrl)
          .catch((error) => ({ ok: false, reason: error?.message || String(error) })),
        sendWelcomeDM(member, settings, context),
        assignAutoRoles(member, settings)
          .catch((error) => ({ ok: false, errors: [error?.message || String(error)] })),
      ]);

      const errors = [];

      if (welcomeResult?.ok === false) {
        errors.push(`Welcome: ${welcomeResult.reason || 'ukendt fejl'}`);
      }
      if (dmResult?.ok === false && !dmResult.soft) {
        errors.push(`DM: ${dmResult.reason || 'ukendt fejl'}`);
      }
      if (dmResult?.ok === false && dmResult.soft) {
        console.log(`[Welcome] ${member.user.tag}: ${dmResult.reason}`);
      }
      if (roleResult?.ok === false) {
        errors.push(...(roleResult.errors || []).map((item) => `AutoRole: ${item}`));
      }

      if (roleResult?.assigned?.length) {
        console.log(
          `[Welcome] ✅ AutoRole ${member.user.tag}: ${roleResult.assigned.join(', ')}`,
        );
      }

      if (errors.length) {
        console.warn(
          `[Welcome] ⚠️ Join-flow for ${member.user.tag} i ${member.guild.name}: ${errors.join(' | ')}`,
        );
      } else {
        console.log(`[Welcome] ✅ Join-flow completed for ${member.user.tag} in ${member.guild.name}`);
      }
    } catch (error) {
      console.error(
        `[Welcome] ❌ Join-flow failed for ${member.user?.tag || member.id} in ${member.guild?.name || member.guild?.id}:`,
        error?.message || error,
      );
    }
  };

  const onMemberRemove = async (member) => {
    if (!shouldHandleGuild(member.guild.id)) return;

    const dedupKey = `leave:${member.guild.id}:${member.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      const { guild: guildRow, settings } = await getGuildSettings(member.guild.id);
      if (!guildRow || !settings?.leave_enabled) return;

      const channelId = settings.leave_channel_id || settings.welcome_channel_id;
      if (!channelId) {
        console.warn(`[Welcome] Leave enabled in ${member.guild.name}, but no channel is configured`);
        return;
      }

      const context = {
        userMention: member.user?.username || member.id,
        username: member.user?.username || member.id,
        serverName: guildRow.guild_name || member.guild.name,
        memberCount: member.guild.memberCount,
      };

      const { channel, reason } = await getSendableChannel(
        member.guild,
        channelId,
        Boolean(settings.leave_embed_enabled),
      );

      if (!channel) {
        console.warn(`[Welcome] Leave message not sent in ${member.guild.name}: ${reason}`);
        return;
      }

      const payload = settings.leave_embed_enabled
        ? { embeds: [createLeaveEmbed(settings, context)] }
        : { content: formatMessage(settings.leave_message || '{user} har forladt serveren.', context) };

      await channel.send(payload);
      console.log(`[Welcome] ✅ Leave message sent for ${context.username} in ${member.guild.name}`);
    } catch (error) {
      console.error(
        `[Welcome] ❌ Leave-flow failed in ${member.guild?.name || member.guild?.id}:`,
        error?.message || error,
      );
    }
  };

  client.on('guildMemberAdd', onMemberAdd);
  client.on('guildMemberRemove', onMemberRemove);

  console.log('✅ Welcome handler initialized (direct runtime mode)');

  return {
    destroy() {
      client.removeListener('guildMemberAdd', onMemberAdd);
      client.removeListener('guildMemberRemove', onMemberRemove);
    },
  };
}

module.exports = { setupWelcomeHandler };
