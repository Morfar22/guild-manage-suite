/**
 * Discord Bot - Main Entry Point
 * 
 * Uses CustomBotManager to handle multiple bot instances:
 * - Default bot for all guilds
 * - Custom bots per guild (with unique tokens)
 * 
 * All handlers are registered via manager.registerHandler()
 * and applied to ALL bot instances automatically.
 * 
 * Required environment variables:
 * - DISCORD_TOKEN / DEFAULT_BOT_TOKEN
 * - BOT_SECRET_KEY
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (anbefalet til botten)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Events, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Import manager
const { manager } = require('./customBotManager');

// Import handlers
const { setupTicketHandler } = require('./handlers/ticketHandler');
const { setupWelcomeHandler } = require('./handlers/welcomeHandler');
const { setupInviteTracker } = require('./inviteTracker');
const { registerLogHandlers } = require('./handlers/logHandler');
const { setupReactionRoleHandler } = require('./handlers/reactionRoleHandler');
const { startTwitchChecker } = require('./handlers/twitchHandler');
const { startTikTokChecker } = require('./handlers/tiktokHandler');
const { startYouTubeChecker } = require('./handlers/youtubeHandler');
const jtcHandler = require('./handlers/jtcHandler');
const jtcButtonHandler = require('./handlers/jtcButtonHandler');
const { setupAIChatHandler } = require('./handlers/aiChatHandler');
const { initXPHandler } = require('./handlers/xpHandler');
const { setupApplicationHandler } = require('./handlers/applicationHandler');
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

// NEW: Import new feature handlers
const { setupStarboardHandler } = require('./handlers/starboardHandler');
const { WarningHandler } = require('./handlers/warningHandler');
const { AnalyticsHandler } = require('./handlers/analyticsHandler');
const { setupSchedulerHandler } = require('./schedulerHandler');
const { setupModmailHandler } = require('./handlers/modmailHandler');
const { setupTebexHandler } = require('./handlers/tebexHandler');
const { setupSuggestionHandler } = require('./handlers/suggestionHandler');
const { setupVerificationHandler } = require('./handlers/verificationHandler');
const { setupStatsHandler } = require('./handlers/statsHandler');
const { setupGlobalBanHandler } = require('./handlers/globalBanHandler');
const { setupScheduledActionHandler } = require('./handlers/scheduledActionHandler');
const { setupAfkHandler } = require('./handlers/afkHandler');
const { setupPollHandler } = require('./handlers/pollHandler');
const { setupAutoResponderHandler } = require('./handlers/autoResponderHandler');
const { setupCustomCommandHandler } = require('./handlers/customCommandHandler');
const { startHeartbeat, sendOfflineStatus, countMessage } = require('./handlers/heartbeatHandler');
const { botLog, flushLogs } = require('./consoleLogger');
const { setupReminderHandler } = require('./handlers/reminderHandler');
const { setupAutoReportHandler } = require('./handlers/autoReportHandler');
const { setupAIAutomodHandler } = require('./handlers/aiAutomodHandler');
const { setupAutomodRuleHandler } = require('./handlers/automodRuleHandler');
const { setupNotificationHandler } = require('./handlers/notificationHandler');
const { setupWebhookDispatcher } = require('./handlers/webhookDispatcher');
const { setupRaidProtectionHandler } = require('./handlers/raidProtectionHandler');
const { setupQuarantineHandler } = require('./handlers/quarantineHandler');
const { setupSlowmodeScheduler } = require('./slowmodeScheduler');
const { setupAltDetectionHandler } = require('./handlers/altDetectionHandler');
const { setupCountingHandler } = require('./handlers/countingHandler');
const { setupConfessionHandler } = require('./handlers/confessionHandler');
const { setupBirthdayHandler } = require('./handlers/birthdayHandler');
const { setupMusicQuizHandler } = require('./handlers/musicQuizHandler');
const { setupCurrencyShopHandler } = require('./handlers/currencyShopHandler');
const { setupPrefixHandler } = require('./handlers/prefixHandler');
// Optional: Music system (comment out if not using)
let initMusic, musicCommands, getKazagumo;
try {
  const music = require('./music');
  initMusic = music.initMusic;
  musicCommands = music.commands;
  getKazagumo = music.getKazagumo;
  console.log('[Bot] Music module loaded');
} catch (e) {
  console.log('[Bot] Music module not available');
}

// ==================== CONFIGURATION ====================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sleiplyixaxuvydzudxn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;

// Supabase client for database operations
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Bot] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set; falling back to SUPABASE_ANON_KEY. Some DB queries may fail due to RLS.');
}

// Store handler instances for cleanup
const handlerInstances = new Map();

// ==================== HELPER FUNCTIONS ====================

async function logModerationAction(guildId, action, moderator, target, reason, duration = null) {
  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guildId)
      .single();

    if (guild) {
      await supabase.from('moderation_logs').insert({
        guild_id: guild.id,
        action_type: action,
        moderator_id: moderator.id,
        moderator_name: moderator.tag,
        target_id: target.id,
        target_name: target.tag || target.user?.tag,
        reason: reason,
        duration_seconds: duration
      });
    }
  } catch (error) {
    console.error('Failed to log moderation action:', error);
  }
}

async function isCommandEnabled(guildId, commandName) {
  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) return true;

    const { data: command } = await supabase
      .from('guild_commands')
      .select('enabled')
      .eq('guild_id', guild.id)
      .eq('command_name', commandName)
      .single();

    return command ? command.enabled : true;
  } catch {
    return true;
  }
}

async function isModuleEnabled(guildId, moduleType) {
  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) return true;

    const { data: module } = await supabase
      .from('guild_modules')
      .select('enabled')
      .eq('guild_id', guild.id)
      .eq('module_type', moduleType)
      .single();

    return module ? module.enabled : true;
  } catch {
    return true;
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

async function callGiveawayHandler(payload) {
  const response = await fetch(`${APP_API_BASE}/api/public/giveaway-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET_KEY,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `Giveaway handler fejl (${response.status})`);
  }

  return data;
}

// ==================== GIVEAWAY AUTO-END CHECKER ====================
let giveawayCheckInterval = null;

function startGiveawayAutoEnd(shouldHandleGuild) {
  if (giveawayCheckInterval) return; // Singleton guard

  async function checkExpiredGiveaways() {
    try {
      const { data: expired } = await supabase
        .from('giveaways')
        .select('id, guild_id, guilds!inner(guild_id)')
        .eq('ended', false)
        .lte('ends_at', new Date().toISOString())
        .limit(20);

      if (!expired || expired.length === 0) return;

      for (const giveaway of expired) {
        const guildDiscordId = giveaway.guilds?.guild_id;
        if (guildDiscordId && shouldHandleGuild && !shouldHandleGuild(guildDiscordId)) continue;

        try {
          const result = await callGiveawayHandler({
            action: 'end',
            guildId: giveaway.guild_id,
            giveawayId: giveaway.id,
          });
          console.log(`[Giveaway] Auto-ended giveaway ${giveaway.id} — ${result?.winners?.length || 0} winners`);
        } catch (err) {
          console.error(`[Giveaway] Auto-end failed for ${giveaway.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Giveaway] Auto-end check error:', err.message);
    }
  }

  giveawayCheckInterval = setInterval(checkExpiredGiveaways, 30_000); // Check every 30s
  setTimeout(checkExpiredGiveaways, 5_000); // Initial check after 5s
  console.log('[Giveaway] Auto-end checker started');
}

async function handleGiveawayButton(interaction, shouldHandleGuild, isCustomBotInstance = false) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId?.startsWith('giveaway_enter_')) return false;
  if (!interaction.guild) return false;
  if (!isCustomBotInstance) return false;
  if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return false;

  const giveawayId = interaction.customId.replace('giveaway_enter_', '');

  try {
    await interaction.deferReply({ flags: 64 });

    const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
    if (!guild) {
      await interaction.editReply('❌ Server ikke fundet.');
      return true;
    }

    const { data: giveaway } = await supabase
      .from('giveaways')
      .select('id, required_role_id, entries')
      .eq('id', giveawayId)
      .eq('guild_id', guild.id)
      .maybeSingle();

    if (!giveaway) {
      await interaction.editReply('❌ Giveaway ikke fundet.');
      return true;
    }

    if (giveaway.required_role_id) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(giveaway.required_role_id)) {
        await interaction.editReply(`❌ Du skal have rollen <@&${giveaway.required_role_id}> for at deltage.`);
        return true;
      }
    }

    const entries = Array.isArray(giveaway.entries) ? giveaway.entries : [];
    const alreadyEntered = entries.includes(interaction.user.id);
    const action = alreadyEntered ? 'leave' : 'enter';
    const result = await callGiveawayHandler({
      action,
      guildId: guild.id,
      giveawayId,
      userId: interaction.user.id,
      username: interaction.user.username,
    });

    await interaction.editReply(
      action === 'enter'
        ? `✅ Du deltager nu i giveawayen! (${result.entriesCount ?? entries.length + 1} deltagere)`
        : `✅ Du er fjernet fra giveawayen. (${result.entriesCount ?? Math.max(entries.length - 1, 0)} deltagere)`
    );
  } catch (error) {
    console.error('[Bot] Giveaway button fejl:', error);
    const message = error.message || 'Der skete en fejl ved giveaway-knappen.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`❌ ${message}`).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ ${message}`, flags: 64 }).catch(() => {});
    }
  }

  return true;
}

// ==================== SLASH COMMAND HANDLERS ====================

function createSlashHandlers(client) {
  return {
    // ==================== MODERATION ====================

    ban: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at banne.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Ingen årsag angivet';
      const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

      try {
        await interaction.guild.members.ban(user, { reason, deleteMessageSeconds: deleteMessages * 86400 });
        await logModerationAction(interaction.guild.id, 'ban', interaction.user, user, reason);
        
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔨 Bruger Banned')
          .addFields(
            { name: 'Bruger', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Årsag', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke banne brugeren.', flags: 64 });
      }
    },

    unban: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at unban.', flags: 64 });
      }

      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') || 'Ingen årsag angivet';

      try {
        await interaction.guild.members.unban(userId, reason);
        await logModerationAction(interaction.guild.id, 'unban', interaction.user, { id: userId, tag: userId }, reason);
        await interaction.reply(`✅ Bruger \`${userId}\` er blevet unbanned.`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke unban brugeren. Tjek om ID er korrekt.', flags: 64 });
      }
    },

    kick: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at kicke.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Ingen årsag angivet';

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.kick(reason);
        await logModerationAction(interaction.guild.id, 'kick', interaction.user, user, reason);

        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('👢 Bruger Kicked')
          .addFields(
            { name: 'Bruger', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Årsag', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke kicke brugeren.', flags: 64 });
      }
    },

    mute: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at mute.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const duration = interaction.options.getInteger('duration') || 10;
      const reason = interaction.options.getString('reason') || 'Ingen årsag angivet';

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(duration * 60 * 1000, reason);
        await logModerationAction(interaction.guild.id, 'mute', interaction.user, user, reason, duration * 60);

        const embed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle('🔇 Bruger Muted')
          .addFields(
            { name: 'Bruger', value: `${user.tag}`, inline: true },
            { name: 'Varighed', value: `${duration} minutter`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Årsag', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke mute brugeren.', flags: 64 });
      }
    },

    unmute: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at unmute.', flags: 64 });
      }

      const user = interaction.options.getUser('user');

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(null);
        await logModerationAction(interaction.guild.id, 'unmute', interaction.user, user, 'Unmuted');
        await interaction.reply(`✅ **${user.tag}** er blevet unmuted.`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke unmute brugeren.', flags: 64 });
      }
    },

    warn: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at advare.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      // Use WarningHandler if available for points-based system
      const warnHandler = handlerInstances.get(`warning_${client._clientLabel || 'default'}`);
      if (warnHandler) {
        const result = await warnHandler.addWarning(interaction, user, reason);
        if (!result.success) {
          return interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
        }

        const embed = warnHandler.createWarningEmbed(user, { points: result.points, reason }, result.totalPoints, result.punishment);
        embed.addFields({ name: 'Moderator', value: interaction.user.tag, inline: true });

        try {
          await user.send(`⚠️ Du har modtaget en advarsel i **${interaction.guild.name}**\nÅrsag: ${reason}\nPoints: ${result.totalPoints}`);
        } catch {}

        await interaction.reply({ embeds: [embed] });
      } else {
        // Fallback to simple logging
        await logModerationAction(interaction.guild.id, 'warn', interaction.user, user, reason);

        const embed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle('⚠️ Advarsel')
          .addFields(
            { name: 'Bruger', value: `${user.tag}`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Årsag', value: reason }
          )
          .setTimestamp();

        try {
          await user.send(`⚠️ Du har modtaget en advarsel i **${interaction.guild.name}**\nÅrsag: ${reason}`);
        } catch {}

        await interaction.reply({ embeds: [embed] });
      }
    },

    warnings: async (interaction) => {
      const user = interaction.options.getUser('user');

      try {
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', interaction.guild.id)
          .single();

        if (!guild) return interaction.reply({ content: '❌ Server ikke fundet i database.', flags: 64 });

        const { data: warnings } = await supabase
          .from('moderation_logs')
          .select('*')
          .eq('guild_id', guild.id)
          .eq('target_id', user.id)
          .eq('action_type', 'warn')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!warnings || warnings.length === 0) {
          return interaction.reply(`✅ **${user.tag}** har ingen advarsler.`);
        }

        const embed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle(`⚠️ Advarsler for ${user.tag}`)
          .setDescription(warnings.map((w, i) => 
            `**${i + 1}.** ${w.reason}\n└ Af: ${w.moderator_name} • ${new Date(w.created_at).toLocaleDateString('da-DK')}`
          ).join('\n\n'))
          .setFooter({ text: `Total: ${warnings.length} advarsler` });

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke hente advarsler.', flags: 64 });
      }
    },

    clear: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at slette beskeder.', flags: 64 });
      }

      const amount = interaction.options.getInteger('amount');
      const user = interaction.options.getUser('user');

      if (amount < 1 || amount > 100) {
        return interaction.reply({ content: '❌ Antal skal være mellem 1 og 100.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      try {
        let messages = await interaction.channel.messages.fetch({ limit: amount });
        
        if (user) {
          messages = messages.filter(m => m.author.id === user.id);
        }

        const deleted = await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply(`✅ Slettede ${deleted.size} beskeder.`);
      } catch (error) {
        await interaction.editReply('❌ Kunne ikke slette beskeder. De er muligvis for gamle.');
      }
    },

    slowmode: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at ændre slowmode.', flags: 64 });
      }

      const seconds = interaction.options.getInteger('seconds');

      try {
        await interaction.channel.setRateLimitPerUser(seconds);
        if (seconds === 0) {
          await interaction.reply('✅ Slowmode deaktiveret.');
        } else {
          await interaction.reply(`✅ Slowmode sat til ${seconds} sekunder.`);
        }
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke ændre slowmode.', flags: 64 });
      }
    },

    lock: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at låse kanaler.', flags: 64 });
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: false
        });
        await interaction.reply(`🔒 ${channel} er nu låst.`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke låse kanalen.', flags: 64 });
      }
    },

    unlock: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at låse kanaler op.', flags: 64 });
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: null
        });
        await interaction.reply(`🔓 ${channel} er nu låst op.`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke låse kanalen op.', flags: 64 });
      }
    },

    softban: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse til at softban.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Softban';

      try {
        await interaction.guild.members.ban(user, { reason, deleteMessageSeconds: 7 * 86400 });
        await interaction.guild.members.unban(user, 'Softban complete');
        await logModerationAction(interaction.guild.id, 'kick', interaction.user, user, `Softban: ${reason}`);
        await interaction.reply(`✅ **${user.tag}** er blevet softbanned (beskeder slettet).`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke softban brugeren.', flags: 64 });
      }
    },

    // ==================== MUSIC ====================

    play: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const query = interaction.options.getString('query');
      await handleMusicCommand(interaction, 'play', [query]);
    },

    skip: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'skip', []);
    },

    stop: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'stop', []);
    },

    pause: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'pause', []);
    },

    resume: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'resume', []);
    },

    queue: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'queue', []);
    },

    nowplaying: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'nowplaying', []);
    },

    shuffle: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      await handleMusicCommand(interaction, 'shuffle', []);
    },

    volume: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const level = interaction.options.getInteger('level');
      await handleMusicCommand(interaction, 'volume', [level.toString()]);
    },

    loop: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const mode = interaction.options.getString('mode');
      await handleMusicCommand(interaction, 'loop', [mode]);
    },

    remove: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const position = interaction.options.getInteger('position');
      await handleMusicCommand(interaction, 'remove', [position.toString()]);
    },

    move: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const from = interaction.options.getInteger('from');
      const to = interaction.options.getInteger('to');
      await handleMusicCommand(interaction, 'move', [from.toString(), to.toString()]);
    },

    jump: async (interaction) => {
      if (!musicCommands) return interaction.reply({ content: '❌ Musik er ikke aktiveret.', flags: 64 });
      const position = interaction.options.getInteger('position');
      await handleMusicCommand(interaction, 'jump', [position.toString()]);
    },

    // ==================== LEVELING ====================

    rank: async (interaction) => {
      await interaction.deferReply();
      const user = interaction.options.getUser('user') || interaction.user;

      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: userData } = await supabase.from('user_levels').select('xp, level, total_messages').eq('guild_id', guild.id).eq('user_id', user.id).maybeSingle();

        const level = userData?.level || 0;
        const xp = userData?.xp || 0;
        const xpNeeded = (level + 1) * 100;
        const messages = userData?.total_messages || 0;

        // Get rank position
        const { count } = await supabase.from('user_levels').select('*', { count: 'exact', head: true }).eq('guild_id', guild.id).gt('xp', xp);
        const rank = (count || 0) + 1;

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle(`📊 Rank - ${user.tag}`)
          .addFields(
            { name: 'Level', value: `${level}`, inline: true },
            { name: 'XP', value: `${xp} / ${xpNeeded}`, inline: true },
            { name: 'Rank', value: `#${rank}`, inline: true },
            { name: 'Beskeder', value: `${messages}`, inline: true },
          )
          .setThumbnail(user.displayAvatarURL());

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Rank fejl:', error);
        await interaction.editReply('❌ Kunne ikke hente rank data.');
      }
    },

    leaderboard: async (interaction) => {
      await interaction.deferReply();
      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: topUsers } = await supabase.from('user_levels').select('user_id, discord_username, xp, level, total_messages').eq('guild_id', guild.id).order('xp', { ascending: false }).limit(10);

        if (!topUsers || topUsers.length === 0) {
          return interaction.editReply('📊 Ingen leveling data endnu.');
        }

        const medals = ['🥇', '🥈', '🥉'];
        const description = topUsers.map((u, i) => {
          const medal = medals[i] || `**${i + 1}.**`;
          return `${medal} ${u.discord_username || 'Ukendt'} — Level ${u.level} (${u.xp} XP)`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🏆 XP Leaderboard')
          .setDescription(description)
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Leaderboard fejl:', error);
        await interaction.editReply('❌ Kunne ikke hente leaderboard.');
      }
    },

    // ==================== UTILITY ====================

    help: async (interaction) => {
      const category = interaction.options.getString('category');

      const categories = {
        moderation: { emoji: '🛡️', commands: ['ban', 'kick', 'mute', 'unmute', 'warn', 'warnings', 'clearwarns', 'clear', 'slowmode', 'lock', 'unlock', 'softban', 'unban', 'timeout', 'untimeout', 'nuke'] },
        music: { emoji: '🎵', commands: ['play', 'skip', 'stop', 'pause', 'resume', 'queue', 'nowplaying', 'volume', 'loop', 'shuffle', 'remove', 'move', 'jump'] },
        leveling: { emoji: '📈', commands: ['rank', 'leaderboard'] },
        utility: { emoji: '🔧', commands: ['help', 'ping', 'serverinfo', 'userinfo', 'avatar', 'poll', 'remind'] },
        fun: { emoji: '🎮', commands: ['8ball', 'coinflip', 'dice', 'rps', 'joke', 'meme', 'ship', 'rate'] },
        economy: { emoji: '💰', commands: ['daily', 'work', 'balance', 'pay', 'deposit', 'withdraw', 'rob', 'richest'] },
        giveaway: { emoji: '🎉', commands: ['giveaway'] },
        suggestion: { emoji: '💡', commands: ['suggest'] },
        afk: { emoji: '💤', commands: ['afk'] },
        tebex: { emoji: '🛒', commands: ['tebex-verify'] }
      };

      if (category && categories[category]) {
        const cat = categories[category];
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`${cat.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
          .setDescription(cat.commands.map(c => `\`/${c}\``).join(', '));

        return interaction.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📚 Bot Commands')
        .setDescription('Brug `/help [kategori]` for at se commands i en kategori.')
        .addFields(
          Object.entries(categories).map(([name, data]) => ({
            name: `${data.emoji} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            value: `${data.commands.length} commands`,
            inline: true
          }))
        );

      await interaction.reply({ embeds: [embed] });
    },

    // Alias for /help
    commands: async (interaction) => {
      return slashHandlers.help(interaction);
    },

    ping: async (interaction) => {
      const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
      const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🏓 Pong!')
        .addFields(
          { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
          { name: 'WebSocket', value: `${client.ws.ping}ms`, inline: true }
        );

      await interaction.editReply({ content: null, embeds: [embed] });
    },

    serverinfo: async (interaction) => {
      const guild = interaction.guild;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Ejer', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 Medlemmer', value: guild.memberCount.toString(), inline: true },
          { name: '💬 Kanaler', value: guild.channels.cache.size.toString(), inline: true },
          { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
          { name: '🎭 Roller', value: guild.roles.cache.size.toString(), inline: true },
          { name: '🚀 Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true },
          { name: '📅 Oprettet', value: guild.createdAt.toLocaleDateString('da-DK'), inline: true }
        )
        .setFooter({ text: `ID: ${guild.id}` });

      await interaction.reply({ embeds: [embed] });
    },

    userinfo: async (interaction) => {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(member?.displayHexColor || '#5865F2')
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '📅 Oprettet', value: user.createdAt.toLocaleDateString('da-DK'), inline: true }
        );

      if (member) {
        embed.addFields(
          { name: '📥 Joined', value: member.joinedAt.toLocaleDateString('da-DK'), inline: true },
          { name: '🎭 Roller', value: member.roles.cache.size.toString(), inline: true }
        );
      }

      await interaction.reply({ embeds: [embed] });
    },

    avatar: async (interaction) => {
      const user = interaction.options.getUser('user') || interaction.user;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`${user.tag}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024 }));

      await interaction.reply({ embeds: [embed] });
    },

    poll: async (interaction) => {
      const question = interaction.options.getString('question');
      const options = interaction.options.getString('options').split('|').map(o => o.trim());

      if (options.length < 2 || options.length > 10) {
        return interaction.reply({ content: '❌ Angiv 2-10 muligheder separeret med |', flags: 64 });
      }

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n'))
        .setFooter({ text: `Poll af ${interaction.user.tag}` });

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

      for (let i = 0; i < options.length; i++) {
        await msg.react(emojis[i]);
      }
    },

    remind: async (interaction) => {
      const time = interaction.options.getString('time');
      const message = interaction.options.getString('message');

      const match = time.match(/^(\d+)(s|m|h|d)$/);
      if (!match) {
        return interaction.reply({ content: '❌ Ugyldigt tidsformat. Brug f.eks. 10m, 1h, 1d', flags: 64 });
      }

      const amount = parseInt(match[1]);
      const unit = match[2];
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      const ms = amount * multipliers[unit];

      if (ms > 7 * 86400000) {
        return interaction.reply({ content: '❌ Max reminder tid er 7 dage.', flags: 64 });
      }

      await interaction.reply(`✅ Jeg minder dig om "${message}" om ${time}!\n⚠️ *(Påmindelsen forsvinder ved bot-genstart)*`);

      setTimeout(async () => {
        try {
          await interaction.user.send(`⏰ **Påmindelse:** ${message}`);
        } catch {
          await interaction.channel.send(`⏰ <@${interaction.user.id}> **Påmindelse:** ${message}`);
        }
      }, ms);
    },

    // ==================== FUN ====================

    '8ball': async (interaction) => {
      const question = interaction.options.getString('question');
      const responses = [
        'Ja, helt sikkert!', 'Uden tvivl.', 'Ja.', 'Sandsynligvis.',
        'Måske...', 'Spørg igen senere.', 'Kan ikke svare nu.',
        'Nej.', 'Tvivlsomt.', 'Mit svar er nej.', 'Udsigterne er dårlige.'
      ];
      const answer = responses[Math.floor(Math.random() * responses.length)];

      const embed = new EmbedBuilder()
        .setColor('#800080')
        .setTitle('🎱 Magic 8-Ball')
        .addFields(
          { name: 'Spørgsmål', value: question },
          { name: 'Svar', value: answer }
        );

      await interaction.reply({ embeds: [embed] });
    },

    coinflip: async (interaction) => {
      const result = Math.random() < 0.5 ? 'Plat' : 'Krone';
      await interaction.reply(`🪙 Mønten landede på: **${result}**!`);
    },

    dice: async (interaction) => {
      const sides = interaction.options.getInteger('sides') || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      await interaction.reply(`🎲 Du rullede en **${result}** (d${sides})`);
    },

    rps: async (interaction) => {
      const choices = ['sten', 'saks', 'papir'];
      const emojis = { sten: '🪨', saks: '✂️', papir: '📄' };
      const userChoice = interaction.options.getString('choice');
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      let result;
      if (userChoice === botChoice) {
        result = "Uafgjort! 🤝";
      } else if (
        (userChoice === 'sten' && botChoice === 'saks') ||
        (userChoice === 'saks' && botChoice === 'papir') ||
        (userChoice === 'papir' && botChoice === 'sten')
      ) {
        result = "Du vandt! 🎉";
      } else {
        result = "Du tabte! 😢";
      }

      await interaction.reply(`${emojis[userChoice]} vs ${emojis[botChoice]}\n${result}`);
    },

    joke: async (interaction) => {
      const jokes = [
        "Hvorfor kan skeletter ikke slås? De har ikke nogen til at bakke sig op!",
        "Hvad kalder man en kat der spiser en citron? En sur kat!",
        "Hvorfor gik tomatten rød? Fordi den så salatdressingen!",
        "Hvad siger en nul til en otte? Flot bælte!",
        "Hvorfor tog cirklen på ferie? Den havde brug for at slappe af!"
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      await interaction.reply(`😂 ${joke}`);
    },

    ship: async (interaction) => {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      const percentage = Math.floor(Math.random() * 101);

      let emoji, message;
      if (percentage < 20) { emoji = '💔'; message = 'Ikke et godt match...'; }
      else if (percentage < 50) { emoji = '💛'; message = 'Der er potentiale!'; }
      else if (percentage < 80) { emoji = '💖'; message = 'Godt match!'; }
      else { emoji = '💘'; message = 'PERFEKT MATCH!'; }

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(`${emoji} Ship: ${user1.username} + ${user2.username}`)
        .setDescription(`**${percentage}%** kompatibel\n${message}`)
        .setThumbnail(user1.displayAvatarURL())
        .setImage(user2.displayAvatarURL());

      await interaction.reply({ embeds: [embed] });
    },

    rate: async (interaction) => {
      const thing = interaction.options.getString('thing');
      const rating = Math.floor(Math.random() * 11);
      const stars = '⭐'.repeat(Math.ceil(rating / 2)) + '☆'.repeat(5 - Math.ceil(rating / 2));

      await interaction.reply(`📊 Jeg giver **${thing}** en ${rating}/10\n${stars}`);
    },

    meme: async (interaction) => {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

      try {
        const response = await fetch('https://meme-api.com/gimme');
        const data = await response.json();

        const embed = new EmbedBuilder()
          .setColor('#FF4500')
          .setTitle(data.title)
          .setImage(data.url)
          .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` });

        await interaction.editReply({ embeds: [embed] });
      } catch {
        await interaction.editReply('❌ Kunne ikke hente meme.');
      }
    },

    // ==================== TEBEX ====================

    'tebex-verify': async (interaction) => {
      const txnId = interaction.options.getString('transaction_id');
      if (!txnId) {
        return interaction.reply({ content: '❌ Du skal angive et transaktions-ID.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      try {
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', interaction.guild.id)
          .single();

        if (!guild) return interaction.editReply('❌ Serveren er ikke registreret.');

        const { data: tebexSettings } = await supabase
          .from('tebex_settings')
          .select('enabled, tebex_secret_encrypted')
          .eq('guild_id', guild.id)
          .maybeSingle();

        if (!tebexSettings || !tebexSettings.enabled || !tebexSettings.tebex_secret_encrypted) {
          return interaction.editReply('❌ Tebex er ikke konfigureret for denne server.');
        }

        const tebexRes = await fetch(`https://plugin.tebex.io/payments/${encodeURIComponent(txnId)}`, {
          headers: { 'X-Tebex-Secret': tebexSettings.tebex_secret_encrypted },
        });

        if (!tebexRes.ok) {
          if (tebexRes.status === 404) return interaction.editReply('❌ Transaktions-ID blev ikke fundet.');
          return interaction.editReply(`❌ Tebex API fejl (${tebexRes.status}).`);
        }

        const payment = await tebexRes.json();
        const player = payment.player || {};
        const packages = payment.packages || [];
        const packageNames = packages.map(p => p.name || `#${p.id}`).join(', ') || 'Ingen pakker';

        const tebexPlayerName = player.name || player.username || 'Ukendt';
        const playerIdentifiers = [player.name, player.username, player.uuid, player.id].filter(Boolean).map(v => String(v).toLowerCase());
        const discordIdentifiers = [interaction.user.id, interaction.user.username.toLowerCase(), interaction.user.tag?.toLowerCase()].filter(Boolean);
        const isMatch = discordIdentifiers.some(did => playerIdentifiers.some(pid => pid.includes(did) || did.includes(pid)));

        const embed = new EmbedBuilder()
          .setColor(isMatch ? '#00FF00' : '#FF9900')
          .setTitle(isMatch ? '✅ Tebex Verificeret' : '⚠️ Tebex Verifikation')
          .addFields(
            { name: '🧾 Transaktions-ID', value: `\`${payment.txn_id || payment.id || txnId}\``, inline: true },
            { name: '💰 Beløb', value: `${payment.amount || '?'} ${payment.currency || ''}`, inline: true },
            { name: '📦 Status', value: `${payment.status || 'Ukendt'}`, inline: true },
            { name: '👤 Tebex Spiller', value: tebexPlayerName, inline: true },
            { name: '🎮 Discord Bruger', value: `${interaction.user.tag}`, inline: true },
            { name: '🔗 Match', value: isMatch ? '✅ Matcher!' : '⚠️ Kan ikke bekræfte automatisk', inline: true },
            { name: '📦 Pakker', value: packageNames },
          )
          .setTimestamp();

        if (payment.date) {
          embed.addFields({ name: '📅 Købsdato', value: new Date(payment.date).toLocaleString('da-DK'), inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Tebex verify fejl:', error);
        await interaction.editReply('❌ Der skete en fejl under verificeringen.');
      }
    },

    // ==================== ECONOMY ====================

    daily: async (interaction) => {
      await interaction.deferReply();
      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: settings } = await supabase.from('economy_settings').select('*').eq('guild_id', guild.id).maybeSingle();
        const dailyAmount = settings?.daily_amount || 100;
        const cooldownHours = settings?.daily_cooldown_hours || 24;
        const currencyName = settings?.currency_name || 'coins';
        const currencySymbol = settings?.currency_symbol || '🪙';

        // Get or create account
        let { data: account } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();

        if (!account) {
          const { data: newAccount } = await supabase.from('economy_accounts').insert({
            guild_id: guild.id,
            user_id: interaction.user.id,
            discord_username: interaction.user.tag,
            wallet: settings?.starting_balance || 0,
          }).select().single();
          account = newAccount;
        }

        // Check cooldown
        if (account.last_daily_at) {
          const lastDaily = new Date(account.last_daily_at);
          const nextDaily = new Date(lastDaily.getTime() + cooldownHours * 3600000);
          if (new Date() < nextDaily) {
            const remaining = nextDaily - new Date();
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            return interaction.editReply(`⏰ Du kan hente din daglige belønning igen om **${hours}t ${minutes}m**.`);
          }
        }

        await supabase.from('economy_accounts').update({
          wallet: (account.wallet || 0) + dailyAmount,
          total_earned: (account.total_earned || 0) + dailyAmount,
          last_daily_at: new Date().toISOString(),
          discord_username: interaction.user.tag,
        }).eq('id', account.id);

        await supabase.from('economy_transactions').insert({
          guild_id: guild.id,
          to_user_id: interaction.user.id,
          amount: dailyAmount,
          transaction_type: 'daily',
          description: 'Daglig belønning',
        });

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle(`${currencySymbol} Daglig Belønning`)
          .setDescription(`Du har modtaget **${dailyAmount} ${currencyName}**!`)
          .addFields({ name: 'Ny Balance', value: `${currencySymbol} ${(account.wallet || 0) + dailyAmount}`, inline: true });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Daily fejl:', error);
        await interaction.editReply('❌ Kunne ikke hente daglig belønning.');
      }
    },

    work: async (interaction) => {
      await interaction.deferReply();
      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: settings } = await supabase.from('economy_settings').select('*').eq('guild_id', guild.id).maybeSingle();
        const workMin = settings?.work_min || 10;
        const workMax = settings?.work_max || 50;
        const cooldownMinutes = settings?.work_cooldown_minutes || 30;
        const currencyName = settings?.currency_name || 'coins';
        const currencySymbol = settings?.currency_symbol || '🪙';

        let { data: account } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();

        if (!account) {
          const { data: newAccount } = await supabase.from('economy_accounts').insert({
            guild_id: guild.id, user_id: interaction.user.id, discord_username: interaction.user.tag, wallet: settings?.starting_balance || 0,
          }).select().single();
          account = newAccount;
        }

        if (account.last_work_at) {
          const lastWork = new Date(account.last_work_at);
          const nextWork = new Date(lastWork.getTime() + cooldownMinutes * 60000);
          if (new Date() < nextWork) {
            const remaining = nextWork - new Date();
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return interaction.editReply(`⏰ Du kan arbejde igen om **${minutes}m ${seconds}s**.`);
          }
        }

        const earned = Math.floor(Math.random() * (workMax - workMin + 1)) + workMin;
        const jobs = ['programmør', 'kok', 'lærer', 'læge', 'gartner', 'mekaniker', 'kunstner', 'musiker', 'pilot', 'arkitekt'];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        await supabase.from('economy_accounts').update({
          wallet: (account.wallet || 0) + earned,
          total_earned: (account.total_earned || 0) + earned,
          last_work_at: new Date().toISOString(),
          discord_username: interaction.user.tag,
        }).eq('id', account.id);

        await supabase.from('economy_transactions').insert({
          guild_id: guild.id, to_user_id: interaction.user.id, amount: earned, transaction_type: 'work', description: `Arbejdede som ${job}`,
        });

        await interaction.editReply(`💼 Du arbejdede som **${job}** og tjente **${currencySymbol} ${earned} ${currencyName}**!`);
      } catch (error) {
        console.error('[Bot] Work fejl:', error);
        await interaction.editReply('❌ Kunne ikke udføre arbejde.');
      }
    },

    balance: async (interaction) => {
      await interaction.deferReply();
      try {
        const user = interaction.options.getUser('user') || interaction.user;
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: settings } = await supabase.from('economy_settings').select('currency_name, currency_symbol').eq('guild_id', guild.id).maybeSingle();
        const currencyName = settings?.currency_name || 'coins';
        const currencySymbol = settings?.currency_symbol || '🪙';

        const { data: account } = await supabase.from('economy_accounts').select('wallet, bank, total_earned').eq('guild_id', guild.id).eq('user_id', user.id).maybeSingle();

        const wallet = account?.wallet || 0;
        const bank = account?.bank || 0;

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`${currencySymbol} Balance - ${user.tag}`)
          .addFields(
            { name: '💰 Wallet', value: `${currencySymbol} ${wallet}`, inline: true },
            { name: '🏦 Bank', value: `${currencySymbol} ${bank}`, inline: true },
            { name: '📊 Total', value: `${currencySymbol} ${wallet + bank}`, inline: true },
          )
          .setThumbnail(user.displayAvatarURL());

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Balance fejl:', error);
        await interaction.editReply('❌ Kunne ikke hente balance.');
      }
    },

    pay: async (interaction) => {
      await interaction.deferReply();
      try {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (target.id === interaction.user.id) return interaction.editReply('❌ Du kan ikke betale dig selv.');
        if (amount <= 0) return interaction.editReply('❌ Beløbet skal være positivt.');

        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: senderAccount } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();
        if (!senderAccount || (senderAccount.wallet || 0) < amount) return interaction.editReply('❌ Du har ikke nok penge i din wallet.');

        let { data: receiverAccount } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', target.id).maybeSingle();
        if (!receiverAccount) {
          const { data: newAccount } = await supabase.from('economy_accounts').insert({ guild_id: guild.id, user_id: target.id, discord_username: target.tag, wallet: 0 }).select().single();
          receiverAccount = newAccount;
        }

        await supabase.from('economy_accounts').update({ wallet: senderAccount.wallet - amount }).eq('id', senderAccount.id);
        await supabase.from('economy_accounts').update({ wallet: (receiverAccount.wallet || 0) + amount }).eq('id', receiverAccount.id);
        await supabase.from('economy_transactions').insert({ guild_id: guild.id, to_user_id: target.id, from_user_id: interaction.user.id, amount, transaction_type: 'transfer', description: `Betaling fra ${interaction.user.tag}` });

        await interaction.editReply(`✅ Du betalte **${amount}** til **${target.tag}**.`);
      } catch (error) {
        console.error('[Bot] Pay fejl:', error);
        await interaction.editReply('❌ Kunne ikke gennemføre betalingen.');
      }
    },

    deposit: async (interaction) => {
      await interaction.deferReply();
      try {
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0) return interaction.editReply('❌ Beløbet skal være positivt.');

        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: account } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();
        if (!account || (account.wallet || 0) < amount) return interaction.editReply('❌ Du har ikke nok penge i din wallet.');

        await supabase.from('economy_accounts').update({ wallet: account.wallet - amount, bank: (account.bank || 0) + amount }).eq('id', account.id);
        await interaction.editReply(`🏦 Du indsatte **${amount}** i banken.`);
      } catch (error) {
        await interaction.editReply('❌ Kunne ikke indsætte penge.');
      }
    },

    withdraw: async (interaction) => {
      await interaction.deferReply();
      try {
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0) return interaction.editReply('❌ Beløbet skal være positivt.');

        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: account } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();
        if (!account || (account.bank || 0) < amount) return interaction.editReply('❌ Du har ikke nok penge i banken.');

        await supabase.from('economy_accounts').update({ wallet: (account.wallet || 0) + amount, bank: account.bank - amount }).eq('id', account.id);
        await interaction.editReply(`💰 Du hævede **${amount}** fra banken.`);
      } catch (error) {
        await interaction.editReply('❌ Kunne ikke hæve penge.');
      }
    },

    rob: async (interaction) => {
      await interaction.deferReply();
      try {
        const target = interaction.options.getUser('user');
        if (target.id === interaction.user.id) return interaction.editReply('❌ Du kan ikke røve dig selv.');

        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: targetAccount } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', target.id).maybeSingle();
        if (!targetAccount || (targetAccount.wallet || 0) < 10) return interaction.editReply('❌ Denne bruger har ikke nok penge at røve.');

        let { data: robberAccount } = await supabase.from('economy_accounts').select('*').eq('guild_id', guild.id).eq('user_id', interaction.user.id).maybeSingle();
        if (!robberAccount) {
          const { data: newAccount } = await supabase.from('economy_accounts').insert({ guild_id: guild.id, user_id: interaction.user.id, discord_username: interaction.user.tag, wallet: 0 }).select().single();
          robberAccount = newAccount;
        }

        const success = Math.random() < 0.4; // 40% chance
        if (success) {
          const stolen = Math.floor(Math.random() * Math.min(targetAccount.wallet, 200)) + 1;
          await supabase.from('economy_accounts').update({ wallet: targetAccount.wallet - stolen }).eq('id', targetAccount.id);
          await supabase.from('economy_accounts').update({ wallet: (robberAccount.wallet || 0) + stolen }).eq('id', robberAccount.id);
          await supabase.from('economy_transactions').insert({ guild_id: guild.id, to_user_id: interaction.user.id, from_user_id: target.id, amount: stolen, transaction_type: 'rob', description: `Røvede ${target.tag}` });
          await interaction.editReply(`🦹 Du røvede **${stolen}** fra **${target.tag}**!`);
        } else {
          const fine = Math.floor(Math.random() * 50) + 10;
          const actualFine = Math.min(fine, robberAccount.wallet || 0);
          if (actualFine > 0) {
            await supabase.from('economy_accounts').update({ wallet: (robberAccount.wallet || 0) - actualFine }).eq('id', robberAccount.id);
          }
          await interaction.editReply(`👮 Du blev fanget! Du mistede **${actualFine}** i bøde.`);
        }
      } catch (error) {
        console.error('[Bot] Rob fejl:', error);
        await interaction.editReply('❌ Kunne ikke udføre røveriet.');
      }
    },

    richest: async (interaction) => {
      await interaction.deferReply();
      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: settings } = await supabase.from('economy_settings').select('currency_symbol').eq('guild_id', guild.id).maybeSingle();
        const currencySymbol = settings?.currency_symbol || '🪙';

        const { data: accounts } = await supabase.from('economy_accounts').select('user_id, discord_username, wallet, bank').eq('guild_id', guild.id).order('total_earned', { ascending: false }).limit(10);

        if (!accounts || accounts.length === 0) return interaction.editReply('📊 Ingen økonomi data endnu.');

        const medals = ['🥇', '🥈', '🥉'];
        const description = accounts.map((a, i) => {
          const medal = medals[i] || `**${i + 1}.**`;
          const total = (a.wallet || 0) + (a.bank || 0);
          return `${medal} ${a.discord_username || 'Ukendt'} — ${currencySymbol} ${total}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('💰 Rigeste Brugere')
          .setDescription(description)
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('[Bot] Richest fejl:', error);
        await interaction.editReply('❌ Kunne ikke hente leaderboard.');
      }
    },

    // ==================== GIVEAWAY ====================

    giveaway: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply();

      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        if (subcommand === 'start') {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.editReply('❌ Du har ikke tilladelse til at starte giveaways.');
          }

          const prize = interaction.options.getString('prize');
          const durationStr = interaction.options.getString('duration');
          const winnersCount = interaction.options.getInteger('winners') || 1;
          const description = interaction.options.getString('description') || '';

          const match = durationStr.match(/^(\d+)(m|h|d)$/);
          if (!match) return interaction.editReply('❌ Ugyldigt tidsformat. Brug f.eks. 1h, 1d.');

          const amount = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = { m: 60000, h: 3600000, d: 86400000 };
          const durationMs = amount * multipliers[unit];
          const endsAt = new Date(Date.now() + durationMs);

          await callGiveawayHandler({
            action: 'create',
            giveawayData: {
              guild_id: guild.id,
              channel_id: interaction.channel.id,
              prize,
              description: description || null,
              winners_count: winnersCount,
              ends_at: endsAt.toISOString(),
              host_user_id: interaction.user.id,
              host_username: interaction.user.tag,
            },
          });

          await interaction.editReply(`✅ Giveaway startet! Slutter <t:${Math.floor(endsAt.getTime() / 1000)}:R>`);
        } else if (subcommand === 'end') {
          const messageId = interaction.options.getString('message_id');
          const { data: giveaway } = await supabase
            .from('giveaways')
            .select('id, prize')
            .eq('guild_id', guild.id)
            .eq('message_id', messageId)
            .eq('ended', false)
            .maybeSingle();

          if (!giveaway) return interaction.editReply('❌ Giveaway ikke fundet.');

          const result = await callGiveawayHandler({
            action: 'end',
            guildId: guild.id,
            giveawayId: giveaway.id,
          });

          if (result?.winners?.length > 0) {
            const winnerMentions = result.winners.map((winnerId) => `<@${winnerId}>`).join(', ');
            await interaction.editReply(`🎉 Vindere af **${giveaway.prize}**: ${winnerMentions}`);
          } else {
            await interaction.editReply('❌ Ingen deltagere i giveawayen.');
          }
        } else if (subcommand === 'reroll') {
          const messageId = interaction.options.getString('message_id');
          const { data: giveaway } = await supabase
            .from('giveaways')
            .select('id, prize')
            .eq('guild_id', guild.id)
            .eq('message_id', messageId)
            .eq('ended', true)
            .maybeSingle();

          if (!giveaway) return interaction.editReply('❌ Afsluttet giveaway ikke fundet.');

          const result = await callGiveawayHandler({
            action: 'reroll',
            guildId: guild.id,
            giveawayId: giveaway.id,
          });

          await interaction.editReply(`🎉 Ny vinder af **${giveaway.prize}**: <@${result.newWinner}>`);
        }
      } catch (error) {
        console.error('[Bot] Giveaway fejl:', error);
        await interaction.editReply(`❌ ${error.message || 'Der skete en fejl.'}`);
      }
    },

    // ==================== SUGGESTION ====================

    suggest: async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      try {
        const suggestion = interaction.options.getString('suggestion');
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        const { data: settings } = await supabase.from('suggestion_settings').select('channel_id, enabled').eq('guild_id', guild.id).maybeSingle();
        if (!settings || !settings.enabled || !settings.channel_id) return interaction.editReply('❌ Forslag er ikke konfigureret for denne server.');

        const channel = await interaction.guild.channels.fetch(settings.channel_id).catch(() => null);
        if (!channel) return interaction.editReply('❌ Forslagskanalen blev ikke fundet.');

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('💡 Nyt Forslag')
          .setDescription(suggestion)
          .setFooter({ text: `Foreslået af ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        const msg = await channel.send({ embeds: [embed] });
        await msg.react('👍');
        await msg.react('👎');

        await interaction.editReply('✅ Dit forslag er blevet sendt!');
      } catch (error) {
        console.error('[Bot] Suggest fejl:', error);
        await interaction.editReply('❌ Kunne ikke sende forslaget.');
      }
    },

    // ==================== AFK ====================

    afk: async (interaction) => {
      try {
        const message = interaction.options.getString('message') || 'AFK';
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.reply({ content: '❌ Server ikke fundet.', flags: 64 });

        await supabase.from('afk_status').upsert({
          guild_id: guild.id,
          user_discord_id: interaction.user.id,
          user_name: interaction.user.tag,
          message,
          set_at: new Date().toISOString(),
        }, { onConflict: 'guild_id,user_discord_id' });

        await interaction.reply(`💤 Du er nu AFK: **${message}**`);
      } catch (error) {
        console.error('[Bot] AFK fejl:', error);
        await interaction.reply({ content: '❌ Kunne ikke sætte AFK status.', flags: 64 });
      }
    },

    // ==================== MODERATION EXTRA ====================

    clearwarns: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      await interaction.deferReply();

      try {
        const { data: guild } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
        if (!guild) return interaction.editReply('❌ Server ikke fundet.');

        await supabase.from('moderation_logs').delete().eq('guild_id', guild.id).eq('target_id', user.id).eq('action_type', 'warn');

        // Also clear warnings in the warning_handler system
        const warnHandler = handlerInstances.get(`warning_${client._clientLabel || 'default'}`);
        if (warnHandler) {
          await warnHandler.clearWarnings(guild.id, user.id, interaction.user.id);
        }

        await interaction.editReply(`✅ Alle advarsler for **${user.tag}** er blevet slettet.`);
      } catch (error) {
        console.error('[Bot] Clearwarns fejl:', error);
        await interaction.editReply('❌ Kunne ikke slette advarsler.');
      }
    },

    timeout: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse.', flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const duration = interaction.options.getInteger('duration') || 10;
      const reason = interaction.options.getString('reason') || 'Ingen årsag';

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(duration * 60 * 1000, reason);
        await logModerationAction(interaction.guild.id, 'timeout', interaction.user, user, reason, duration * 60);

        await interaction.reply(`⏰ **${user.tag}** har fået timeout i **${duration} minutter**.\nÅrsag: ${reason}`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke give timeout.', flags: 64 });
      }
    },

    untimeout: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse.', flags: 64 });
      }

      const user = interaction.options.getUser('user');

      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(null);
        await logModerationAction(interaction.guild.id, 'untimeout', interaction.user, user, 'Timeout fjernet');
        await interaction.reply(`✅ Timeout fjernet for **${user.tag}**.`);
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke fjerne timeout.', flags: 64 });
      }
    },

    // ==================== GLOBAL BAN REPORT ====================

    'globalban-report': async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      try {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const severity = interaction.options.getString('severity') || 'other';
        const evidence = interaction.options.getString('evidence') || null;

        if (targetUser.id === interaction.user.id) {
          return interaction.editReply('❌ Du kan ikke rapportere dig selv.');
        }
        if (targetUser.bot) {
          return interaction.editReply('❌ Du kan ikke rapportere en bot.');
        }

        const evidenceUrls = evidence ? evidence.split(/[\s,]+/).filter(Boolean) : [];

        const { data, error } = await supabase.from('global_ban_reports').insert({
          reporter_discord_id: interaction.user.id,
          reporter_discord_name: interaction.user.tag,
          target_discord_id: targetUser.id,
          target_discord_name: targetUser.tag,
          reason,
          severity,
          evidence_urls: evidenceUrls,
        }).select().single();

        if (error) {
          console.error('[Bot] GlobalBan report DB error:', error);
          throw error;
        }

        console.log(`[Bot] GlobalBan report created: ${data.id} by ${interaction.user.tag}`);
        await interaction.editReply('✅ Din rapport er blevet indsendt og vil blive gennemgået af en administrator. Tak!');
      } catch (error) {
        console.error('[Bot] GlobalBan report fejl:', error);
        await interaction.editReply('❌ Kunne ikke indsende rapporten. Prøv igen senere.');
      }
    },

    nuke: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Du har ikke tilladelse.', flags: 64 });
      }

      try {
        const channel = interaction.channel;
        const position = channel.position;
        const newChannel = await channel.clone();
        await newChannel.setPosition(position);
        await channel.delete('Nuke command');
        await newChannel.send('💥 Kanal nuked!');
      } catch (error) {
        await interaction.reply({ content: '❌ Kunne ikke nuke kanalen.', flags: 64 });
      }
    },

    // ==================== TEST ALL COMMANDS ====================
    testall: async (interaction) => {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Kun administratorer kan bruge denne kommando.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      const verbose = interaction.options.getBoolean('verbose') ?? false;
      const guildId = interaction.guild.id;

      // 1. Collect all registered slash handler names
      const allHandlerNames = Object.keys(createSlashHandlers(client));

      // 2. Check which commands are enabled/disabled in DB
      let commandStates = {};
      try {
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', guildId)
          .single();

        if (guild) {
          const { data: commands } = await supabase
            .from('guild_commands')
            .select('command_name, enabled')
            .eq('guild_id', guild.id);

          if (commands) {
            for (const cmd of commands) {
              commandStates[cmd.command_name] = cmd.enabled;
            }
          }
        }
      } catch (e) {
        console.error('[testall] DB error:', e);
      }

      // 3. Check which modules are enabled
      let moduleStates = {};
      try {
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', guildId)
          .single();

        if (guild) {
          const { data: modules } = await supabase
            .from('guild_modules')
            .select('module_type, enabled')
            .eq('guild_id', guild.id);

          if (modules) {
            for (const mod of modules) {
              moduleStates[mod.module_type] = mod.enabled;
            }
          }
        }
      } catch (e) {
        console.error('[testall] Module DB error:', e);
      }

      // 4. Check handler instances
      const handlerKeys = [...handlerInstances.keys()].filter(k => k.includes(client._clientLabel || 'default'));

      // 5. Build results
      const results = {
        passed: [],
        disabled: [],
        noHandler: [],
        errors: [],
      };

      for (const cmdName of allHandlerNames) {
        const isEnabled = commandStates[cmdName] !== false; // default true
        const hasHandler = !!createSlashHandlers(client)[cmdName];

        if (!hasHandler) {
          results.noHandler.push(cmdName);
        } else if (!isEnabled) {
          results.disabled.push(cmdName);
        } else {
          results.passed.push(cmdName);
        }
      }

      // 6. Check registered Discord commands vs local handlers
      let registeredCommands = [];
      try {
        const appCommands = await interaction.guild.commands.fetch();
        registeredCommands = appCommands.map(c => c.name);
        
        // Also check global commands
        const globalCommands = await client.application.commands.fetch();
        for (const [, cmd] of globalCommands) {
          if (!registeredCommands.includes(cmd.name)) {
            registeredCommands.push(cmd.name);
          }
        }
      } catch (e) {
        console.error('[testall] Could not fetch registered commands:', e);
      }

      // Find commands registered in Discord but no handler locally
      const orphanedCommands = registeredCommands.filter(name => !allHandlerNames.includes(name) && name !== 'testall');
      // Find handlers that have no matching Discord registration
      const unregisteredHandlers = allHandlerNames.filter(name => !registeredCommands.includes(name));

      // 7. Build embed
      const totalCommands = allHandlerNames.length;
      const passRate = Math.round((results.passed.length / totalCommands) * 100);

      const statusEmoji = passRate === 100 ? '🟢' : passRate >= 75 ? '🟡' : '🔴';

      const embed = new EmbedBuilder()
        .setColor(passRate === 100 ? '#00FF00' : passRate >= 75 ? '#FFAA00' : '#FF0000')
        .setTitle(`${statusEmoji} Bot Command Test — ${passRate}% OK`)
        .setDescription(`Testet **${totalCommands}** kommandoer for **${interaction.guild.name}**`)
        .addFields(
          { 
            name: `✅ Aktive (${results.passed.length})`, 
            value: verbose ? (results.passed.join(', ') || 'Ingen') : `${results.passed.length} kommandoer klar`, 
            inline: false 
          },
          { 
            name: `⏸️ Deaktiverede (${results.disabled.length})`, 
            value: results.disabled.length > 0 ? results.disabled.join(', ') : 'Ingen', 
            inline: false 
          },
          {
            name: `⚠️ Mangler handler (${results.noHandler.length})`,
            value: results.noHandler.length > 0 ? results.noHandler.join(', ') : 'Ingen',
            inline: false
          },
        )
        .setTimestamp()
        .setFooter({ text: `Handlers aktive: ${handlerKeys.length}` });

      if (orphanedCommands.length > 0) {
        embed.addFields({
          name: `🔗 Registreret i Discord men ingen handler (${orphanedCommands.length})`,
          value: orphanedCommands.join(', '),
          inline: false,
        });
      }

      if (unregisteredHandlers.length > 0) {
        embed.addFields({
          name: `📝 Handler findes men ikke registreret i Discord (${unregisteredHandlers.length})`,
          value: unregisteredHandlers.join(', '),
          inline: false,
        });
      }

      // Module status
      const moduleNames = Object.keys(moduleStates);
      if (moduleNames.length > 0) {
        const moduleLines = moduleNames.map(m => {
          const enabled = moduleStates[m];
          return `${enabled ? '✅' : '❌'} ${m}`;
        });
        embed.addFields({
          name: '📦 Modul Status',
          value: moduleLines.join('\n') || 'Ingen moduler',
          inline: false,
        });
      }

      // Heartbeat/uptime info
      embed.addFields({
        name: '🏓 Bot Info',
        value: `Ping: ${client.ws.ping}ms\nGuilds: ${client.guilds.cache.size}\nUptime: ${formatDuration(Math.floor(client.uptime / 1000))}`,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });
    },

    // ==================== FIVEM ====================
    fivem: async (interaction) => {
      await interaction.deferReply({ flags: 64 });

      try {
        const guildDiscordId = interaction.guild.id;
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        // Get internal guild ID
        const { data: guild, error: guildError } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', guildDiscordId)
          .single();

        if (guildError || !guild) {
          return interaction.editReply('❌ Guild not configured.');
        }

        const internalGuildId = guild.id;

        // Parse command structure. Supports both:
        //   /fivem <subcommand> [options]                 (current registration)
        //   /fivem <group> <subcommand> [options]         (legacy)
        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);

        if (!subcommand) {
          return interaction.editReply('❌ Invalid command format.');
        }

        // Build command data from all options
        const commandData = {
          moderatorDiscordId: userId,
          moderatorName: userName,
          group: group || subcommand,
          subcommand,
        };

        // Extract all options for the (sub)command
        const topData = interaction.options.data?.[0];
        const rawOptions = group
          ? (topData?.options?.[0]?.options || [])
          : (topData?.options || []);
        for (const opt of rawOptions) {
          commandData[opt.name] = opt.value;
        }

        // Determine effective command name:
        // - With group: "<group>_<subcommand>"
        // - Without group: if an "action" option exists, use it (e.g. kick, ban, restart, announce);
        //   otherwise use the subcommand name (status, players)
        let effectiveCommand;
        if (group && group !== subcommand) {
          effectiveCommand = `${group}_${subcommand}`;
        } else if (commandData.action) {
          effectiveCommand = String(commandData.action);
        } else {
          effectiveCommand = subcommand;
        }

        const directInfoCommand = ['players', 'status'].includes(subcommand)
          && (!group || group === subcommand);

        // Map 'target' / 'id' option to 'targetPlayerId'
        if (commandData.target && !commandData.targetPlayerId) {
          commandData.targetPlayerId = commandData.target;
        }
        if (commandData.id) {
          commandData.targetPlayerId = commandData.id;
          delete commandData.id;
        }
        // Map 'message' to 'reason' for announce-style commands when no reason set
        if (!commandData.reason && commandData.message) {
          commandData.reason = commandData.message;
        }

        console.log(`[FiveM] Command: /fivem ${group ? group + ' ' : ''}${subcommand} -> ${effectiveCommand}`, JSON.stringify(commandData));

        // Short-circuit: `players` and `status` don't need to round-trip via the queue —
        // read live data straight from the DB tables the Lua resource keeps updated.
        if (directInfoCommand && subcommand === 'players') {
          console.log('[FiveM] Direct Discord response: players');
          const { data: players, error: playersErr } = await supabase
            .from('fivem_online_players')
            .select('player_id, character_name, discord_username, ping')
            .eq('guild_id', internalGuildId)
            .order('player_id', { ascending: true });

          if (playersErr) {
            return interaction.editReply(`❌ Kunne ikke hente spillerliste: ${playersErr.message}`);
          }

          const count = players?.length || 0;
          if (count === 0) {
            return interaction.editReply('👥 **Spillere online:** 0\n\n*Ingen spillere på serveren lige nu.*');
          }

          const lines = players.map(p => {
            const name = p.character_name || p.discord_username || `Player #${p.player_id}`;
            return `[${p.player_id}] ${name}${p.ping ? ` (${p.ping}ms)` : ''}`;
          });
          let body = lines.join('\n');
          if (body.length > 1800) body = body.slice(0, 1800) + '\n…';
          return interaction.editReply(`👥 **Spillere online:** ${count}\n\`\`\`\n${body}\n\`\`\``);
        }

        if (directInfoCommand && subcommand === 'status') {
          console.log('[FiveM] Direct Discord response: status');
          const { data: status } = await supabase
            .from('fivem_server_status')
            .select('is_online, player_count, max_players, uptime_seconds, server_name')
            .eq('guild_id', internalGuildId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!status) return interaction.editReply('❌ Ingen serverstatus tilgængelig endnu.');

          const online = status.is_online ? '🟢 Online' : '🔴 Offline';
          return interaction.editReply(
            `**${status.server_name || 'FiveM Server'}**\n` +
            `Status: ${online}\n` +
            `Spillere: ${status.player_count || 0}/${status.max_players || 64}\n` +
            `Uptime: ${formatDuration(status.uptime_seconds || 0)}`
          );
        }

        // Queue the command for FiveM server
        const { data: queuedRow, error: queueError } = await supabase.from('fivem_command_queue').insert({
          guild_id: internalGuildId,
          command_name: effectiveCommand,
          command_data: commandData,
          target_player_id: commandData.targetPlayerId || null,
          target_discord_id: null,
          target_name: null,
          moderator_discord_id: userId,
          moderator_name: userName,
          status: 'pending',
        }).select('id').single();

        if (queueError || !queuedRow?.id) {
          console.error('[FiveM] Queue error:', JSON.stringify(queueError));
          botLog(internalGuildId, 'error', 'fivem', `Failed to queue command ${effectiveCommand}: ${queueError?.message || JSON.stringify(queueError)}`, { error: queueError, commandData });
          return interaction.editReply(`❌ Failed to queue command: ${queueError?.message || 'Unknown error'}`);
        }

        // Log the action
        await supabase.from('fivem_action_logs').insert({
          guild_id: internalGuildId,
          action_type: effectiveCommand,
          target_discord_id: commandData.targetDiscordId || null,
          target_name: commandData.targetName || null,
          moderator_discord_id: userId,
          moderator_name: userName,
          reason: commandData.reason || null,
          metadata: commandData,
        });

        const cmdLabel = `/fivem ${group ? group + ' ' : ''}${subcommand}`;

        // Poll for execution result (max ~12s)
        let resultRow = null;
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 500));
          const { data: row } = await supabase
            .from('fivem_command_queue')
            .select('status, result')
            .eq('id', queuedRow.id)
            .single();
          if (row && row.status !== 'pending') {
            resultRow = row;
            break;
          }
        }

        if (!resultRow) {
          return interaction.editReply(`⏳ \`${cmdLabel}\` queued, men FiveM-serveren svarede ikke i tide.`);
        }

        if (resultRow.status === 'failed') {
          return interaction.editReply(`❌ \`${cmdLabel}\` fejlede: ${resultRow.result || 'Ukendt fejl'}`);
        }

        const rawResult = (resultRow.result || '').trim();
        let responseMessage;

        if (effectiveCommand === 'players') {
          // Result examples: "[1] Name, [2] Other" or "[1] Name\n[2] Other"
          const matches = rawResult.match(/\[\d+\]/g) || [];
          const count = matches.length;
          if (count === 0) {
            responseMessage = `👥 **Spillere online:** 0\n\n*Ingen spillere på serveren.*`;
          } else {
            responseMessage = `👥 **Spillere online:** ${count}\n\`\`\`\n${rawResult}\n\`\`\``;
          }
        } else {
          responseMessage = `✅ \`${cmdLabel}\` udført`;
          if (rawResult) responseMessage += `\n\`\`\`\n${rawResult}\n\`\`\``;
        }

        await interaction.editReply(responseMessage);
      } catch (error) {
        console.error('[FiveM] Command error:', error);
        const msg = interaction.deferred || interaction.replied
          ? interaction.editReply('❌ An error occurred executing the FiveM command.')
          : interaction.reply({ content: '❌ An error occurred.', flags: 64 });
        await msg.catch(() => {});
      }
    },
  };
}

// Music command adapter
async function handleMusicCommand(interaction, command, args) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

  if (musicCommands && musicCommands[command]) {
    await musicCommands[command](interaction);
  } else {
    await interaction.editReply('❌ Musik kommando ikke tilgængelig.');
  }
}

// ==================== HANDLER REGISTRATION ====================

/**
 * Helper to determine if a bot instance should handle events for a specific guild.
 * - Custom bot (guildId set): only handles events for its own Discord guild ID
 * - Default bot (guildId null): only handles events for guilds WITHOUT an active custom bot
 * 
 * This prevents duplicate processing when both default + custom bots are in the same guild.
 */
