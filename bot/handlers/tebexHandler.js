/**
 * Tebex Handler for Discord Bot
 * 
 * Polls the fivem_command_queue for tebex_notification and tebex_role_grant
 * commands queued by the tebex-webhook edge function.
 */

const { EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { manager } = require('../customBotManager');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const POLL_INTERVAL = 10000; // 10 seconds
let tebexPollingStarted = false;
let tebexStartRegistered = false;
let tebexInterval = null;

function setupTebexHandler(client) {
  if (!client) return { destroy: () => {} };

  const startPolling = () => {
    if (tebexPollingStarted) return;
    tebexPollingStarted = true;
    console.log('[TebexHandler] Starter én global poller for Tebex-kommandoer...');
    pollTebexQueue().catch(() => {});
    tebexInterval = setInterval(() => pollTebexQueue().catch(() => {}), POLL_INTERVAL);
  };

  // Only one process-wide poller is needed. It routes each queue item through
  // the Discord client responsible for that guild.
  if (!tebexStartRegistered && !tebexPollingStarted) {
    tebexStartRegistered = true;
    if (client.isReady()) {
      startPolling();
    } else {
      client.once('clientReady', startPolling);
    }
  }

  return { destroy: () => {} };
}

async function pollTebexQueue() {
  try {
    const { data: commands, error } = await supabase
      .from('fivem_command_queue')
      .select('*')
      .in('command_name', ['tebex_notification', 'tebex_role_grant'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error || !commands || commands.length === 0) return;

    for (const cmd of commands) {
      try {
        // Guild filter: resolve guild_id to Discord guild_id and check
        const { data: guildRow } = await supabase
          .from('guilds')
          .select('guild_id')
          .eq('id', cmd.guild_id)
          .maybeSingle();

        if (!guildRow) {
          await markCommand(cmd.id, 'failed', 'Guild not found in database');
          continue;
        }

        const client = manager.getClient(guildRow.guild_id);
        if (!client?.isReady?.()) {
          continue; // Responsible bot is still starting or unavailable
        }

        const guild = client.guilds.cache.get(guildRow.guild_id);
        if (!guild) {
          continue; // Responsible bot doesn't currently have access to this guild
        }

        if (cmd.command_name === 'tebex_notification') {
          await handleNotification(guild, cmd);
        } else if (cmd.command_name === 'tebex_role_grant') {
          await handleRoleGrant(guild, cmd);
        }

        await markCommand(cmd.id, 'executed', 'success');
      } catch (err) {
        console.error(`[TebexHandler] Fejl ved kommando ${cmd.id}:`, err.message);
        await markCommand(cmd.id, 'failed', err.message);
      }
    }
  } catch (err) {
    // Silently fail on poll errors
  }
}

async function markCommand(id, status, result) {
  await supabase
    .from('fivem_command_queue')
    .update({ status, executed_at: new Date().toISOString(), result })
    .eq('id', id);
}

async function handleNotification(guild, cmd) {
  const data = cmd.command_data;
  if (!data?.channel_id || !data?.embed) return;

  const channel = guild.channels.cache.get(data.channel_id);
  if (!channel || !channel.isTextBased()) return;

  const embedData = data.embed;
  const embed = new EmbedBuilder()
    .setTitle(embedData.title || 'Tebex Notifikation')
    .setColor(embedData.color || 0x2ecc71)
    .setTimestamp(embedData.timestamp ? new Date(embedData.timestamp) : new Date());

  if (embedData.fields) {
    for (const field of embedData.fields) {
      embed.addFields({ name: field.name, value: String(field.value || '-'), inline: field.inline ?? true });
    }
  }

  await channel.send({ embeds: [embed] });
  console.log(`[TebexHandler] Notifikation sendt til #${channel.name} i ${guild.name}`);
}

async function handleRoleGrant(guild, cmd) {
  const data = cmd.command_data;
  if (!data?.discord_user_id || !data?.role_id) return;

  try {
    const member = await guild.members.fetch(data.discord_user_id);
    if (!member) return;

    const role = guild.roles.cache.get(data.role_id);
    if (!role) {
      console.error(`[TebexHandler] Rolle ${data.role_id} ikke fundet i ${guild.name}`);
      return;
    }

    if (member.roles.cache.has(role.id)) {
      console.log(`[TebexHandler] ${member.user.tag} har allerede rollen ${role.name}`);
      return;
    }

    await member.roles.add(role, 'Tebex køb - automatisk rolletildeling');
    console.log(`[TebexHandler] Rolle ${role.name} tildelt til ${member.user.tag} i ${guild.name}`);
  } catch (err) {
    console.error(`[TebexHandler] Rolle-tildeling fejl:`, err.message);
    throw err;
  }
}

module.exports = { setupTebexHandler };
