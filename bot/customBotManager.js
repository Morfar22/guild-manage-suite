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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;
const DEFAULT_BOT_TOKEN = process.env.DEFAULT_BOT_TOKEN;

// How often to check for config changes (60 seconds)
const CONFIG_CHECK_INTERVAL = 60000;

// How often to send heartbeats (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';

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
    
    // Registered handler factories
    this.handlerFactories = [];
    
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
      new SlashCommandBuilder()
        .setName('fivem')
        .setDescription('FiveM server kommandoer')
        .addSubcommand(sub => sub.setName('status').setDescription('Se FiveM server status'))
        .addSubcommand(sub => sub.setName('players').setDescription('Se online spillere'))
        .addSubcommand(sub => sub
          .setName('player')
          .setDescription('Udfør en spiller-handling')
          .addStringOption(o => o.setName('action').setDescription('Handling').setRequired(true)
            .addChoices(
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
              { name: 'Warn', value: 'warn' },
              { name: 'Kill', value: 'kill' },
              { name: 'Revive', value: 'revive' },
              { name: 'Revive All', value: 'revive-all' },
            ))
          .addStringOption(o => o.setName('target').setDescription('Spiller ID'))
          .addStringOption(o => o.setName('reason').setDescription('Årsag'))
        )
        .addSubcommand(sub => sub
          .setName('server')
          .setDescription('Udfør en server-handling')
          .addStringOption(o => o.setName('action').setDescription('Handling').setRequired(true)
            .addChoices(
              { name: 'Restart', value: 'restart' },
              { name: 'Announce', value: 'announce' },
            ))
          .addStringOption(o => o.setName('message').setDescription('Besked'))
        ),
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
      console.log(`[CustomBotManager] Commands already deployed for ${applicationId} this session`);
      return;
    }

    const deployGlobal = options.global !== false;
    const clearGuildIds = Array.isArray(options.clearGuildIds) ? options.clearGuildIds : [];

    try {
      const commands = CustomBotManager.buildCommands();
      const rest = new REST({ version: '10' }).setToken(token);
      const commandData = commands.map(c => c.toJSON());

      if (deployGlobal) {
        // Default bot: global commands are intentional.
        console.log(`[CustomBotManager] 🔄 Deploying ${commands.length} slash commands globally for app ${applicationId}...`);
        const data = await rest.put(
          Routes.applicationCommands(applicationId),
          { body: commandData }
        );
        console.log(`[CustomBotManager] ✅ ${data.length} slash commands deployed globally for app ${applicationId}`);
      } else {
        // Custom bots are tied to one Discord guild. Remove stale global commands
        // from older versions so commands don't appear in unrelated guilds.
        await rest.put(
          Routes.applicationCommands(applicationId),
          { body: [] }
        );
        console.log(`[CustomBotManager] ✅ Cleared global commands for custom app ${applicationId}`);
      }

      // Deploy per-guild for instant availability.
      if (guildIds.length > 0) {
        console.log(`[CustomBotManager] 🔄 Deploying commands to ${guildIds.length} assigned guild(s)...`);
        for (const guildId of guildIds) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(applicationId, guildId),
              { body: commandData }
            );
          } catch (guildError) {
            console.error(`[CustomBotManager] Failed guild deploy for ${guildId}:`, guildError.message);
          }
        }
        console.log('[CustomBotManager] ✅ Assigned guild command deployment complete');
      }

      // Remove stale guild-specific commands from extra guilds this custom bot may
      // still be invited to from older deployments.
      for (const guildId of clearGuildIds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(applicationId, guildId),
            { body: [] }
          );
          console.log(`[CustomBotManager] ✅ Cleared commands from unassigned guild ${guildId}`);
        } catch (guildError) {
          console.warn(`[CustomBotManager] Could not clear commands from unassigned guild ${guildId}:`, guildError.message);
        }
      }

      CustomBotManager._deployedAppIds.add(applicationId);
    } catch (error) {
      console.error(`[CustomBotManager] ❌ Failed to deploy commands for ${applicationId}:`, error.message);
    }
  }

  /**
   * Deploy slash commands to a single guild (instant, used on guildCreate)
   * @param {string} token - Bot token
   * @param {string} applicationId - Bot application/client ID
   * @param {string} guildId - The guild to deploy to
   */
  async deployCommandsToGuild(token, applicationId, guildId) {
    if (!applicationId || !guildId) return;

    try {
      const commands = CustomBotManager.buildCommands();
      const rest = new REST({ version: '10' }).setToken(token);

      console.log(`[CustomBotManager] 🔄 Deploying commands to new guild ${guildId}...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(applicationId, guildId),
        { body: commands.map(c => c.toJSON()) }
      );
      console.log(`[CustomBotManager] ✅ ${data.length} commands deployed to guild ${guildId}`);
    } catch (error) {
      console.error(`[CustomBotManager] ❌ Failed to deploy commands to guild ${guildId}:`, error.message);
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
        latency_ms: client.ws.ping,
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
          warnAvatarOnce(`invalid:${avatarUrl}`, `[CustomBotManager] Skipping invalid avatar URL for ${client.user.tag}`);
        }

        if (parsedAvatarUrl && ['http:', 'https:'].includes(parsedAvatarUrl.protocol)) {
          try {
            const response = await fetch(parsedAvatarUrl.toString());
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.startsWith('image/')) {
                warnAvatarOnce(`content-type:${parsedAvatarUrl.toString()}:${contentType}`, `[CustomBotManager] Skipping avatar URL with non-image content type: ${contentType || 'unknown'}`);
              } else {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const dataUri = `data:${contentType};base64,${base64}`;

                await client.user.setAvatar(dataUri);
                console.log(`[CustomBotManager] Updated bot avatar from configured URL`);
              }
            } else {
              warnAvatarOnce(`http:${parsedAvatarUrl.toString()}:${response.status}`, `[CustomBotManager] Avatar URL returned HTTP ${response.status}; keeping current avatar`);
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
      const botGuildIds = assignedDiscordGuildId && client.guilds.cache.has(assignedDiscordGuildId)
        ? [assignedDiscordGuildId]
        : [];

      if (assignedDiscordGuildId && botGuildIds.length === 0) {
        console.warn(`[CustomBotManager] Custom bot ${client.user.tag} is not in assigned guild ${assignedDiscordGuildId}; skipping guild command deploy`);
      }

      const unassignedGuildIds = client.guilds.cache
        .filter(guild => !assignedDiscordGuildId || guild.id !== assignedDiscordGuildId)
        .map(guild => guild.id);

      await this.deployCommandsForBot(config.bot_token, applicationId, botGuildIds, {
        global: false,
        clearGuildIds: unassignedGuildIds,
      });
      
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

  /**
   * Start the default bot
   */
  async startDefaultBot() {
    if (!DEFAULT_BOT_TOKEN) {
      console.log('[CustomBotManager] No DEFAULT_BOT_TOKEN, skipping default bot');
      return null;
    }

    console.log('[CustomBotManager] Starting default bot...');

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
      console.log(`[CustomBotManager] ✅ Default bot ready: ${this.defaultClient.user.tag}`);
      console.log(`[CustomBotManager] Serving ${this.defaultClient.guilds.cache.size} guild(s)`);

      // Deploy commands globally + per-guild for instant availability
      const guildIds = this.defaultClient.guilds.cache.map(g => g.id);
      await this.deployCommandsForBot(DEFAULT_BOT_TOKEN, this.defaultClient.user.id, guildIds, { global: true });
    });

    // Deploy commands instantly when bot joins a new server
    this.defaultClient.on('guildCreate', async (guild) => {
      console.log(`[CustomBotManager] 📥 Joined new guild: ${guild.name} (${guild.id})`);
      if (this.defaultClient.user) {
        await this.deployCommandsToGuild(DEFAULT_BOT_TOKEN, this.defaultClient.user.id, guild.id);
      }
    });

    this.defaultClient.on('error', (error) => {
      console.error('[CustomBotManager] Default client error:', error.message);
    });

    try {
      await this.defaultClient.login(DEFAULT_BOT_TOKEN);
      return this.defaultClient;
    } catch (error) {
      console.error('[CustomBotManager] Failed to start default bot:', error.message);
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
        ping: this.defaultClient.ws?.ping || 0
      };
    }

    for (const [guildId, bot] of this.bots) {
      status.customBots.push({
        guildId,
        ready: bot.client?.isReady() || false,
        tag: bot.client?.user?.tag,
        ping: bot.client?.ws?.ping || 0,
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
