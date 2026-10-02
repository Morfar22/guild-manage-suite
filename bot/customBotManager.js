/**
 * Custom Bot Manager for Discord Bot
 * 
 * Manages multiple Discord bot instances based on guild_bot_settings.
 * Each guild can have its own custom bot with unique token, name, and avatar.
 * 
 * Environment variables required:
 * - BOT_SECRET_KEY: (same as in Lovable Cloud secrets)
 * - SUPABASE_URL: https://rkdqunnttcyuybbofkvz.supabase.co
 * - DEFAULT_BOT_TOKEN: Fallback token for guilds without custom bot
 * 
 * Usage in your main bot file:
 * const { CustomBotManager } = require('./customBotManager');
 * const manager = new CustomBotManager();
 * await manager.start();
 * 
 * IMPORTANT: This replaces the single-client approach. 
 * All handlers should be registered per-client using manager.registerHandler()
 */

const { Client, GatewayIntentBits, Partials, ActivityType, REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
const { buildFiveMCommand } = require('./fivem/commands');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;
const DEFAULT_BOT_TOKEN_CANDIDATES = [
  ['DEFAULT_BOT_TOKEN', process.env.DEFAULT_BOT_TOKEN],
  ['DISCORD_TOKEN', process.env.DISCORD_TOKEN],
  ['DISCORD_BOT_TOKEN', process.env.DISCORD_BOT_TOKEN],
]
  .map(([source, token]) => ({ source, token: String(token || '').trim() }))
  .filter(entry => entry.token.length > 0)
  .filter((entry, index, entries) => entries.findIndex(other => other.token === entry.token) === index);

// How often to check for config changes (60 seconds)
const CONFIG_CHECK_INTERVAL = 60000;

// How often to send heartbeats (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';
const GUILDOS_BRAND_NAME = 'GuildOS Bot';
const GUILDOS_ACTIVITY = process.env.DEFAULT_BOT_ACTIVITY || 'GuildOS Bot • /help';
const GUILDOS_DISCOVERY_APPLICATION_ID = process.env.GUILDOS_DISCOVERY_APPLICATION_ID || '1555371176224628787';

function matchesCommandShape(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((item, index) => matchesCommandShape(actual[index], item));
  }

  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.keys(expected).every((key) => matchesCommandShape(actual[key], expected[key]));
  }

  return actual === expected;
}

function commandSetsEqual(existingCommands, desiredCommands) {
  if (!Array.isArray(existingCommands) || existingCommands.length !== desiredCommands.length) {
    return false;
  }

  const existingByKey = new Map(
    existingCommands.map((command) => [`${command.type || 1}:${command.name}`, command])
  );

  return desiredCommands.every((desired) => {
    const existing = existingByKey.get(`${desired.type || 1}:${desired.name}`);
    return Boolean(existing) && matchesCommandShape(existing, desired);
  });
}

function getWsPing(client) {
  const ping = Number(client?.ws?.ping);
  return Number.isFinite(ping) && ping >= 0 ? Math.round(ping) : null;
}

const avatarWarningKeys = new Set();
function warnAvatarOnce(key, message) {
  if (avatarWarningKeys.has(key)) return;
  avatarWarningKeys.add(key);
  console.warn(message);
}

class CustomBotManager {
  // Set of application IDs that already had commands deployed this session
  static _deployedAppIds = new Set();

  constructor() {
    // Map of guild_id -> { client, config, handlers }
    this.bots = new Map();
    
    // Default client for guilds without custom bot
    this.defaultClient = null;
    this.defaultBotToken = null;
    
    // Registered handler factories
    this.handlerFactories = [];

    // Discord guild IDs that are explicitly assigned to active custom bots.
    // Populated from config before the clients finish logging in, so the default
    // bot can avoid those guilds during startup as well.
    this.customDiscordGuildIds = new Set();
    
    // Running state
    this.isRunning = false;
    this.configCheckInterval = null;
    this.heartbeatInterval = null;
  }

