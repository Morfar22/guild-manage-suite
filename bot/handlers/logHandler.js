/**
 * Log Handler for Discord Bot
 * 
 * This handler listens for various Discord events and sends them to the 
 * bot-log-events edge function for logging to the configured log channel.
 * 
 * Now includes: timeout/untimeout, server updates, pin/unpin, 
 * and audit log lookups for who deleted messages and who changed roles.
 */

const { Events, AuditLogEvent } = require('discord.js');

// Deduplication cache to prevent duplicate log events
const recentEvents = new Map();
const DEDUPE_WINDOW_MS = 5000;
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

function getEventKey(guildId, eventType, data) {
  const keyParts = [guildId, eventType];
  if (data.user_id) keyParts.push(data.user_id);
  if (data.channel_id) keyParts.push(data.channel_id);
  if (data.voice_channel_from) keyParts.push('from');
  if (data.voice_channel_to) keyParts.push('to');
  if (data.role_id) keyParts.push(data.role_id);
  if (data.message_id) keyParts.push(data.message_id);
  if (data.content && !data.message_id) keyParts.push(data.content.substring(0, 50));
  if (data.old_content) keyParts.push(data.old_content.substring(0, 30));
  if (data.new_content) keyParts.push(data.new_content.substring(0, 30));
  if (data.invite_code) keyParts.push(data.invite_code);
  if (data.old_nickname) keyParts.push(data.old_nickname);
  if (data.new_nickname) keyParts.push(data.new_nickname);
  if (data.emoji_name) keyParts.push(data.emoji_name);
  if (data.thread_name) keyParts.push(data.thread_name);
  if (data.target_id) keyParts.push(data.target_id);
  if (data.command_name) keyParts.push(data.command_name);
  return keyParts.join(':');
}

function isDuplicateEvent(eventKey) {
  const now = Date.now();
  const lastSent = recentEvents.get(eventKey);
  if (lastSent && (now - lastSent) < DEDUPE_WINDOW_MS) return true;
  if (recentEvents.size > 1000) {
    for (const [key, timestamp] of recentEvents) {
      if (now - timestamp > DEDUPE_WINDOW_MS * 5) recentEvents.delete(key);
    }
  }
  recentEvents.set(eventKey, now);
  return false;
}

