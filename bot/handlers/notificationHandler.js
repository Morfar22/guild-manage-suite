/**
 * Dashboard Notification Handler
 * 
 * Sends notifications to the dashboard_notifications table
 * when key events happen (member join/leave, mod actions, etc.)
 * These show up in the real-time Dashboard Notifications page.
 */

const { Events } = require('discord.js');

function setupNotificationHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  // Helper to insert a notification
  async function notify(guildDiscordId, type, title, message, source = 'bot', metadata = null) {
    try {
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', guildDiscordId)
        .single();
      if (!guild) return;

      await supabase.from('dashboard_notifications').insert({
        guild_id: guild.id,
        type,
        title,
        message,
        source,
        metadata,
      });
    } catch (err) {
      // Silent fail - notifications are non-critical
    }
  }

  // Member join
  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || (shouldHandleGuild && !shouldHandleGuild(member.guild.id))) return;
    await notify(
      member.guild.id,
      'member',
      'Nyt medlem',
      `${member.user.username} er tilsluttet serveren`,
      'bot',
      { user_id: member.user.id, username: member.user.username }
    );
  });

  // Member leave
  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.guild || (shouldHandleGuild && !shouldHandleGuild(member.guild.id))) return;
    await notify(
      member.guild.id,
      'member',
      'Medlem forladt',
      `${member.user.username} har forladt serveren`,
      'bot',
      { user_id: member.user.id, username: member.user.username }
    );
  });

  // Ban
  client.on(Events.GuildBanAdd, async (ban) => {
    if (!ban.guild || (shouldHandleGuild && !shouldHandleGuild(ban.guild.id))) return;
    await notify(
      ban.guild.id,
      'moderation',
      'Bruger banned',
      `${ban.user.username} blev banned${ban.reason ? `: ${ban.reason}` : ''}`,
      'moderation',
      { user_id: ban.user.id, reason: ban.reason }
    );
  });

  // Unban
  client.on(Events.GuildBanRemove, async (ban) => {
    if (!ban.guild || (shouldHandleGuild && !shouldHandleGuild(ban.guild.id))) return;
    await notify(
      ban.guild.id,
      'moderation',
      'Bruger unbanned',
      `${ban.user.username} blev unbanned`,
      'moderation',
      { user_id: ban.user.id }
    );
  });

  // Channel create
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild || (shouldHandleGuild && !shouldHandleGuild(channel.guild.id))) return;
    await notify(
      channel.guild.id,
      'system',
      'Kanal oprettet',
      `#${channel.name} blev oprettet`,
      'system',
      { channel_id: channel.id, channel_name: channel.name }
    );
  });

  // Channel delete
  client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild || (shouldHandleGuild && !shouldHandleGuild(channel.guild.id))) return;
    await notify(
      channel.guild.id,
      'system',
      'Kanal slettet',
      `#${channel.name} blev slettet`,
      'system',
      { channel_name: channel.name }
    );
  });

  // Role create
  client.on(Events.GuildRoleCreate, async (role) => {
    if (!role.guild || (shouldHandleGuild && !shouldHandleGuild(role.guild.id))) return;
    await notify(
      role.guild.id,
      'system',
      'Rolle oprettet',
      `@${role.name} blev oprettet`,
      'system',
      { role_id: role.id, role_name: role.name }
    );
  });

  // Role delete
  client.on(Events.GuildRoleDelete, async (role) => {
    if (!role.guild || (shouldHandleGuild && !shouldHandleGuild(role.guild.id))) return;
    await notify(
      role.guild.id,
      'system',
      'Rolle slettet',
      `@${role.name} blev slettet`,
      'system',
      { role_name: role.name }
    );
  });

  console.log('[Notifications] Handler initialized');
}

module.exports = { setupNotificationHandler };
