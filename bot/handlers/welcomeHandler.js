/**
 * GuildOS Bot Welcome Handler
 *
 * Runtime join/leave handling is performed directly by the active Discord client.
 * This avoids routing real member events through the public web API / CDN.
 *
 * Requires:
 * - GatewayIntentBits.Guilds
 * - GatewayIntentBits.GuildMembers
 * - Supabase client with access to guilds, welcome_settings and invite_uses
 */

const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const recentEvents = new Map();
const DEDUP_WINDOW_MS = 5000;

function isDuplicateEvent(key) {
  const now = Date.now();
  const lastTime = recentEvents.get(key);

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
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

function validHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseColor(value, fallback = 0x5865F2) {
  const normalized = String(value || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return parseInt(normalized, 16);
}

function formatWelcomeText(template, context) {
  return String(template || '')
    .replace(/{user}/g, `<@${context.userId}>`)
    .replace(/{username}/g, context.username)
    .replace(/{server}/g, context.guildName)
    .replace(/{membercount}/g, String(context.memberCount ?? '?'))
    .replace(
      /{inviter}/g,
      context.inviter?.discord_id
        ? `<@${context.inviter.discord_id}>`
        : (context.inviter?.username || 'Ukendt'),
    )
    .replace(/{invitercount}/g, String(context.inviter?.total ?? 0));
}

function formatLeaveText(template, context) {
  return String(template || '')
    .replace(/{user}/g, context.username)
    .replace(/{username}/g, context.username)
    .replace(/{server}/g, context.guildName)
    .replace(/{membercount}/g, String(context.memberCount ?? '?'));
}

async function getGuildContext(supabase, discordGuildId) {
  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id, guild_id, guild_name')
    .eq('guild_id', discordGuildId)
    .maybeSingle();

  if (guildError) throw guildError;
  if (!guild) return null;

  const { data: settings, error: settingsError } = await supabase
    .from('welcome_settings')
    .select('*')
    .eq('guild_id', guild.id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  return { guild, settings };
}

async function getInviterInfo(supabase, internalGuildId, joinedUserId) {
  // Invite tracker runs on the same member event. A small delay lets it persist
  // the resolved invite before the welcome embed asks for it.
  await new Promise((resolve) => setTimeout(resolve, 450));

  try {
    const { data: latestUse } = await supabase
      .from('invite_uses')
      .select('inviter_discord_id, inviter_username')
      .eq('guild_id', internalGuildId)
      .eq('joined_user_id', joinedUserId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestUse) return null;

    if (!latestUse.inviter_discord_id) {
      return {
        discord_id: null,
        username: latestUse.inviter_username || 'Ukendt',
        total: 0,
      };
    }

    const { count } = await supabase
      .from('invite_uses')
      .select('id', { count: 'exact', head: true })
      .eq('guild_id', internalGuildId)
      .eq('inviter_discord_id', latestUse.inviter_discord_id)
      .eq('has_left', false)
      .eq('is_fake', false);

    return {
      discord_id: latestUse.inviter_discord_id,
      username: latestUse.inviter_username,
      total: count ?? 0,
    };
  } catch (error) {
    console.warn('[Welcome] Inviter lookup failed:', error?.message || error);
    return null;
  }
}

function buildWelcomeEmbed(settings, context, avatarUrl, serverIconUrl) {
  const title = formatWelcomeText(
    settings.embed_title || '🎉 Et nyt medlem er ankommet!',
    context,
  );
  const description = formatWelcomeText(
    settings.welcome_message || 'Velkommen til serveren, {user}! 🎉',
    context,
  );
  const footer = settings.embed_footer
    ? formatWelcomeText(settings.embed_footer, context)
    : `${context.guildName} • Vi er glade for at have dig her!`;

  const embed = new EmbedBuilder()
    .setColor(parseColor(settings.embed_color))
    .setAuthor({
      name: `Velkommen, ${context.username}!`,
      ...(avatarUrl ? { iconURL: avatarUrl } : {}),
    })
    .setTitle(title.slice(0, 256))
    .setDescription(description.slice(0, 4096))
    .addFields(
      { name: '👤 Bruger', value: `<@${context.userId}>`, inline: true },
      { name: '📊 Medlem #', value: String(context.memberCount ?? '?'), inline: true },
      { name: '📅 Joined', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: footer.slice(0, 2048) })
    .setTimestamp();

  const thumbnail =
    settings.thumbnail_type === 'server_icon'
      ? serverIconUrl
      : avatarUrl;

  if (thumbnail) embed.setThumbnail(thumbnail);

  if (context.inviter) {
    const inviterDisplay = context.inviter.discord_id
      ? `<@${context.inviter.discord_id}>`
      : (context.inviter.username || 'Ukendt');

    embed.addFields({
      name: '🎟️ Inviteret af',
      value: `${inviterDisplay}\n*(${context.inviter.total} ${context.inviter.total === 1 ? 'invite' : 'invites'} total)*`,
      inline: false,
    });
  }

  const imageUrl = validHttpUrl(settings.embed_image_url);
  if (imageUrl) embed.setImage(imageUrl);

  return embed;
}

function buildLeaveEmbed(settings, context) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('👋 Et medlem har forladt os')
    .setDescription(
      formatLeaveText(
        settings.leave_message || '{user} har forladt serveren.',
        context,
      ).slice(0, 4096),
    )
    .setFooter({ text: context.guildName.slice(0, 2048) })
    .setTimestamp();
}

async function resolveMessageChannel(guild, channelId) {
  if (!channelId) return null;
  const channel =
    guild.channels.cache.get(channelId) ||
    await guild.channels.fetch(channelId).catch(() => null);

  if (!channel || typeof channel.send !== 'function') return null;
  return channel;
}

async function sendPublicWelcome(member, settings, context) {
  if (!settings.enabled) return { attempted: false, sent: false };

  if (!settings.welcome_channel_id) {
    return {
      attempted: true,
      sent: false,
      error: 'Velkomst er aktiveret, men ingen velkomstkanal er valgt',
    };
  }

  const channel = await resolveMessageChannel(member.guild, settings.welcome_channel_id);
  if (!channel) {
    return {
      attempted: true,
      sent: false,
      error: 'Velkomstkanalen findes ikke eller understøtter ikke beskeder',
    };
  }

  const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
  const permissions = me ? channel.permissionsFor(me) : null;

  if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions?.has(PermissionFlagsBits.SendMessages)) {
    return {
      attempted: true,
      sent: false,
      error: `Mangler View Channel/Send Messages i #${channel.name || settings.welcome_channel_id}`,
    };
  }

  if (settings.embed_enabled && !permissions.has(PermissionFlagsBits.EmbedLinks)) {
    return {
      attempted: true,
      sent: false,
      error: `Mangler Embed Links i #${channel.name || settings.welcome_channel_id}`,
    };
  }

  const contextPayload = settings.embed_enabled
    ? {
        embeds: [
          buildWelcomeEmbed(
            settings,
            context,
            member.user.displayAvatarURL({ size: 256 }),
            member.guild.iconURL({ size: 256, extension: 'png' }) || null,
          ),
        ],
      }
    : {
        content: formatWelcomeText(
          settings.welcome_message || 'Velkommen til serveren, {user}! 🎉',
          context,
        ).slice(0, 2000),
      };

  await channel.send(contextPayload);
  return { attempted: true, sent: true };
}

async function sendWelcomeDm(member, settings, context) {
  if (!settings.dm_enabled || !settings.dm_message) {
    return { attempted: false, sent: false };
  }

  try {
    await member.send({
      content: formatWelcomeText(settings.dm_message, context).slice(0, 2000),
    });
    return { attempted: true, sent: true };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: `DM kunne ikke sendes: ${error?.message || error}`,
    };
  }
}

