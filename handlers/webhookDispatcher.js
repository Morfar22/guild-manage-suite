/**
 * Webhook Dispatcher Handler
 * 
 * Reads webhook_configs from the database and dispatches
 * events to configured Discord webhooks based on event_types.
 */

const { Events } = require('discord.js');

// Cache webhook configs per guild (refresh every 5 min)
const webhookCache = new Map();
const CACHE_TTL = 300_000;

function setupWebhookDispatcher(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  // Get webhooks for a guild (cached)
  async function getWebhooks(guildDiscordId) {
    const cached = webhookCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.webhooks;

    try {
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', guildDiscordId)
        .single();
      if (!guild) return [];

      const { data } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('enabled', true);

      const webhooks = data || [];
      webhookCache.set(guildDiscordId, { webhooks, _ts: Date.now() });
      return webhooks;
    } catch {
      return [];
    }
  }

  // Dispatch event to matching webhooks
  async function dispatch(guildDiscordId, eventType, payload) {
    const webhooks = await getWebhooks(guildDiscordId);
    const matching = webhooks.filter(wh => wh.event_types.includes(eventType));

    for (const wh of matching) {
      try {
        await fetch(wh.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'BotDash',
            embeds: [{
              title: payload.title,
              description: payload.description,
              color: payload.color || 0x5865F2,
              timestamp: new Date().toISOString(),
              footer: { text: `Event: ${eventType}` },
              fields: payload.fields || [],
            }],
          }),
        });

        // Update last_used_at (fire and forget)
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', guildDiscordId)
          .single();
        if (guild) {
          supabase.from('webhook_configs')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', wh.id)
            .then(() => {});
        }
      } catch {
        // Silent fail for individual webhook
      }
    }
  }

  // Member join
  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.guild || (shouldHandleGuild && !shouldHandleGuild(member.guild.id))) return;
    await dispatch(member.guild.id, 'member_join', {
      title: '👋 Nyt medlem',
      description: `**${member.user.username}** er tilsluttet serveren`,
      color: 0x57F287,
      fields: [
        { name: 'Bruger', value: `<@${member.user.id}>`, inline: true },
        { name: 'Konto oprettet', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      ],
    });
  });

  // Member leave
  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.guild || (shouldHandleGuild && !shouldHandleGuild(member.guild.id))) return;
    await dispatch(member.guild.id, 'member_leave', {
      title: '👋 Medlem forladt',
      description: `**${member.user.username}** har forladt serveren`,
      color: 0xED4245,
    });
  });

  // Ban
  client.on(Events.GuildBanAdd, async (ban) => {
    if (!ban.guild || (shouldHandleGuild && !shouldHandleGuild(ban.guild.id))) return;
    await dispatch(ban.guild.id, 'ban', {
      title: '🔨 Bruger banned',
      description: `**${ban.user.username}** blev banned`,
      color: 0xED4245,
      fields: ban.reason ? [{ name: 'Årsag', value: ban.reason }] : [],
    });
  });

  // Message delete
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;
    await dispatch(message.guild.id, 'message_delete', {
      title: '🗑️ Besked slettet',
      description: message.content?.substring(0, 200) || '*Ingen tekst*',
      color: 0xFEE75C,
      fields: [
        { name: 'Bruger', value: message.author ? `<@${message.author.id}>` : 'Ukendt', inline: true },
        { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
      ],
    });
  });

  console.log('[WebhookDispatcher] Handler initialized');
}

module.exports = { setupWebhookDispatcher };