async function sendLogEvent(config, guildId, eventType, data) {
  if (typeof config?.shouldLogGuild === 'function' && !config.shouldLogGuild(guildId)) return;
  const eventKey = getEventKey(guildId, eventType, data);
  if (isDuplicateEvent(eventKey)) {
    console.log(`[LogHandler] Skipping duplicate ${eventType} event`);
    return;
  }
  try {
    const response = await fetch(`${APP_API_BASE}/api/public/bot-log-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': config.botSecretKey,
      },
      body: JSON.stringify({ guild_id: guildId, event_type: eventType, data }),
    });
    const result = await response.json();
    if (!result.logged && result.reason) return;
    if (result.error) console.error(`[LogHandler] Error logging ${eventType}:`, result.error);
  } catch (error) {
    console.error(`[LogHandler] Failed to send ${eventType} event:`, error.message);
  }
}

// Helper to fetch recent audit log entry
async function fetchAuditLog(guild, actionType, targetId, withinMs = 5000) {
  try {
    const auditLogs = await guild.fetchAuditLogs({ type: actionType, limit: 1 });
    const entry = auditLogs.entries.first();
    if (entry && (Date.now() - entry.createdTimestamp) < withinMs) {
      if (!targetId || entry.target?.id === targetId) {
        return entry;
      }
    }
  } catch (e) { /* No audit log access */ }
  return null;
}

function registerLogHandlers(client, config) {
  // ──── Member Events ────
  client.on('guildMemberAdd', async (member) => {
    await sendLogEvent(config, member.guild.id, 'member_join', {
      user_id: member.user.id,
      user_name: member.user.tag,
      user_avatar: member.user.displayAvatarURL(),
      account_created: member.user.createdAt?.toISOString(),
    });
  });

  client.on('guildMemberRemove', async (member) => {
    // Check audit log for kick
    const kickLog = await fetchAuditLog(member.guild, AuditLogEvent.MemberKick, member.user.id);
    if (kickLog) {
      await sendLogEvent(config, member.guild.id, 'member_kick', {
        user_id: member.user.id,
        user_name: member.user.tag,
        user_avatar: member.user.displayAvatarURL(),
        moderator_id: kickLog.executor?.id,
        moderator_name: kickLog.executor?.tag,
        reason: kickLog.reason || 'Ingen årsag angivet',
      });
      return;
    }

    await sendLogEvent(config, member.guild.id, 'member_leave', {
      user_id: member.user.id,
      user_name: member.user.tag,
      user_avatar: member.user.displayAvatarURL(),
      roles: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ') || 'Ingen',
    });
  });

  client.on('guildBanAdd', async (ban) => {
    // Lookup who banned via audit log
    const banLog = await fetchAuditLog(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendLogEvent(config, ban.guild.id, 'member_ban', {
      user_id: ban.user.id,
      user_name: ban.user.tag,
      user_avatar: ban.user.displayAvatarURL(),
      reason: ban.reason || banLog?.reason || 'Ingen årsag angivet',
      moderator_id: banLog?.executor?.id,
      moderator_name: banLog?.executor?.tag,
    });
  });

  client.on('guildBanRemove', async (ban) => {
    const unbanLog = await fetchAuditLog(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendLogEvent(config, ban.guild.id, 'member_unban', {
      user_id: ban.user.id,
      user_name: ban.user.tag,
      user_avatar: ban.user.displayAvatarURL(),
      moderator_id: unbanLog?.executor?.id,
      moderator_name: unbanLog?.executor?.tag,
    });
  });

  // ──── Message Events ────
  client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    
    // Check audit log for who deleted the message
    const deleteLog = await fetchAuditLog(message.guild, AuditLogEvent.MessageDelete, message.author?.id);
    const deletedBy = deleteLog?.executor;
    const isSelfDelete = !deletedBy || deletedBy.id === message.author?.id;

    await sendLogEvent(config, message.guild.id, 'message_delete', {
      user_id: message.author?.id,
      user_name: message.author?.tag,
      user_avatar: message.author?.displayAvatarURL(),
      channel_id: message.channel.id,
      channel_name: message.channel.name,
      content: message.content || '(intet tekstindhold)',
      attachments: message.attachments?.size > 0 ? message.attachments.map(a => a.url).join(', ') : null,
      deleted_by_id: isSelfDelete ? null : deletedBy?.id,
      deleted_by_name: isSelfDelete ? null : deletedBy?.tag,
    });
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    await sendLogEvent(config, newMessage.guild.id, 'message_edit', {
      user_id: newMessage.author?.id,
      user_name: newMessage.author?.tag,
      user_avatar: newMessage.author?.displayAvatarURL(),
      channel_id: newMessage.channel.id,
      channel_name: newMessage.channel.name,
      message_id: newMessage.id,
      old_content: oldMessage.content || '(ukendt)',
      new_content: newMessage.content || '(intet tekstindhold)',
      message_url: newMessage.url,
    });
  });

  client.on('messageDeleteBulk', async (messages) => {
    const firstMessage = messages.first();
    if (!firstMessage?.guild) return;
    await sendLogEvent(config, firstMessage.guild.id, 'message_bulk_delete', {
      channel_id: firstMessage.channel.id,
      channel_name: firstMessage.channel.name,
      message_count: messages.size,
    });
  });

  // ──── Message Pin/Unpin ────
  client.on('channelPinsUpdate', async (channel) => {
    if (!channel.guild) return;
    // Check audit log for pin action
    const pinLog = await fetchAuditLog(channel.guild, AuditLogEvent.MessagePin, null);
    if (pinLog) {
      await sendLogEvent(config, channel.guild.id, 'message_pin', {
        channel_id: channel.id,
        channel_name: channel.name,
        user_id: pinLog.executor?.id,
        user_name: pinLog.executor?.tag,
        user_avatar: pinLog.executor?.displayAvatarURL(),
        target_id: pinLog.target?.id,
      });
      return;
    }
    // Check for unpin
    const unpinLog = await fetchAuditLog(channel.guild, AuditLogEvent.MessageUnpin, null);
    if (unpinLog) {
      await sendLogEvent(config, channel.guild.id, 'message_unpin', {
        channel_id: channel.id,
        channel_name: channel.name,
        user_id: unpinLog.executor?.id,
        user_name: unpinLog.executor?.tag,
        user_avatar: unpinLog.executor?.displayAvatarURL(),
        target_id: unpinLog.target?.id,
      });
    }
  });

  // ──── Role Events ────
  client.on('roleCreate', async (role) => {
    const log = await fetchAuditLog(role.guild, AuditLogEvent.RoleCreate, role.id);
    await sendLogEvent(config, role.guild.id, 'role_create', {
      role_id: role.id,
      role_name: role.name,
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  client.on('roleDelete', async (role) => {
    const log = await fetchAuditLog(role.guild, AuditLogEvent.RoleDelete, role.id);
    await sendLogEvent(config, role.guild.id, 'role_delete', {
      role_id: role.id,
      role_name: role.name,
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`Navn: ${oldRole.name} → ${newRole.name}`);
    if (oldRole.color !== newRole.color) changes.push(`Farve: #${oldRole.color.toString(16)} → #${newRole.color.toString(16)}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('Tilladelser ændret');
    if (oldRole.hoist !== newRole.hoist) changes.push(`Vist separat: ${newRole.hoist ? 'Ja' : 'Nej'}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`Nævnbar: ${newRole.mentionable ? 'Ja' : 'Nej'}`);
    if (changes.length === 0) return;

    const log = await fetchAuditLog(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await sendLogEvent(config, newRole.guild.id, 'role_update', {
      role_id: newRole.id,
      role_name: newRole.name,
      changes: changes.join('\n'),
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  // ──── Channel Events ────
  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const log = await fetchAuditLog(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await sendLogEvent(config, channel.guild.id, 'channel_create', {
      channel_id: channel.id,
      channel_name: channel.name,
      channel_type: channel.type,
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const log = await fetchAuditLog(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendLogEvent(config, channel.guild.id, 'channel_delete', {
      channel_id: channel.id,
      channel_name: channel.name,
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`Navn: ${oldChannel.name} → ${newChannel.name}`);
    if (oldChannel.topic !== newChannel.topic) changes.push(`Emne ændret`);
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`NSFW: ${newChannel.nsfw ? 'Ja' : 'Nej'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`Slowmode: ${newChannel.rateLimitPerUser}s`);
    if (changes.length === 0) return;

    const log = await fetchAuditLog(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    // Skip stats-channel name updates by the bot itself (spam from stats counters)
    if (log?.executor?.id === client.user?.id && changes.length === 1 && oldChannel.name !== newChannel.name) {
      return;
    }

    await sendLogEvent(config, newChannel.guild.id, 'channel_update', {
      channel_id: newChannel.id,
      channel_name: newChannel.name,
      changes: changes.join('\n'),
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
    });
  });

  // ──── Voice Events ────
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;
    const userId = newState.member?.user.id || oldState.member?.user.id;
    const userName = newState.member?.user.tag || oldState.member?.user.tag;
    const userAvatar = newState.member?.user.displayAvatarURL() || oldState.member?.user.displayAvatarURL();

    // Voice Join
    if (!oldState.channelId && newState.channelId) {
      await sendLogEvent(config, guildId, 'voice_join', {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        channel_id: newState.channelId, channel_name: newState.channel?.name,
      });
    }
    // Voice Leave
    else if (oldState.channelId && !newState.channelId) {
      await sendLogEvent(config, guildId, 'voice_leave', {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        channel_id: oldState.channelId, channel_name: oldState.channel?.name,
      });
    }
    // Voice Move
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const moveLog = await fetchAuditLog(newState.guild, AuditLogEvent.MemberMove, null);
      if (moveLog && moveLog.executor?.id !== userId) {
        await sendLogEvent(config, guildId, 'member_voice_move', {
          user_id: userId, user_name: userName, user_avatar: userAvatar,
          voice_channel_from: oldState.channel?.name,
          voice_channel_to: newState.channel?.name,
          moderator_id: moveLog.executor?.id,
          moderator_name: moveLog.executor?.tag,
        });
        return;
      }

      await sendLogEvent(config, guildId, 'voice_move', {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        voice_channel_from: oldState.channel?.name,
        voice_channel_to: newState.channel?.name,
      });
    }

    // Server Mute
    if (oldState.channelId && newState.channelId && oldState.serverMute !== newState.serverMute) {
      await sendLogEvent(config, guildId, 'voice_server_mute', {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        muted: newState.serverMute,
        channel_name: newState.channel?.name || oldState.channel?.name,
      });
    }

    // Server Deafen
    if (oldState.channelId && newState.channelId && oldState.serverDeaf !== newState.serverDeaf) {
      await sendLogEvent(config, guildId, 'voice_server_deafen', {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        deafened: newState.serverDeaf,
        channel_name: newState.channel?.name || oldState.channel?.name,
      });
    }

    // Screen Share
    if (oldState.channelId && newState.channelId && oldState.streaming !== newState.streaming) {
      const eventType = newState.streaming ? 'screen_share_start' : 'screen_share_stop';
      await sendLogEvent(config, guildId, eventType, {
        user_id: userId, user_name: userName, user_avatar: userAvatar,
        channel_name: newState.channel?.name || oldState.channel?.name,
      });
    }
  });

  // ──── Member Update (Nickname, Role Add/Remove, Boost, Timeout) ────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Nickname Change
    if (oldMember.nickname !== newMember.nickname) {
      const log = await fetchAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.user.id);
      const changedBy = log?.executor;
      const isSelf = !changedBy || changedBy.id === newMember.user.id;
      await sendLogEvent(config, newMember.guild.id, 'nickname_change', {
        user_id: newMember.user.id,
        user_name: newMember.user.tag,
        user_avatar: newMember.user.displayAvatarURL(),
        old_nickname: oldMember.nickname || oldMember.user.username,
        new_nickname: newMember.nickname || newMember.user.username,
        changed_by_id: isSelf ? null : changedBy?.id,
        changed_by_name: isSelf ? null : changedBy?.tag,
      });
    }

    // Timeout (communicationDisabledUntil)
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (!oldTimeout && newTimeout && newTimeout > Date.now()) {
      const log = await fetchAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.user.id);
      await sendLogEvent(config, newMember.guild.id, 'member_timeout', {
        user_id: newMember.user.id,
        user_name: newMember.user.tag,
        user_avatar: newMember.user.displayAvatarURL(),
        timeout_until: new Date(newTimeout).toISOString(),
        moderator_id: log?.executor?.id,
        moderator_name: log?.executor?.tag,
        reason: log?.reason || null,
      });
    } else if (oldTimeout && oldTimeout > Date.now() && (!newTimeout || newTimeout <= Date.now())) {
      const log = await fetchAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.user.id);
      await sendLogEvent(config, newMember.guild.id, 'member_untimeout', {
        user_id: newMember.user.id,
        user_name: newMember.user.tag,
        user_avatar: newMember.user.displayAvatarURL(),
        moderator_id: log?.executor?.id,
        moderator_name: log?.executor?.tag,
      });
    }

    // Role Add/Remove with audit log lookup for who changed
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const log = await fetchAuditLog(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.user.id);
      const changedBy = log?.executor;

      for (const [, role] of addedRoles) {
        await sendLogEvent(config, newMember.guild.id, 'role_add', {
          user_id: newMember.user.id,
          user_name: newMember.user.tag,
          user_avatar: newMember.user.displayAvatarURL(),
          role_id: role.id,
          role_name: role.name,
          changed_by_id: changedBy?.id,
          changed_by_name: changedBy?.tag,
        });
      }

      for (const [, role] of removedRoles) {
        await sendLogEvent(config, newMember.guild.id, 'role_remove', {
          user_id: newMember.user.id,
          user_name: newMember.user.tag,
          user_avatar: newMember.user.displayAvatarURL(),
          role_id: role.id,
          role_name: role.name,
          changed_by_id: changedBy?.id,
          changed_by_name: changedBy?.tag,
        });
      }
    }

    // Server Boost
    if (!oldMember.premiumSince && newMember.premiumSince) {
      await sendLogEvent(config, newMember.guild.id, 'server_boost', {
        user_id: newMember.user.id,
        user_name: newMember.user.tag,
        user_avatar: newMember.user.displayAvatarURL(),
        boost_count: newMember.guild.premiumSubscriptionCount,
        boost_tier: newMember.guild.premiumTier,
      });
    }
    if (oldMember.premiumSince && !newMember.premiumSince) {
      await sendLogEvent(config, newMember.guild.id, 'server_boost_remove', {
        user_id: newMember.user.id,
        user_name: newMember.user.tag,
        user_avatar: newMember.user.displayAvatarURL(),
        boost_count: newMember.guild.premiumSubscriptionCount,
        boost_tier: newMember.guild.premiumTier,
      });
    }
  });

  // ──── Server Update ────
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    const changes = [];
    if (oldGuild.name !== newGuild.name) changes.push(`Navn: ${oldGuild.name} → ${newGuild.name}`);
    if (oldGuild.icon !== newGuild.icon) changes.push('Server-ikon ændret');
    if (oldGuild.banner !== newGuild.banner) changes.push('Server-banner ændret');
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`Verifikationsniveau: ${newGuild.verificationLevel}`);
    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) changes.push('Standard-notifikationer ændret');
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) changes.push(`Eksplicit indholdsfilter: ${newGuild.explicitContentFilter}`);
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push('System-kanal ændret');
    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) changes.push('Regel-kanal ændret');
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`Vanity URL: ${newGuild.vanityURLCode || 'Fjernet'}`);
    if (oldGuild.description !== newGuild.description) changes.push('Beskrivelse ændret');
    if (changes.length === 0) return;

    const log = await fetchAuditLog(newGuild, AuditLogEvent.GuildUpdate, null);
    await sendLogEvent(config, newGuild.id, 'server_update', {
      changes: changes.join('\n'),
      moderator_id: log?.executor?.id,
      moderator_name: log?.executor?.tag,
      user_name: log?.executor?.tag,
      user_avatar: log?.executor?.displayAvatarURL(),
    });
  });

  // ──── Invite Events ────
  client.on('inviteCreate', async (invite) => {
    await sendLogEvent(config, invite.guild.id, 'invite_create', {
      user_id: invite.inviter?.id,
      user_name: invite.inviter?.tag,
      user_avatar: invite.inviter?.displayAvatarURL(),
      invite_code: invite.code,
      invite_uses: invite.maxUses,
      channel_id: invite.channel?.id,
      channel_name: invite.channel?.name,
      expires_at: invite.expiresAt?.toISOString(),
    });
  });

  client.on('inviteDelete', async (invite) => {
    await sendLogEvent(config, invite.guild.id, 'invite_delete', {
      invite_code: invite.code,
      channel_id: invite.channel?.id,
      channel_name: invite.channel?.name,
    });
  });

  // ──── Emoji Events ────
  client.on('emojiCreate', async (emoji) => {
    await sendLogEvent(config, emoji.guild.id, 'emoji_create', {
      emoji_name: emoji.name,
      emoji_id: emoji.id,
      user_name: emoji.author?.tag,
    });
  });

  client.on('emojiDelete', async (emoji) => {
    await sendLogEvent(config, emoji.guild.id, 'emoji_delete', {
      emoji_name: emoji.name,
      emoji_id: emoji.id,
    });
  });

  client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
    if (oldEmoji.name === newEmoji.name) return;
    await sendLogEvent(config, newEmoji.guild.id, 'emoji_update', {
      emoji_name: newEmoji.name,
      emoji_id: newEmoji.id,
      old_name: oldEmoji.name,
      new_name: newEmoji.name,
    });
  });

  // ──── Sticker Events ────
  client.on('stickerCreate', async (sticker) => {
    await sendLogEvent(config, sticker.guild?.id, 'sticker_create', {
      sticker_name: sticker.name,
      sticker_id: sticker.id,
    });
  });

  client.on('stickerDelete', async (sticker) => {
    await sendLogEvent(config, sticker.guild?.id, 'sticker_delete', {
      sticker_name: sticker.name,
      sticker_id: sticker.id,
    });
  });

  // ──── Thread Events ────
  client.on('threadCreate', async (thread) => {
    if (!thread.guild) return;
    await sendLogEvent(config, thread.guild.id, 'thread_create', {
      channel_id: thread.id,
      thread_name: thread.name,
      channel_name: thread.parent?.name,
      user_id: thread.ownerId,
    });
  });

  client.on('threadDelete', async (thread) => {
    if (!thread.guild) return;
    await sendLogEvent(config, thread.guild.id, 'thread_delete', {
      channel_id: thread.id,
      thread_name: thread.name,
      channel_name: thread.parent?.name,
    });
  });

  client.on('threadUpdate', async (oldThread, newThread) => {
    if (!newThread.guild) return;
    if (!oldThread.archived && newThread.archived) {
      await sendLogEvent(config, newThread.guild.id, 'thread_archive', {
        channel_id: newThread.id,
        thread_name: newThread.name,
        channel_name: newThread.parent?.name,
      });
    }
  });

  // ──── Command Usage ────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;
    await sendLogEvent(config, interaction.guild.id, 'command_used', {
      user_id: interaction.user.id,
      user_name: interaction.user.tag,
      user_avatar: interaction.user.displayAvatarURL(),
      command_name: interaction.commandName,
      channel_id: interaction.channel?.id,
      channel_name: interaction.channel?.name,
    });
  });

  console.log('[LogHandler] All event handlers registered (v2 - extended with timeout, server updates, pins, audit logs)');
}

module.exports = { registerLogHandlers };