function hasCustomBotForDiscordGuild(discordGuildId) {
  for (const [, bot] of manager.bots) {
    if (bot?.client?.guilds?.cache?.has(discordGuildId)) {
      return true;
    }
  }

  return false;
}

function createGuildFilter(client, guildId) {
  return (eventGuildId) => {
    if (!eventGuildId) return false;
    
    // Custom bot: only handle events for its assigned guild
    if (guildId) {
      return client?.guilds?.cache?.has(eventGuildId) || false;
    }
    
    // Default bot: only handle guilds that DON'T have a custom bot
    return !hasCustomBotForDiscordGuild(eventGuildId);
  };
}

/**
 * Register all handlers for a client
 * This is called for EVERY bot instance (default + custom bots)
 */
manager.registerHandler((client, guildId) => {
  const clientLabel = guildId ? `custom:${guildId}` : 'default';
  const shouldHandleGuild = createGuildFilter(client, guildId);
  
  console.log(`[Bot] Registrerer handlers for ${clientLabel}...`);

  // Initialize music ONLY for default bot — Kazagumo uses a global instance
  // and the default bot's Lavalink connection serves all guilds
  if (initMusic && !guildId) {
    try {
      initMusic(client);
      console.log(`[Bot] ✅ Music initialiseret for ${clientLabel}`);
    } catch (e) {
      console.log(`[Bot] ⚠️ Music init fejlede for ${clientLabel}:`, e.message);
    }
  }

  // Setup feature handlers with guild filtering
  try {
    setupTicketHandler(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Ticket handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Ticket handler fejl:`, e.message);
  }

  try {
    setupWelcomeHandler(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Welcome handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Welcome handler fejl:`, e.message);
  }

  try {
    setupInviteTracker(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Invite tracker for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Invite tracker fejl:`, e.message);
  }

  try {
    setupReactionRoleHandler(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Reaction role handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Reaction role handler fejl:`, e.message);
  }

  try {
    setupAIChatHandler(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ AI Chat handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ AI Chat handler fejl:`, e.message);
  }

  try {
    setupApplicationHandler(client, { shouldHandleGuild, supabase });
    console.log(`[Bot] ✅ Application handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Application handler fejl:`, e.message);
  }

  try {
    initXPHandler(client, SUPABASE_URL, BOT_SECRET_KEY, { shouldHandleGuild });
    console.log(`[Bot] ✅ XP handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ XP handler fejl:`, e.message);
  }

  // Register log handlers (needs config object) - uses shouldLogGuild for compatibility
  try {
    registerLogHandlers(client, {
      supabaseUrl: SUPABASE_URL,
      botSecretKey: BOT_SECRET_KEY,
      shouldLogGuild: shouldHandleGuild
    });
    console.log(`[Bot] ✅ Log handlers for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Log handlers fejl:`, e.message);
  }

  // JTC handler
  try {
    jtcHandler.init(
      client,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      BOT_SECRET_KEY,
      { shouldHandleGuild }
    );
    console.log(`[Bot] ✅ JTC handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ JTC handler fejl:`, e.message);
  }

  // JTC button/modal handler (control panel interactions)
  try {
    jtcButtonHandler.init(
      client,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { shouldHandleGuild }
    );
    console.log(`[Bot] ✅ JTC button handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ JTC button handler fejl:`, e.message);
  }

  // Twitch checker
  try {
    startTwitchChecker(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Twitch checker for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Twitch checker fejl:`, e.message);
  }

  // TikTok checker
  try {
    startTikTokChecker(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ TikTok checker for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ TikTok checker fejl:`, e.message);
  }

  // YouTube checker
  try {
    startYouTubeChecker(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ YouTube checker for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ YouTube checker fejl:`, e.message);
  }

  // Starboard Handler - tracks popular messages
  try {
    setupStarboardHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Starboard handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Starboard handler fejl:`, e.message);
  }

  // Warning Handler - points-based warning system
  let warningHandler = null;
  try {
    warningHandler = new WarningHandler(client, supabase, { shouldHandleGuild });
    handlerInstances.set(`warning_${clientLabel}`, warningHandler);
    console.log(`[Bot] ✅ Warning handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Warning handler fejl:`, e.message);
  }

  // Analytics Handler - tracks activity for dashboard
  try {
    const analyticsHandler = new AnalyticsHandler(client, supabase, { shouldHandleGuild });
    analyticsHandler.init().catch(err => console.error(`[Bot] Analytics init error:`, err));
    handlerInstances.set(`analytics_${clientLabel}`, analyticsHandler);
    console.log(`[Bot] ✅ Analytics handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Analytics handler fejl:`, e.message);
  }

  // Scheduler Handler - scheduled messages
  try {
    setupSchedulerHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Scheduler handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Scheduler handler fejl:`, e.message);
  }

  // Modmail Handler - DM-to-channel system (uses edge function for DB operations)
  try {
    setupModmailHandler(client, SUPABASE_URL, BOT_SECRET_KEY, { shouldHandleGuild });
    console.log(`[Bot] ✅ Modmail handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Modmail handler fejl:`, e.message);
  }

  // Tebex Handler - webhook queue polling for notifications and role grants
  try {
    setupTebexHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Tebex handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Tebex handler fejl:`, e.message);
  }

  // Suggestion Handler - voting on suggestions
  try {
    setupSuggestionHandler(client, supabase, { shouldHandleGuild, isCustomBot: !!guildId });
    console.log(`[Bot] ✅ Suggestion handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Suggestion handler fejl:`, e.message);
  }

  // Verification Handler - anti-raid verification
  try {
    const verificationHandler = setupVerificationHandler(client, supabase, { shouldHandleGuild });
    if (verificationHandler) handlerInstances.set(`verification_${clientLabel}`, verificationHandler);
    console.log(`[Bot] ✅ Verification handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Verification handler fejl:`, e.message);
  }

  // Stats Handler - auto-updating voice channel names
  try {
    const statsHandler = setupStatsHandler(client, supabase, { shouldHandleGuild, isCustomBot: !!guildId });
    if (statsHandler) handlerInstances.set(`stats_${clientLabel}`, statsHandler);
    console.log(`[Bot] ✅ Stats handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Stats handler fejl:`, e.message);
  }

  // Global Ban Handler - listens for global bans via realtime
  try {
    const globalBanHandler = setupGlobalBanHandler(client, supabase, { shouldHandleGuild, isCustomBot: !!guildId });
    if (globalBanHandler) handlerInstances.set(`globalban_${clientLabel}`, globalBanHandler);
    console.log(`[Bot] ✅ Global Ban handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Global Ban handler fejl:`, e.message);
  }

  // Scheduled Action Handler - polls for pending moderation actions
  try {
    setupScheduledActionHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Scheduled Action handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Scheduled Action handler fejl:`, e.message);
  }

  // AFK Handler
  try {
    setupAfkHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ AFK handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ AFK handler fejl:`, e.message);
  }

  // Poll Handler
  try {
    setupPollHandler(client, supabase, { shouldHandleGuild, isCustomBot: !!guildId });
    console.log(`[Bot] ✅ Poll handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Poll handler fejl:`, e.message);
  }

  // Auto-Responder Handler
  try {
    setupAutoResponderHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Auto-Responder handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Auto-Responder handler fejl:`, e.message);
  }

  // Custom Command Handler
  try {
    setupCustomCommandHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Custom Command handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Custom Command handler fejl:`, e.message);
  }

  // Reminder Handler - sends reminders to Discord channels
  try {
    setupReminderHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Reminder handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Reminder handler fejl:`, e.message);
  }

  // Auto-Report Handler - triggers periodic reports to Discord
  try {
    setupAutoReportHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Auto-Report handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Auto-Report handler fejl:`, e.message);
  }

  // Automod Rule Handler - banned words, links, invites, mentions, caps
  try {
    setupAutomodRuleHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Automod Rule handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Automod Rule handler fejl:`, e.message);
  }

  // AI Auto-Mod Handler - AI-powered message analysis
  try {
    setupAIAutomodHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ AI AutoMod handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ AI AutoMod handler fejl:`, e.message);
  }

  // Dashboard Notification Handler - sends events to dashboard
  try {
    setupNotificationHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Notification handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Notification handler fejl:`, e.message);
  }

  // Webhook Dispatcher - sends events to configured webhooks
  try {
    setupWebhookDispatcher(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Webhook dispatcher for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Webhook dispatcher fejl:`, e.message);
  }

  // Raid Protection Handler
  try {
    setupRaidProtectionHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Raid Protection handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Raid Protection handler fejl:`, e.message);
  }

  // Quarantine Handler
  try {
    setupQuarantineHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Quarantine handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Quarantine handler fejl:`, e.message);
  }

  // Slowmode Scheduler
  try {
    setupSlowmodeScheduler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Slowmode Scheduler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Slowmode Scheduler fejl:`, e.message);
  }

  // Alt Account Detection
  try {
    setupAltDetectionHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Alt Detection handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Alt Detection handler fejl:`, e.message);
  }

  // Counting Handler
  try {
    setupCountingHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Counting handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Counting handler fejl:`, e.message);
  }

  // Confession Handler
  try {
    setupConfessionHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Confession handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Confession handler fejl:`, e.message);
  }

  // Birthday Handler
  try {
    setupBirthdayHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Birthday handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Birthday handler fejl:`, e.message);
  }

  // Music Quiz Handler
  try {
    setupMusicQuizHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Music Quiz handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Music Quiz handler fejl:`, e.message);
  }

  // Currency Shop Handler
  try {
    setupCurrencyShopHandler(client, supabase, { shouldHandleGuild });
    console.log(`[Bot] ✅ Currency Shop handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Currency Shop handler fejl:`, e.message);
  }

  // Giveaway Auto-End Checker
  try {
    startGiveawayAutoEnd(shouldHandleGuild);
    console.log(`[Bot] ✅ Giveaway auto-end checker for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Giveaway auto-end fejl:`, e.message);
  }

  try {
    startHeartbeat(client, { shouldHandleGuild });
    console.log(`[Bot] ✅ Heartbeat handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Heartbeat handler fejl:`, e.message);
  }

  // Create slash handlers for this client
  const slashHandlers = createSlashHandlers(client);

  // Register prefix command handler (mirrors all slash commands)
  try {
    setupPrefixHandler(client, slashHandlers, { shouldHandleGuild, isCommandEnabled });
    console.log(`[Bot] ✅ Prefix handler for ${clientLabel}`);
  } catch (e) {
    console.error(`[Bot] ❌ Prefix handler fejl:`, e.message);
  }

  // Register interaction handler for slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
    // Handle giveaway buttons (sync check first to avoid async overhead for non-buttons)
    if (interaction.isButton() && interaction.customId?.startsWith('giveaway_enter_')) {
      if (await handleGiveawayButton(interaction, shouldHandleGuild, Boolean(guildId))) return;
    }

    if (!interaction.isChatInputCommand()) return;

    // Only handle commands for guilds this bot instance is responsible for
    if (interaction.guild && !shouldHandleGuild(interaction.guild.id)) return;

    const commandName = interaction.commandName;

    // Check if command is enabled for this guild
    if (!(await isCommandEnabled(interaction.guild.id, commandName))) {
      return interaction.reply({ content: '❌ Denne command er deaktiveret.', flags: 64 });
    }

    const handler = slashHandlers[commandName];
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        console.error(`[Bot] Fejl i command ${commandName}:`, error);
        const reply = { content: '❌ Der skete en fejl under udførelse af kommandoen.', flags: 64 };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: reply.content }).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
  });

  console.log(`[Bot] ✅ Alle handlers registreret for ${clientLabel}`);
});

// ==================== START BOT MANAGER ====================

console.log('');
console.log('========================================');
console.log('      Discord Bot - Starting...        ');
console.log('========================================');
console.log('');

manager.start().then(() => {
  console.log('');
  console.log('[Bot] ✅ Bot Manager startet succesfuldt');
  console.log('[Bot] 📊 Status:', JSON.stringify(manager.getStatus(), null, 2));
}).catch((error) => {
  console.error('[Bot] ❌ Kunne ikke starte bot manager:', error);
  process.exit(1);
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGINT', async () => {
  console.log('');
  console.log('[Bot] ⚠️ Modtaget SIGINT - lukker ned...');
  
  try {
    // Send offline status before shutdown
    const defaultClient = manager.defaultClient;
    if (defaultClient) {
      await sendOfflineStatus(defaultClient);
    }

    // Cleanup handler instances
    for (const [key, handler] of handlerInstances) {
      if (handler.destroy) {
        console.log(`[Bot] Cleaning up ${key}...`);
        handler.destroy();
      }
    }
    handlerInstances.clear();

    await manager.stop();
    console.log('[Bot] ✅ Bot Manager stoppet');
  } catch (error) {
    console.error('[Bot] ❌ Fejl under nedlukning:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('');
  console.log('[Bot] ⚠️ Modtaget SIGTERM - lukker ned...');
  
  try {
    // Cleanup handler instances
    for (const [key, handler] of handlerInstances) {
      if (handler.destroy) {
        console.log(`[Bot] Cleaning up ${key}...`);
        handler.destroy();
      }
    }
    handlerInstances.clear();

    await manager.stop();
    console.log('[Bot] ✅ Bot Manager stoppet');
  } catch (error) {
    console.error('[Bot] ❌ Fejl under nedlukning:', error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Bot] ❌ Uncaught Exception:', error);
  botLog('00000000-0000-0000-0000-000000000000', 'error', 'system', `Uncaught Exception: ${error.message}`, { stack: error.stack });
});

process.on('unhandledRejection', (error) => {
  console.error('[Bot] ❌ Unhandled Rejection:', error);
  botLog('00000000-0000-0000-0000-000000000000', 'error', 'system', `Unhandled Rejection: ${error?.message || error}`, { stack: error?.stack });
});

module.exports = { manager };
