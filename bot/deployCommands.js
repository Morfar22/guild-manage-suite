/**
 * Deploy Slash Commands to Discord
 * 
 * Run this script once (or after adding new commands) to register
 * all slash commands with Discord's API.
 * 
 * Usage: node bot/deployCommands.js
 * 
 * Required environment variables:
 * - DEFAULT_BOT_TOKEN (or DISCORD_TOKEN)
 *
 * Optional:
 * - APPLICATION_ID (validated against the active bot token; token identity wins)
 * - DEPLOY_SCOPE=global|guild
 * - DEPLOY_GUILD_ID (required only for guild scope)
 */

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { groupFlatCommandDefinitions, getCanonicalLogicalCommands, routes } = require('./commandRouting');
const { commands } = require('./commandDefinitions');
const { buildFiveMCommand } = require('./fivem/commands');
const { commandSetsEqual } = require('./commandSync');

const TOKEN = process.env.DEFAULT_BOT_TOKEN || process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

// The public/Discovery GuildOS application must stay suitable for Discord's
// all-ages Discovery surfaces. Custom/guild-scoped bots keep the full catalog.
const DISCOVERY_EXCLUDED_COMMANDS = new Set([
  'crime',
  'slots',
  'gamble',
  'roulette',
  'blackjack',
]);

function removeDiscoveryRestrictedRoutes(groupedCommands) {
  const blockedRoutes = routes.filter((route) =>
    DISCOVERY_EXCLUDED_COMMANDS.has(route.logical)
    || DISCOVERY_EXCLUDED_COMMANDS.has(route.source)
  );

  for (const route of blockedRoutes) {
    if (route.passthrough) continue;
    const root = groupedCommands.find((command) => command.name === route.root);
    if (!root || !Array.isArray(root.options)) continue;

    if (route.group) {
      const group = root.options.find(
        (option) => option.type === 2 && option.name === route.group
      );
      if (group?.options) {
        group.options = group.options.filter(
          (option) => !(option.type === 1 && option.name === route.sub)
        );
      }
      root.options = root.options.filter(
        (option) => !(option.type === 2 && Array.isArray(option.options) && option.options.length === 0)
      );
    } else {
      root.options = root.options.filter(
        (option) => !(option.type === 1 && option.name === route.sub)
      );
    }
  }

  return groupedCommands.filter(
    (command) => !Array.isArray(command.options) || command.options.length > 0
  );
}

if (!TOKEN) {
  console.error('❌ Missing DEFAULT_BOT_TOKEN or DISCORD_TOKEN in environment variables');
  process.exit(1);
}



const rest = new REST({ version: '10' }).setToken(TOKEN);
const GUILD_ID = process.env.DEPLOY_GUILD_ID;
const DEPLOY_SCOPE = String(process.env.DEPLOY_SCOPE || (GUILD_ID ? 'guild' : 'global')).toLowerCase();

(async () => {
  try {
    // Resolve the application from the bot token itself. This prevents a stale
    // APPLICATION_ID value from deploying commands to the wrong Discord app.
    const currentBot = await rest.get(Routes.user('@me'));
    const resolvedApplicationId = currentBot.id;

    if (APPLICATION_ID && APPLICATION_ID !== resolvedApplicationId) {
      console.warn(
        `⚠️ APPLICATION_ID (${APPLICATION_ID}) matcher ikke bot-tokenets application/user ID (${resolvedApplicationId}). Bruger tokenets ID.`
      );
    }
    if (!['global', 'guild'].includes(DEPLOY_SCOPE)) {
      throw new Error('DEPLOY_SCOPE skal være "global" eller "guild"');
    }

    if (DEPLOY_SCOPE === 'guild' && !GUILD_ID) {
      console.error('❌ DEPLOY_GUILD_ID mangler til guild-scoped deployment.');
      console.error('   Eksempel: DEPLOY_SCOPE=guild DEPLOY_GUILD_ID=123456789012345678 node bot/deployCommands.js');
      process.exitCode = 1;
      return;
    }

    const flatCommandData = commands.map(c => c.toJSON());
    const groupedCommandData = groupFlatCommandDefinitions(flatCommandData);
    const commandData = DEPLOY_SCOPE === 'global'
      ? removeDiscoveryRestrictedRoutes(groupedCommandData)
      : groupedCommandData;

    // /fivem is a passthrough root in commandRouting, so append its canonical
    // definition explicitly for both official and guild-scoped deployments.
    commandData.push(buildFiveMCommand().toJSON());

    if (DEPLOY_SCOPE === 'global') {
      let existingGlobals = [];
      try {
        existingGlobals = await rest.get(Routes.applicationCommands(resolvedApplicationId));
      } catch (error) {
        console.warn('⚠️ Kunne ikke kontrollere eksisterende globale commands:', error.message);
      }

      const publicLogicalCount = getCanonicalLogicalCommands().filter(
        (name) => !DISCOVERY_EXCLUDED_COMMANDS.has(name)
      ).length;

      if (commandSetsEqual(existingGlobals, commandData)) {
        console.log(
          `✅ Globale slash commands er allerede opdaterede (${commandData.length} roots / ${publicLogicalCount} Discovery-safe funktioner)`
        );
      } else {
        console.log(
          `🔄 Synkroniserer ${commandData.length} globale slash commands (${publicLogicalCount} Discovery-safe funktioner)...`
        );
        const globalData = await rest.put(
          Routes.applicationCommands(resolvedApplicationId),
          { body: commandData }
        );

        console.log(`✅ ${globalData.length} globale commands registreret`);
        console.log('📝 Commands:', globalData.map(c => c.name).join(', '));
      }

      // If a guild ID is supplied during migration, remove legacy guild copies
      // so Discord does not display duplicate global + guild commands.
      if (GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(resolvedApplicationId, GUILD_ID),
          { body: [] }
        );
        console.log(`✅ Legacy guild commands ryddet i ${GUILD_ID}`);
      }
      return;
    }

    // Guild-scoped deployment remains available for testing and custom bots.
    // A guild-scoped test/custom deployment must not keep global commands.
    const existingGlobals = await rest.get(Routes.applicationCommands(resolvedApplicationId));
    if (existingGlobals.length > 0) {
      await rest.put(
        Routes.applicationCommands(resolvedApplicationId),
        { body: [] }
      );
      console.log(`✅ Global command scope ryddet (${existingGlobals.length} gamle command(s))`);
    } else {
      console.log('✅ Global command scope var allerede tomt');
    }

    const currentGuildCommands = await rest.get(
      Routes.applicationGuildCommands(resolvedApplicationId, GUILD_ID)
    );

    if (commandSetsEqual(currentGuildCommands, commandData)) {
      console.log(
        `✅ Guild commands er allerede opdaterede i ${GUILD_ID} (${commandData.length} roots / ${getCanonicalLogicalCommands().length} funktioner)`
      );
    } else {
      console.log(`🔄 Synkroniserer ${commandData.length} grupperede slash commands (${getCanonicalLogicalCommands().length} funktioner) i guild ${GUILD_ID}...`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(resolvedApplicationId, GUILD_ID),
        { body: commandData }
      );

      console.log(`✅ ${guildData.length} commands registreret i guild ${GUILD_ID}`);
      console.log('📝 Commands:', guildData.map(c => c.name).join(', '));
    }
  } catch (error) {
    console.error('❌ Fejl ved registrering af commands:', error);
    process.exitCode = 1;
  }
})();