async function assignAutoRoles(member, settings) {
  if (!settings.auto_role_enabled) {
    return { attempted: false, assigned: [], failed: [] };
  }

  const configured = Array.isArray(settings.auto_role_ids) && settings.auto_role_ids.length > 0
    ? settings.auto_role_ids
    : (settings.auto_role_id ? [settings.auto_role_id] : []);

  const roleIds = [...new Set(configured.map(String).filter(Boolean))];
  const assigned = [];
  const failed = [];

  if (roleIds.length === 0) {
    return {
      attempted: true,
      assigned,
      failed: [{ roleId: null, error: 'Auto-rolle er aktiveret, men ingen roller er valgt' }],
    };
  }

  const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    return {
      attempted: true,
      assigned,
      failed: roleIds.map((roleId) => ({
        roleId,
        error: 'Botten mangler Manage Roles',
      })),
    };
  }

  for (const roleId of roleIds) {
    try {
      const role =
        member.guild.roles.cache.get(roleId) ||
        await member.guild.roles.fetch(roleId).catch(() => null);

      if (!role) {
        failed.push({ roleId, error: 'Rollen findes ikke længere' });
        continue;
      }

      if (role.managed) {
        failed.push({ roleId, error: 'Discord-administrerede roller kan ikke tildeles manuelt' });
        continue;
      }

      if (role.comparePositionTo(me.roles.highest) >= 0) {
        failed.push({
          roleId,
          error: `Rollen "${role.name}" ligger over eller på niveau med bottens højeste rolle`,
        });
        continue;
      }

      if (member.roles.cache.has(roleId)) {
        assigned.push(roleId);
        continue;
      }

      await member.roles.add(role, 'GuildOS Bot auto-role on member join');
      assigned.push(roleId);
      console.log(`[AutoRole] ✅ ${role.name} -> ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
      failed.push({
        roleId,
        error: error?.message || String(error),
      });
    }
  }

  return { attempted: true, assigned, failed };
}

async function sendLeaveMessage(member, settings, context) {
  if (!settings?.leave_enabled) return { attempted: false, sent: false };

  const channelId = settings.leave_channel_id || settings.welcome_channel_id;
  if (!channelId) {
    return {
      attempted: true,
      sent: false,
      error: 'Farvelbesked er aktiveret, men ingen kanal er valgt',
    };
  }

  const channel = await resolveMessageChannel(member.guild, channelId);
  if (!channel) {
    return {
      attempted: true,
      sent: false,
      error: 'Farvelkanalen findes ikke eller understøtter ikke beskeder',
    };
  }

  const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
  const permissions = me ? channel.permissionsFor(me) : null;
  if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions?.has(PermissionFlagsBits.SendMessages)) {
    return {
      attempted: true,
      sent: false,
      error: `Mangler View Channel/Send Messages i #${channel.name || channelId}`,
    };
  }

  if (settings.leave_embed_enabled && !permissions.has(PermissionFlagsBits.EmbedLinks)) {
    return {
      attempted: true,
      sent: false,
      error: `Mangler Embed Links i #${channel.name || channelId}`,
    };
  }

  const payload = settings.leave_embed_enabled
    ? { embeds: [buildLeaveEmbed(settings, context)] }
    : {
        content: formatLeaveText(
          settings.leave_message || '{user} har forladt serveren.',
          context,
        ).slice(0, 2000),
      };

  await channel.send(payload);
  return { attempted: true, sent: true };
}

function setupWelcomeHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);
  const supabase = config.supabase;

  if (!supabase) {
    throw new Error('Welcome handler kræver Supabase client');
  }

  const onMemberAdd = async (member) => {
    if (!shouldHandleGuild(member.guild.id)) return;

    const dedupKey = `join:${member.guild.id}:${member.user.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      console.log(`[Welcome] 👋 ${member.user.tag} joined ${member.guild.name}`);

      const db = await getGuildContext(supabase, member.guild.id);
      if (!db?.settings) {
        console.log(`[Welcome] Ingen settings for ${member.guild.name}; springer over`);
        return;
      }

      const settings = db.settings;
      if (!settings.enabled && !settings.dm_enabled && !settings.auto_role_enabled) {
        return;
      }

      const inviter = await getInviterInfo(supabase, db.guild.id, member.user.id);
      const context = {
        userId: member.user.id,
        username: member.user.username,
        guildName: db.guild.guild_name || member.guild.name,
        memberCount: member.guild.memberCount,
        inviter,
      };

      const [welcomeResult, dmResult, roleResult] = await Promise.all([
        sendPublicWelcome(member, settings, context).catch((error) => ({
          attempted: true,
          sent: false,
          error: error?.message || String(error),
        })),
        sendWelcomeDm(member, settings, context),
        assignAutoRoles(member, settings),
      ]);

      const problems = [];
      if (welcomeResult.error) problems.push(welcomeResult.error);
      if (dmResult.error) problems.push(dmResult.error);
      for (const failure of roleResult.failed || []) {
        problems.push(
          failure.roleId
            ? `AutoRole ${failure.roleId}: ${failure.error}`
            : failure.error,
        );
      }

      if (problems.length) {
        console.warn(
          `[Welcome] ⚠️ ${member.user.tag} partial result in ${member.guild.name}: ${problems.join(' | ')}`,
        );
      } else {
        console.log(
          `[Welcome] ✅ ${member.user.tag}: welcome=${welcomeResult.sent}, dm=${dmResult.sent}, roles=${roleResult.assigned.length}`,
        );
      }
    } catch (error) {
      console.error('[Welcome] Join flow error:', error?.stack || error);
    }
  };

  const onMemberRemove = async (member) => {
    if (!shouldHandleGuild(member.guild.id)) return;

    const dedupKey = `leave:${member.guild.id}:${member.user.id}`;
    if (isDuplicateEvent(dedupKey)) return;

    try {
      console.log(`[Welcome] 👋 ${member.user.tag} left ${member.guild.name}`);

      const db = await getGuildContext(supabase, member.guild.id);
      if (!db?.settings?.leave_enabled) return;

      const context = {
        userId: member.user.id,
        username: member.user.username,
        guildName: db.guild.guild_name || member.guild.name,
        memberCount: member.guild.memberCount,
      };

      const result = await sendLeaveMessage(member, db.settings, context);
      if (result.sent) {
        console.log(`[Welcome] ✅ Leave message sent for ${member.user.tag}`);
      } else if (result.error) {
        console.warn(`[Welcome] ⚠️ Leave message failed for ${member.user.tag}: ${result.error}`);
      }
    } catch (error) {
      console.error('[Welcome] Leave flow error:', error?.stack || error);
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