  /**
   * Build the full list of slash commands (mirrors deployCommands.js)
   */
  static buildCommands() {
    return [
      // ==================== MODERATION ====================
      new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban en bruger fra serveren')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal bannes').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til ban'))
        .addIntegerOption(o => o.setName('delete_messages').setDescription('Antal dage beskeder der skal slettes (0-7)')),
      new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban en bruger')
        .addStringOption(o => o.setName('user_id').setDescription('Brugerens ID').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til unban')),
      new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick en bruger fra serveren')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal kickes').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til kick')),
      new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal mutes').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Varighed i minutter (standard: 10)'))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til mute')),
      new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal unmutes').setRequired(true)),
      new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Advar en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal advares').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til advarsel').setRequired(true)),
      new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Se advarsler for en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),
      new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Slet beskeder i kanalen')
        .addIntegerOption(o => o.setName('amount').setDescription('Antal beskeder (1-100)').setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Kun beskeder fra denne bruger')),
      new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Sæt slowmode på kanalen')
        .addIntegerOption(o => o.setName('seconds').setDescription('Sekunder (0 = deaktiver)').setRequired(true)),
      new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lås en kanal')
        .addChannelOption(o => o.setName('channel').setDescription('Kanalen der skal låses')),
      new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Lås en kanal op')
        .addChannelOption(o => o.setName('channel').setDescription('Kanalen der skal låses op')),
      new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Softban en bruger (ban + unban for at slette beskeder)')
        .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag')),
      // ==================== MUSIC ====================
      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Afspil musik')
        .addStringOption(o => o.setName('query').setDescription('Sang eller URL').setRequired(true)),
      new SlashCommandBuilder().setName('skip').setDescription('Skip den nuværende sang'),
      new SlashCommandBuilder().setName('stop').setDescription('Stop musikken og forlad kanalen'),
      new SlashCommandBuilder().setName('pause').setDescription('Pause musikken'),
      new SlashCommandBuilder().setName('resume').setDescription('Genoptag musikken'),
      new SlashCommandBuilder().setName('queue').setDescription('Se musikken i køen'),
      new SlashCommandBuilder().setName('nowplaying').setDescription('Se den nuværende sang'),
      new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Juster lydstyrken')
        .addIntegerOption(o => o.setName('level').setDescription('Lydstyrke (0-100)').setRequired(true)),
      new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Gentag sang eller kø')
        .addStringOption(o => o.setName('mode').setDescription('off / track / queue').setRequired(true)
          .addChoices(
            { name: 'Off', value: 'off' },
            { name: 'Track', value: 'track' },
            { name: 'Queue', value: 'queue' },
          )),
      new SlashCommandBuilder().setName('shuffle').setDescription('Bland køen'),
      new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Fjern en sang fra køen')
        .addIntegerOption(o => o.setName('position').setDescription('Position i køen').setRequired(true)),
      new SlashCommandBuilder()
        .setName('move')
        .setDescription('Flyt en sang i køen')
        .addIntegerOption(o => o.setName('from').setDescription('Fra position').setRequired(true))
        .addIntegerOption(o => o.setName('to').setDescription('Til position').setRequired(true)),
      new SlashCommandBuilder()
        .setName('jump')
        .setDescription('Hop til en sang i køen')
        .addIntegerOption(o => o.setName('position').setDescription('Position').setRequired(true)),
      // ==================== LEVELING ====================
      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Se din eller en brugers rank')
        .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),
      new SlashCommandBuilder().setName('leaderboard').setDescription('Se XP leaderboard'),
      // ==================== UTILITY ====================
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Se alle tilgængelige kommandoer')
        .addStringOption(o => o.setName('category').setDescription('Kategori')
          .addChoices(
            { name: 'Moderation', value: 'moderation' },
            { name: 'Musik', value: 'music' },
            { name: 'Leveling', value: 'leveling' },
            { name: 'Utility', value: 'utility' },
            { name: 'Fun', value: 'fun' },
            { name: 'Economy', value: 'economy' },
            { name: 'Giveaway', value: 'giveaway' },
            { name: 'Suggestion', value: 'suggestion' },
            { name: 'AFK', value: 'afk' },
            { name: 'Tebex', value: 'tebex' },
          )),
      new SlashCommandBuilder().setName('ping').setDescription('Se bottens latency'),
      new SlashCommandBuilder().setName('serverinfo').setDescription('Se info om serveren'),
      new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Se info om en bruger')
        .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),
      new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Se en brugers avatar')
        .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),
      new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Opret en afstemning')
        .addStringOption(o => o.setName('question').setDescription('Spørgsmål').setRequired(true))
        .addStringOption(o => o.setName('options').setDescription('Valgmuligheder adskilt med | (f.eks. Ja|Nej|Måske)').setRequired(true)),
      new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Sæt en påmindelse')
        .addStringOption(o => o.setName('time').setDescription('Tid (f.eks. 10m, 1h, 1d)').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Påmindelsesbesked').setRequired(true)),
      // ==================== FUN ====================
      new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Spørg den magiske 8-ball')
        .addStringOption(o => o.setName('question').setDescription('Dit spørgsmål').setRequired(true)),
      new SlashCommandBuilder().setName('coinflip').setDescription('Slå plat eller krone'),
      new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Kast en terning')
        .addIntegerOption(o => o.setName('sides').setDescription('Antal sider (standard: 6)')),
      new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Spil sten-saks-papir')
        .addStringOption(o => o.setName('choice').setDescription('Dit valg').setRequired(true)
          .addChoices(
            { name: 'Sten', value: 'sten' },
            { name: 'Saks', value: 'saks' },
            { name: 'Papir', value: 'papir' },
          )),
      new SlashCommandBuilder().setName('joke').setDescription('Få en tilfældig joke'),
      new SlashCommandBuilder().setName('meme').setDescription('Få et tilfældigt meme'),
      new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Ship to brugere')
        .addUserOption(o => o.setName('user1').setDescription('Første bruger').setRequired(true))
        .addUserOption(o => o.setName('user2').setDescription('Anden bruger').setRequired(true)),
      new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Bedøm noget')
        .addStringOption(o => o.setName('thing').setDescription('Hvad skal bedømmes?').setRequired(true)),
      // ==================== ECONOMY ====================
      new SlashCommandBuilder().setName('daily').setDescription('Hent din daglige belønning'),
      new SlashCommandBuilder().setName('work').setDescription('Arbejd for at tjene penge'),
      new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Se din eller en brugers balance')
        .addUserOption(o => o.setName('user').setDescription('Bruger (valgfri)')),
      new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Betal en bruger')
        .addUserOption(o => o.setName('user').setDescription('Modtager').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),
      new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Indsæt penge i banken')
        .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),
      new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Hæv penge fra banken')
        .addIntegerOption(o => o.setName('amount').setDescription('Beløb').setRequired(true)),
      new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Røv en bruger')
        .addUserOption(o => o.setName('user').setDescription('Bruger').setRequired(true)),
      new SlashCommandBuilder().setName('richest').setDescription('Se de rigeste brugere'),
      // ==================== AFK ====================
      new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Sæt din AFK status')
        .addStringOption(o => o.setName('message').setDescription('AFK besked (valgfri)')),
      // ==================== EXTRA MODERATION ====================
      new SlashCommandBuilder()
        .setName('clearwarns')
        .setDescription('Slet alle advarsler for en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),
      new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Giv en bruger timeout')
        .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Varighed i minutter (standard: 10)'))
        .addStringOption(o => o.setName('reason').setDescription('Årsag')),
      new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Fjern timeout fra en bruger')
        .addUserOption(o => o.setName('user').setDescription('Brugeren').setRequired(true)),
      new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Slet alle beskeder i kanalen (genskaber kanalen)'),
      // ==================== TEBEX ====================
      new SlashCommandBuilder()
        .setName('tebex-verify')
        .setDescription('Verificer et Tebex køb')
        .addStringOption(o => o.setName('transaction_id').setDescription('Transaktions-ID').setRequired(true)),
      // ==================== GIVEAWAY ====================
      new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Administrer giveaways')
        .addSubcommand(sub => sub
          .setName('start')
          .setDescription('Start en giveaway')
          .addStringOption(o => o.setName('prize').setDescription('Præmie').setRequired(true))
          .addStringOption(o => o.setName('duration').setDescription('Varighed (f.eks. 1h, 1d)').setRequired(true))
          .addIntegerOption(o => o.setName('winners').setDescription('Antal vindere (standard: 1)'))
          .addStringOption(o => o.setName('description').setDescription('Beskrivelse'))
        )
        .addSubcommand(sub => sub
          .setName('end')
          .setDescription('Afslut en giveaway tidligt')
          .addStringOption(o => o.setName('message_id').setDescription('Giveaway besked-ID').setRequired(true))
        )
        .addSubcommand(sub => sub
          .setName('reroll')
          .setDescription('Vælg nye vindere')
          .addStringOption(o => o.setName('message_id').setDescription('Giveaway besked-ID').setRequired(true))
        ),
      // ==================== SUGGESTION ====================
      new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Send et forslag')
        .addStringOption(o => o.setName('suggestion').setDescription('Dit forslag').setRequired(true)),
      // ==================== GLOBAL BAN REPORT ====================
      new SlashCommandBuilder()
        .setName('globalban-report')
        .setDescription('Rapportér en bruger til det globale ban-system')
        .addUserOption(o => o.setName('user').setDescription('Brugeren der skal rapporteres').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Årsag til rapporten').setRequired(true))
        .addStringOption(o => o.setName('severity').setDescription('Alvorlighed/kategori')
          .addChoices(
            { name: 'Cheating', value: 'cheating' },
            { name: 'Chikane', value: 'harassment' },
            { name: 'Scam', value: 'scam' },
            { name: 'Raiding', value: 'raiding' },
            { name: 'ToS Overtrædelse', value: 'tos_violation' },
            { name: 'Andet', value: 'other' },
          ))
        .addStringOption(o => o.setName('evidence').setDescription('Link til beviser (valgfri)')),
      // ==================== ADMIN / TEST ====================
      new SlashCommandBuilder()
        .setName('testall')
        .setDescription('Test alle bot-kommandoer og handlers (kun admin)')
        .addBooleanOption(o => o.setName('verbose').setDescription('Vis detaljer for hver kommando')),
      // ==================== FIVEM ====================
      buildFiveMCommand(),
    ];
  }

  /**
   * Deploy slash commands for a bot application (globally + per-guild for instant availability)
   * @param {string} token - Bot token
   * @param {string} applicationId - Bot application/client ID
   * @param {string[]} [guildIds] - Optional guild IDs for instant guild-specific deployment
   */
  async deployCommandsForBot(token, applicationId, guildIds = [], options = {}) {
    if (!applicationId) {
      console.log('[CustomBotManager] No application ID provided, skipping command deploy');
      return;
    }

    // Only deploy once per session per application ID
    if (CustomBotManager._deployedAppIds.has(applicationId)) {
      console.log(`[CustomBotManager] Commands already checked for ${applicationId} this session`);
      return;
    }

    const scope = options.scope === 'global' ? 'global' : 'guild';
    const clearGuildIds = Array.isArray(options.clearGuildIds) ? options.clearGuildIds : [];

    try {
      const commandData = CustomBotManager.buildCommands().map(command => command.toJSON());
      const rest = new REST({ version: '10' }).setToken(token);

      if (scope === 'global') {
        // The official GuildOS application uses global commands so Discord can
        // expose them consistently across every installed server and Discovery.
        // deployCommands.js owns the complete grouped command catalog. If it has
        // already populated globals, preserve that catalog instead of replacing
        // it with this manager's smaller runtime/bootstrap set.
        let existingGlobals = [];
        try {
          existingGlobals = await rest.get(Routes.applicationCommands(applicationId));
        } catch (error) {
          console.warn(`[CustomBotManager] Could not inspect global commands for ${applicationId}:`, error.message);
        }

        if (options.preserveExistingGlobals !== false) {
          if (existingGlobals.length > 0) {
            console.log(
              `[CustomBotManager] ✅ Preserving ${existingGlobals.length} existing global commands for app ${applicationId}`
            );
          } else {
            console.warn(
              `[CustomBotManager] ⚠️ No canonical global commands found for app ${applicationId}. Run "node deployCommands.js" to publish the Discovery-safe grouped catalog.`
            );
          }
        } else if (commandSetsEqual(existingGlobals, commandData)) {
          console.log(`[CustomBotManager] ✅ Global bootstrap commands already up to date for app ${applicationId}`);
        } else {
          console.log(`[CustomBotManager] 🔄 Deploying ${commandData.length} global bootstrap commands for app ${applicationId}...`);
          const deployed = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commandData }
          );
          console.log(`[CustomBotManager] ✅ ${deployed.length} global commands active for app ${applicationId}`);
        }

        // Remove old guild-scoped copies to avoid duplicate commands during migration.
        const guildsToClear = [...new Set([...guildIds, ...clearGuildIds])];
        for (const guildId of guildsToClear) {
          try {
            const existingGuildCommands = await rest.get(
              Routes.applicationGuildCommands(applicationId, guildId)
            );
            if (!existingGuildCommands.length) continue;

            await rest.put(
              Routes.applicationGuildCommands(applicationId, guildId),
              { body: [] }
            );
            console.log(`[CustomBotManager] ✅ Cleared ${existingGuildCommands.length} legacy guild command(s) from ${guildId}`);
          } catch (guildError) {
            console.warn(`[CustomBotManager] Could not clear legacy guild commands from ${guildId}:`, guildError.message);
          }
        }
      } else {
        // Custom per-server bot applications stay guild-scoped so each custom
        // application only exposes commands inside its assigned server.
        const existingGlobals = await rest.get(Routes.applicationCommands(applicationId));
        if (existingGlobals.length > 0) {
          await rest.put(
            Routes.applicationCommands(applicationId),
            { body: [] }
          );
          console.log(`[CustomBotManager] ✅ Cleared ${existingGlobals.length} stale global command(s) for custom app ${applicationId}`);
        }

        for (const guildId of guildIds) {
          try {
            const existingGuildCommands = await rest.get(
              Routes.applicationGuildCommands(applicationId, guildId)
            );

            if (commandSetsEqual(existingGuildCommands, commandData)) {
              console.log(`[CustomBotManager] ✅ ${commandData.length} commands already up to date in guild ${guildId}`);
              continue;
            }

            console.log(`[CustomBotManager] 🔄 Syncing ${commandData.length} commands to guild ${guildId}...`);
            const deployed = await rest.put(
              Routes.applicationGuildCommands(applicationId, guildId),
              { body: commandData }
            );
            console.log(`[CustomBotManager] ✅ ${deployed.length} commands active in guild ${guildId}`);
          } catch (guildError) {
            console.error(`[CustomBotManager] Failed guild deploy for ${guildId}:`, guildError.message);
          }
        }

        // Remove stale guild-specific commands from extra guilds this custom bot
        // may still be invited to from older deployments.
        for (const guildId of clearGuildIds) {
          if (guildIds.includes(guildId)) continue;
          try {
            const existingGuildCommands = await rest.get(
              Routes.applicationGuildCommands(applicationId, guildId)
            );
            if (!existingGuildCommands.length) continue;

            await rest.put(
              Routes.applicationGuildCommands(applicationId, guildId),
              { body: [] }
            );
            console.log(`[CustomBotManager] ✅ Cleared ${existingGuildCommands.length} command(s) from unassigned guild ${guildId}`);
          } catch (guildError) {
            console.warn(`[CustomBotManager] Could not clear commands from unassigned guild ${guildId}:`, guildError.message);
          }
        }
      }

      CustomBotManager._deployedAppIds.add(applicationId);
    } catch (error) {
      console.error(`[CustomBotManager] ❌ Failed to sync commands for ${applicationId}:`, error.message);
    }
  }

  /**
   * Deploy slash commands to a single guild (instant, used on guildCreate)
   * @param {string} token - Bot token
   * @param {string} applicationId - Bot application/client ID
   * @param {string} guildId - The guild to deploy to
   */
  async deployCommandsToGuild(token, applicationId, guildId, options = {}) {
    if (!applicationId || !guildId) return;

    const scope = options.scope === 'global' ? 'global' : 'guild';

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const route = Routes.applicationGuildCommands(applicationId, guildId);
      const existingGuildCommands = await rest.get(route);

      if (scope === 'global') {
        // Global commands already apply automatically. Only remove stale guild
        // overrides when there is actually something to remove.
        if (existingGuildCommands.length > 0) {
          await rest.put(route, { body: [] });
          console.log(`[CustomBotManager] ✅ Cleared ${existingGuildCommands.length} stale guild override(s) from ${guildId}`);
        } else {
          console.log(`[CustomBotManager] ✅ Global commands already apply cleanly to guild ${guildId}`);
        }
        return;
      }

      const commandData = CustomBotManager.buildCommands().map(command => command.toJSON());
      if (commandSetsEqual(existingGuildCommands, commandData)) {
        console.log(`[CustomBotManager] ✅ Commands already up to date in guild ${guildId}`);
        return;
      }

      console.log(`[CustomBotManager] 🔄 Syncing commands to guild ${guildId}...`);
      const data = await rest.put(route, { body: commandData });
      console.log(`[CustomBotManager] ✅ ${data.length} commands active in guild ${guildId}`);
    } catch (error) {
      console.error(`[CustomBotManager] ❌ Failed to sync commands to guild ${guildId}:`, error.message);
    }
  }

  /**
   * Register a handler factory that will be called for each bot client
   * @param {function} factory - Function that takes (client, internalGuildId, discordGuildId) and sets up handlers
   */
  registerHandler(factory) {
    this.handlerFactories.push(factory);
    
    // Apply to existing bots
    for (const [guildId, bot] of this.bots) {
      try {
        factory(bot.client, guildId, bot.config?.discord_guild_id || null);
      } catch (error) {
        console.error(`[CustomBotManager] Error applying handler to ${guildId}:`, error);
      }
    }
    
    // Apply to default client if it exists
    if (this.defaultClient) {
      try {
        factory(this.defaultClient, null, null);
      } catch (error) {
        console.error(`[CustomBotManager] Error applying handler to default client:`, error);
      }
    }
  }

  /**
   * Get the client for a specific guild
   * @param {string} guildId - Discord guild ID
   * @returns {Client} Discord.js client
   */
  getClient(guildId) {
    // Public callers use Discord guild IDs. Custom bots are stored by internal UUID,
    // so resolve through the config instead of looking up the map directly.
    for (const [, bot] of this.bots) {
      if (bot?.config?.discord_guild_id === guildId && bot.client) {
        return bot.client;
      }
    }

    // If the guild is reserved for a custom bot but that client is not ready yet,
    // never fall back to the default bot. The caller should retry next cycle.
    if (this.customDiscordGuildIds.has(guildId)) {
      return null;
    }

    return this.defaultClient;
  }

  /**
   * Get all active clients
   * @returns {Map<string, Client>} Map of Discord guildId -> client
   */
  getAllClients() {
    const clients = new Map();
    
    for (const [internalGuildId, bot] of this.bots) {
      if (bot.client && bot.client.isReady()) {
        clients.set(bot.config?.discord_guild_id || internalGuildId, bot.client);
      }
    }
    
    if (this.defaultClient && this.defaultClient.isReady()) {
      clients.set('default', this.defaultClient);
    }
    
    return clients;
  }

  /**
   * Call the API to get bot configurations
   */
  async fetchBotConfigs() {
    if (!BOT_SECRET_KEY) {
      console.error('[CustomBotManager] BOT_SECRET_KEY not set');
      return [];
    }

    try {
      const response = await fetch(`${APP_API_BASE}/api/public/guild-bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY
        },
        body: JSON.stringify({ action: 'list_active' })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[CustomBotManager] Failed to fetch configs:', error);
        return [];
      }

      const result = await response.json();
      const configs = result.configs || [];

      // Backward-compatible fallback: if the web API hasn't deployed the
      // discord_guild_id field yet, resolve internal UUIDs directly via Supabase.
      const missingIds = configs
        .filter(config => !config.discord_guild_id && config.guild_id)
        .map(config => config.guild_id);

      if (missingIds.length > 0 && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const filter = encodeURIComponent(`in.(${missingIds.join(',')})`);
          const guildResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/guilds?id=${filter}&select=id,guild_id`,
            {
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }
          );

          if (guildResponse.ok) {
            const guildRows = await guildResponse.json();
            const discordIdByUuid = new Map(guildRows.map(row => [row.id, row.guild_id]));
            for (const config of configs) {
              if (!config.discord_guild_id) {
                config.discord_guild_id = discordIdByUuid.get(config.guild_id) || null;
              }
            }
          } else {
            console.warn('[CustomBotManager] Could not hydrate Discord guild IDs:', guildResponse.status);
          }
        } catch (error) {
          console.warn('[CustomBotManager] Discord guild ID hydration failed:', error.message);
        }
      }

      return configs;
    } catch (error) {
      console.error('[CustomBotManager] Network error fetching configs:', error.message);
      return [];
    }
  }

  /**
   * Send heartbeat for a bot
   */
  async sendHeartbeat(guildId, client, isCustom = false, discordGuildId = null) {
    if (!BOT_SECRET_KEY) return;

    try {
      const targetDiscordGuildId = discordGuildId || guildId;
      const guild = client.guilds.cache.get(targetDiscordGuildId);
      
      const payload = {
        action: 'heartbeat',
        guild_id: guildId,
        is_online: client.isReady(),
        latency_ms: getWsPing(client),
        member_count: guild?.memberCount || 0,
        is_custom_bot: isCustom
      };

      await fetch(`${APP_API_BASE}/api/public/guild-bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(`[CustomBotManager] Heartbeat error for ${guildId}:`, error.message);
    }
  }

  /**
   * Create a Discord client with standard intents
   */
  createClient() {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
        Partials.Channel
      ]
    });
    // Increase max listeners to accommodate all handlers
    client.setMaxListeners(30);
    return client;
  }

  /**
   * Clear a permanently invalid avatar URL from the persisted custom-bot config.
   * Keeps transient network/5xx failures untouched.
   */
  async clearInvalidAvatarConfig(config, reason) {
    if (!config?.guild_id || !config?.bot_avatar_url) return;

    const oldUrl = config.bot_avatar_url;
    // Prevent repeated attempts in the current process even if API cleanup fails.
    config.bot_avatar_url = null;

    if (!BOT_SECRET_KEY) {
      console.warn(
        `[CustomBotManager] Invalid avatar cleared in memory for ${config.guild_id}, but BOT_SECRET_KEY is missing; DB config was not updated`
      );
      return;
    }

    try {
      const response = await fetch(`${APP_API_BASE}/api/public/guild-bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY,
        },
        body: JSON.stringify({
          action: 'clear_invalid_avatar',
          guild_id: config.guild_id,
          reason: String(reason || 'invalid avatar source').slice(0, 500),
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        console.warn(
          `[CustomBotManager] Could not persist avatar cleanup for ${config.guild_id}: HTTP ${response.status} ${details.slice(0, 180)}`
        );
        return;
      }

      console.log(
        `[CustomBotManager] 🧹 Removed invalid avatar URL from config for ${config.bot_name || config.guild_id}: ${oldUrl}`
      );
    } catch (error) {
      console.warn(
        `[CustomBotManager] Avatar cleanup API failed for ${config.guild_id}: ${error?.message || error}`
      );
    }
  }

  /**
   * Set bot presence based on config
   */
  async setPresence(client, config) {
    if (!client.isReady()) return;

    try {
      const activityTypes = {
        'PLAYING': ActivityType.Playing,
        'STREAMING': ActivityType.Streaming,
        'LISTENING': ActivityType.Listening,
        'WATCHING': ActivityType.Watching,
        'COMPETING': ActivityType.Competing,
        'CUSTOM': ActivityType.Custom
      };

      const activities = [];
      if (config.bot_activity_text) {
        activities.push({
          name: config.bot_activity_text,
          type: activityTypes[config.bot_activity_type] || ActivityType.Playing
        });
      }

      await client.user.setPresence({
        status: config.bot_status || 'online',
        activities
      });

      console.log(`[CustomBotManager] Set presence for ${client.user.tag}: ${config.bot_status}`);
    } catch (error) {
      console.error('[CustomBotManager] Error setting presence:', error.message);
    }
  }

  /**
   * Update bot profile (username and avatar) based on config
   * Note: Discord rate limits these heavily (2 changes per hour for username)
   */
  async updateBotProfile(client, config) {
    if (!client.isReady()) return;

    try {
      // Update username if different and configured
      if (config.bot_name && client.user.username !== config.bot_name) {
        try {
          await client.user.setUsername(config.bot_name);
          console.log(`[CustomBotManager] Updated bot username to: ${config.bot_name}`);
        } catch (error) {
          // Rate limit or other error - just log it
          if (error.code === 50035 || error.message.includes('rate limit')) {
            console.log(`[CustomBotManager] Username change rate limited, skipping (current: ${client.user.username})`);
          } else {
            console.error(`[CustomBotManager] Error setting username:`, error.message);
          }
        }
      }

      // Update avatar if configured and valid.
      if (config.bot_avatar_url) {
        const avatarUrl = String(config.bot_avatar_url).trim();
        let parsedAvatarUrl = null;
        try {
          parsedAvatarUrl = new URL(avatarUrl);
        } catch {
          warnAvatarOnce(
            `invalid:${avatarUrl}`,
            `[CustomBotManager] Invalid avatar URL for ${client.user.tag}; removing it from config`
          );
          await this.clearInvalidAvatarConfig(config, 'Invalid URL');
        }

        if (parsedAvatarUrl && ['http:', 'https:'].includes(parsedAvatarUrl.protocol)) {
          try {
            const response = await fetch(parsedAvatarUrl.toString());
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.startsWith('image/')) {
                warnAvatarOnce(
                  `content-type:${parsedAvatarUrl.toString()}:${contentType}`,
                  `[CustomBotManager] Avatar URL for ${client.user.tag} is not an image; removing it from config`
                );
                await this.clearInvalidAvatarConfig(
                  config,
                  `Non-image content type: ${contentType || 'unknown'}`
                );
              } else {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const dataUri = `data:${contentType};base64,${base64}`;

                await client.user.setAvatar(dataUri);
                console.log(`[CustomBotManager] Updated bot avatar from configured URL`);
              }
            } else {
              const permanentMissing = response.status === 404 || response.status === 410;
              if (permanentMissing) {
                warnAvatarOnce(
                  `http:${parsedAvatarUrl.toString()}:${response.status}`,
                  `[CustomBotManager] Avatar URL for ${client.user.tag} returned HTTP ${response.status}; removing it from config`
                );
                await this.clearInvalidAvatarConfig(config, `HTTP ${response.status}`);
              } else {
                warnAvatarOnce(
                  `http:${parsedAvatarUrl.toString()}:${response.status}`,
                  `[CustomBotManager] Avatar URL for ${client.user.tag} returned HTTP ${response.status}; treating as transient and keeping config`
                );
              }
            }
          } catch (error) {
            if (error.code === 50035 || error.message.includes('rate limit')) {
              console.log(`[CustomBotManager] Avatar change rate limited, skipping`);
            } else {
              console.warn(`[CustomBotManager] Avatar update skipped:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CustomBotManager] Error updating bot profile:', error.message);
    }
  }

  /**
   * Start a custom bot for a guild
   */
  async startCustomBot(config) {
    const guildId = config.guild_id;
    
    // Check if already running
    if (this.bots.has(guildId)) {
      const existing = this.bots.get(guildId);
      if (existing.client && existing.client.isReady()) {
        console.log(`[CustomBotManager] Bot for ${guildId} already running`);
        return existing.client;
      }
      // Clean up old client
      await this.stopCustomBot(guildId);
    }

    if (!config.bot_token) {
      console.error(`[CustomBotManager] No token for guild ${guildId}`);
      return null;
    }

    console.log(`[CustomBotManager] Starting custom bot for guild ${guildId}...`);

    const client = this.createClient();

    // Apply handlers BEFORE login, same as the default bot.
    // Event-driven integrations such as Shoukaku/Kazagumo must subscribe
    // before Discord emits clientReady or their Lavalink nodes never connect.
    for (const factory of this.handlerFactories) {
      try {
        factory(client, guildId, config.discord_guild_id || null);
      } catch (error) {
        console.error(`[CustomBotManager] Handler error for ${guildId}:`, error);
      }
    }

    client.once('clientReady', async () => {
      console.log(`[CustomBotManager] ✅ Custom bot ready: ${client.user.tag} for guild ${guildId}`);
      
      // Deploy per-guild commands only to the guild this custom bot is assigned to.
      // A bot token can be invited to extra Discord guilds, but those guilds must not
      // receive this customer's commands or handlers.
      const applicationId = client.user.id;
      const assignedDiscordGuildId = config.discord_guild_id || null;

      if (!assignedDiscordGuildId) {
        console.error(`[CustomBotManager] Missing Discord guild mapping for custom bot ${client.user.tag}; leaving existing commands untouched`);
      } else {
        const botGuildIds = client.guilds.cache.has(assignedDiscordGuildId)
          ? [assignedDiscordGuildId]
          : [];

        if (botGuildIds.length === 0) {
          console.warn(`[CustomBotManager] Custom bot ${client.user.tag} is not in assigned guild ${assignedDiscordGuildId}; skipping guild command deploy`);
        }

        const unassignedGuildIds = client.guilds.cache
          .filter(guild => guild.id !== assignedDiscordGuildId)
          .map(guild => guild.id);

        await this.deployCommandsForBot(config.bot_token, applicationId, botGuildIds, {
          clearGuildIds: unassignedGuildIds,
        });
      }
      
      // Update bot profile (username and avatar)
      await this.updateBotProfile(client, config);
      
      // Set presence
      await this.setPresence(client, config);

      // Send initial heartbeat
      await this.sendHeartbeat(guildId, client, true, config.discord_guild_id || null);
    });

    client.on('error', (error) => {
      console.error(`[CustomBotManager] Client error for ${guildId}:`, error.message);
    });

    client.on('disconnect', () => {
      console.log(`[CustomBotManager] Bot disconnected for ${guildId}`);
    });

    try {
      await client.login(config.bot_token);
      
      this.bots.set(guildId, {
        client,
        config,
        startedAt: new Date()
      });

      return client;
    } catch (error) {
      console.error(`[CustomBotManager] Failed to start bot for ${guildId}:`, error.message);
      
      // Report error to API
      await this.reportBotError(guildId, error.message);
      
      return null;
    }
  }

  /**
   * Stop a custom bot
   */
  async stopCustomBot(guildId) {
    const bot = this.bots.get(guildId);
    if (!bot) return;

    console.log(`[CustomBotManager] Stopping custom bot for ${guildId}...`);

    try {
      if (bot.client) {
        bot.client.destroy();
      }
    } catch (error) {
      console.error(`[CustomBotManager] Error stopping bot for ${guildId}:`, error.message);
    }

    this.bots.delete(guildId);
  }

  /**
   * Report bot error to API
   */
  async reportBotError(guildId, errorMessage) {
    if (!BOT_SECRET_KEY) return;

    try {
      await fetch(`${APP_API_BASE}/api/public/guild-bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': BOT_SECRET_KEY
        },
        body: JSON.stringify({
          action: 'report_error',
          guild_id: guildId,
          error: errorMessage
        })
      });
    } catch (error) {
      console.error('[CustomBotManager] Failed to report error:', error.message);
    }
  }

  /**
   * Sync bot configurations - start/stop bots as needed
   */
  async syncConfigs() {
    console.log('[CustomBotManager] Syncing bot configurations...');

    const configs = await this.fetchBotConfigs();
    const activeGuildIds = new Set(configs.map(c => c.guild_id));
    this.customDiscordGuildIds = new Set(
      configs.map(config => config.discord_guild_id).filter(Boolean)
    );

    // Stop bots that are no longer active
    for (const [guildId, bot] of this.bots) {
      if (!activeGuildIds.has(guildId)) {
        console.log(`[CustomBotManager] Stopping inactive bot for ${guildId}`);
        await this.stopCustomBot(guildId);
      }
    }

    // Start/update bots that should be active
    for (const config of configs) {
      const existing = this.bots.get(config.guild_id);
      
      if (!existing) {
        // Start new bot
        await this.startCustomBot(config);
      } else if (config.bot_token !== existing.config.bot_token) {
        // Token changed, restart bot
        console.log(`[CustomBotManager] Token changed for ${config.guild_id}, restarting...`);
        await this.stopCustomBot(config.guild_id);
        await this.startCustomBot(config);
      } else {
        // Update presence if changed
        if (config.bot_status !== existing.config.bot_status ||
            config.bot_activity_text !== existing.config.bot_activity_text ||
            config.bot_activity_type !== existing.config.bot_activity_type) {
          await this.setPresence(existing.client, config);
        }
        existing.config = config;
      }
    }

    console.log(`[CustomBotManager] Sync complete. Running ${this.bots.size} custom bot(s)`);
  }

  /**
   * Send heartbeats for all bots
   */
  async sendAllHeartbeats() {
    for (const [guildId, bot] of this.bots) {
      await this.sendHeartbeat(guildId, bot.client, true, bot.config?.discord_guild_id || null);
    }

    // Also send for default client guilds, except guilds explicitly assigned to a custom bot.
    if (this.defaultClient && this.defaultClient.isReady()) {
      const customDiscordGuildIds = new Set(
        [...this.bots.values()]
          .map(bot => bot.config?.discord_guild_id)
          .filter(Boolean)
      );

      for (const [, guild] of this.defaultClient.guilds.cache) {
        if (!customDiscordGuildIds.has(guild.id)) {
          await this.sendHeartbeat(guild.id, this.defaultClient, false);
        }
      }
    }
  }

  async resolveDefaultBotToken() {
    if (DEFAULT_BOT_TOKEN_CANDIDATES.length === 0) {
      console.warn('[CustomBotManager] Intet token til GuildOS Bot fundet. Sætter kun custom bots i drift.');
      console.warn('[CustomBotManager] Sæt DEFAULT_BOT_TOKEN, DISCORD_TOKEN eller DISCORD_BOT_TOKEN for at aktivere GuildOS Bot.');
      return null;
    }

    for (const candidate of DEFAULT_BOT_TOKEN_CANDIDATES) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${candidate.token}` },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          console.log(`[CustomBotManager] ✅ Gyldigt GuildOS Bot-token fundet via ${candidate.source}`);
          return candidate.token;
        }

        if (response.status === 401) {
          console.warn(`[CustomBotManager] ${candidate.source} er ugyldigt; prøver næste token-kilde`);
          continue;
        }

        console.warn(`[CustomBotManager] Kunne ikke validere ${candidate.source} (HTTP ${response.status}); forsøger login direkte`);
        return candidate.token;
      } catch (error) {
        console.warn(`[CustomBotManager] Token-validering fejlede for ${candidate.source}: ${error?.message || error}; forsøger login direkte`);
        return candidate.token;
      }
    }

    console.error('[CustomBotManager] Ingen gyldige GuildOS Bot-tokens blev fundet. Custom bots fortsætter.');
    return null;
  }

  /**
   * Start the default bot
   */
  async startDefaultBot() {
    const defaultBotToken = await this.resolveDefaultBotToken();
    if (!defaultBotToken) return null;

    this.defaultBotToken = defaultBotToken;
    console.log('[CustomBotManager] Starting GuildOS Bot...');

    this.defaultClient = this.createClient();

    // Apply handlers BEFORE login so event-based connectors (e.g. Shoukaku for music)
    // can listen for the 'ready' event. Handlers must be designed to handle
    // the client not being ready yet (e.g. guilds cache empty).
    for (const factory of this.handlerFactories) {
      try {
        factory(this.defaultClient, null, null);
      } catch (error) {
        console.error('[CustomBotManager] Handler error for default:', error);
      }
    }

    this.defaultClient.once('clientReady', async () => {
      // Keep the shared/default bot visibly branded as GuildOS Bot.
      // Custom bots intentionally keep the names configured by each guild.
      try {
        if (this.defaultClient.user.username !== GUILDOS_BRAND_NAME) {
          await this.defaultClient.user.setUsername(GUILDOS_BRAND_NAME);
        }
      } catch (error) {
        console.warn('[CustomBotManager] Kunne ikke ændre Discord-navn til GuildOS Bot:', error?.message || error);
      }

      try {
        this.defaultClient.user.setPresence({
          status: 'online',
          activities: [{ name: GUILDOS_ACTIVITY, type: ActivityType.Watching }],
        });
      } catch (error) {
        console.warn('[CustomBotManager] Kunne ikke sætte GuildOS Bot presence:', error?.message || error);
      }

      console.log(`[CustomBotManager] ✅ GuildOS Bot ready: ${this.defaultClient.user.tag}`);
      console.log(`[CustomBotManager] Serving ${this.defaultClient.guilds.cache.size} guild(s)`);

      if (
        GUILDOS_DISCOVERY_APPLICATION_ID &&
        this.defaultClient.user.id !== GUILDOS_DISCOVERY_APPLICATION_ID
      ) {
        console.warn(
          `[CustomBotManager] ⚠️ Discovery app mismatch: running application ${this.defaultClient.user.id}, expected ${GUILDOS_DISCOVERY_APPLICATION_ID}. Check the production bot token.`
        );
      }

      // The official GuildOS bot uses global slash commands. Existing guild
      // registrations are cleared during this migration to prevent duplicates.
      const guildIds = this.defaultClient.guilds.cache.map(g => g.id);
      await this.deployCommandsForBot(defaultBotToken, this.defaultClient.user.id, guildIds, {
        scope: 'global',
        preserveExistingGlobals: true,
      });
    });

    // Global commands automatically apply when the official bot joins a new
    // server. Clear any stale guild-level overrides from an older deployment.
    this.defaultClient.on('guildCreate', async (guild) => {
      console.log(`[CustomBotManager] 📥 Joined new guild: ${guild.name} (${guild.id})`);
      if (this.defaultClient.user) {
        await this.deployCommandsToGuild(
          defaultBotToken,
          this.defaultClient.user.id,
          guild.id,
          { scope: 'global' }
        );
      }
    });

    this.defaultClient.on('error', (error) => {
      console.error('[CustomBotManager] Default client error:', error.message);
    });

    try {
      await this.defaultClient.login(defaultBotToken);
      return this.defaultClient;
    } catch (error) {
      const message = error?.message || String(error);
      if (/invalid token/i.test(message)) {
        console.error('[CustomBotManager] GuildOS Bot-tokenet er ugyldigt. Custom bots fortsætter med at starte.');
        console.error('[CustomBotManager] Kontrollér DEFAULT_BOT_TOKEN / DISCORD_TOKEN / DISCORD_BOT_TOKEN i /bot/.env.');
      } else {
        console.error('[CustomBotManager] Failed to start GuildOS Bot:', message);
      }

      try {
        this.defaultClient?.destroy();
      } catch {}
      this.defaultClient = null;
      this.defaultBotToken = null;
      return null;
    }
  }

  /**
   * Start the bot manager
   */
  async start() {
    if (this.isRunning) {
      console.log('[CustomBotManager] Already running');
      return;
    }

    console.log('[CustomBotManager] Starting Custom Bot Manager...');
    this.isRunning = true;

    // Start default bot first
    await this.startDefaultBot();

    // Initial sync
    await this.syncConfigs();

    // Start periodic config check
    this.configCheckInterval = setInterval(() => {
      this.syncConfigs().catch(error => {
        console.error('[CustomBotManager] Config sync error:', error.message);
      });
    }, CONFIG_CHECK_INTERVAL);

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendAllHeartbeats().catch(error => {
        console.error('[CustomBotManager] Heartbeat error:', error.message);
      });
    }, HEARTBEAT_INTERVAL);

    console.log('[CustomBotManager] ✅ Manager started successfully');
  }

  /**
   * Stop all bots and the manager
   */
  async stop() {
    console.log('[CustomBotManager] Stopping Custom Bot Manager...');

    this.isRunning = false;

    // Clear intervals
    if (this.configCheckInterval) {
      clearInterval(this.configCheckInterval);
      this.configCheckInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Stop all custom bots
    for (const guildId of this.bots.keys()) {
      await this.stopCustomBot(guildId);
    }

    // Stop default client
    if (this.defaultClient) {
      this.defaultClient.destroy();
      this.defaultClient = null;
      this.defaultBotToken = null;
    }

    console.log('[CustomBotManager] ✅ Manager stopped');
  }

  /**
   * Get status of all bots
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      defaultBot: null,
      customBots: []
    };

    if (this.defaultClient) {
      status.defaultBot = {
        ready: this.defaultClient.isReady(),
        tag: this.defaultClient.user?.tag,
        guilds: this.defaultClient.guilds?.cache.size || 0,
        ping: getWsPing(this.defaultClient)
      };
    }

    for (const [guildId, bot] of this.bots) {
      status.customBots.push({
        guildId,
        ready: bot.client?.isReady() || false,
        tag: bot.client?.user?.tag,
        ping: getWsPing(bot.client),
        startedAt: bot.startedAt
      });
    }

    return status;
  }
}

// Export singleton instance and class
const manager = new CustomBotManager();

module.exports = { 
  CustomBotManager,
  manager,
  // Convenience methods for backward compatibility
  getClient: (guildId) => manager.getClient(guildId),
  getAllClients: () => manager.getAllClients()
};
