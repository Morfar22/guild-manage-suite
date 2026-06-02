/**
 * Auto-Moderation Rule Handler
 * 
 * Checks every message against the automod_rules configured in the dashboard
 * (banned words, links, invites, mentions, caps). Calls the automod-handler
 * edge function and enforces the returned action on Discord.
 */

const { Events } = require('discord.js');
const { botLog } = require('./consoleLogger');
const { isAutomodBypassed } = require('../automodBypass');

const AUTOMOD_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/automod-handler`
  : 'https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/automod-handler';
const BOT_SECRET = process.env.BOT_SECRET_KEY;

// Cache which guilds have automod enabled (avoid calling edge fn for every msg in guilds without rules)
const guildRuleCache = new Map();
const CACHE_TTL = 120_000; // 2 minutes

function setupAutomodRuleHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;
    if (!message.content || message.content.length < 1) return;

    // Global automod bypass roles
    if (message.member && await isAutomodBypassed(supabase, message.member)) return;

    try {
      // Check cache – if we know this guild has no rules, skip
      const cached = guildRuleCache.get(message.guild.id);
      if (cached && Date.now() - cached.ts < CACHE_TTL && !cached.hasRules) return;

      // Check exempt roles (member roles checked against rule exempt_roles is done server-side)
      
      const response = await fetch(AUTOMOD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET,
        },
        body: JSON.stringify({
          guild_id: message.guild.id,
          user_id: message.author.id,
          username: message.author.username,
          channel_id: message.channel.id,
          message_content: message.content,
          mentions_count: message.mentions.users.size + (message.mentions.everyone ? 1 : 0),
          role_mentions_count: message.mentions.roles.size,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown automod error');
        botLog('00000000-0000-0000-0000-000000000000', 'error', 'automod', `Automod request failed (${response.status}) for guild ${message.guild.id}`, {
          status: response.status,
          body: errorText,
          guildId: message.guild.id,
          channelId: message.channel.id,
        });

        if (response.status === 404) {
          guildRuleCache.set(message.guild.id, { hasRules: false, ts: Date.now() });
        }
        return;
      }

      const result = await response.json();

      if (!result.should_act) {
        // Guild exists but no rules triggered – still might have rules, so don't cache as "no rules"
        return;
      }

      // Cache that this guild has rules
      guildRuleCache.set(message.guild.id, { hasRules: true, ts: Date.now() });

      const action = result.action || 'delete';
      const reason = result.reason || 'Automod rule violation';

      // Check exempt roles before acting
      if (message.member) {
        // Get the rules to check exempt roles
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', message.guild.id)
          .single();

        if (guild) {
          const { data: rules } = await supabase
            .from('automod_rules')
            .select('exempt_roles')
            .eq('guild_id', guild.id)
            .eq('rule_type', result.rule_type)
            .eq('enabled', true)
            .maybeSingle();

          if (rules?.exempt_roles?.length) {
            const memberRoleIds = message.member.roles.cache.map(r => r.id);
            const isExempt = rules.exempt_roles.some(r => memberRoleIds.includes(r));
            if (isExempt) return;
          }
        }
      }

      // Execute the action
      switch (action) {
        case 'delete':
          await message.delete().catch(() => {});
          break;

        case 'warn':
          await message.reply({
            content: `⚠️ ${message.author}, din besked overtrådte en automod-regel: ${reason}`,
            allowedMentions: { users: [message.author.id] },
          }).catch(() => {});
          break;

        case 'mute':
          await message.delete().catch(() => {});
          await message.member?.timeout(
            (result.action_duration_seconds || 600) * 1000,
            `Automod: ${reason}`
          ).catch(() => {});
          break;

        case 'kick':
          await message.delete().catch(() => {});
          await message.member?.kick(`Automod: ${reason}`).catch(() => {});
          break;

        case 'ban':
          await message.delete().catch(() => {});
          await message.member?.ban({ reason: `Automod: ${reason}` }).catch(() => {});
          break;
      }

      // Send notification to author (for delete action)
      if (action === 'delete') {
        const notif = await message.channel.send({
          content: `⚠️ ${message.author}, din besked blev fjernet: ${reason}`,
          allowedMentions: { users: [message.author.id] },
        }).catch(() => null);

        if (notif) {
          setTimeout(() => notif.delete().catch(() => {}), 5000);
        }
      }

      console.log(`[Automod] ${result.rule_type} triggered for ${message.author.username} in ${message.guild.name}: ${reason}`);

    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      console.error('[Automod] Error:', messageText);
      botLog('00000000-0000-0000-0000-000000000000', 'error', 'automod', `Automod runtime error: ${messageText}`, {
        guildId: message.guild?.id,
        channelId: message.channel?.id,
      });
    }
  });

  console.log('[Automod] Rule handler initialized');
}

module.exports = { setupAutomodRuleHandler };
