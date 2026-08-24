/**
 * Prefix Command Handler
 * 
 * Parses prefix-based commands (e.g., !ban @user reason) and creates
 * a fake interaction object so existing slash command handlers can be reused.
 * 
 * Each guild can configure its own prefix (default: !)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

// Cache prefixes per guild (refresh every 60s)
const prefixCache = new Map();
const CACHE_TTL = 60000;

// Command argument definitions - maps command names to their expected options
// Each option: { name, type: 'user'|'string'|'integer'|'boolean'|'channel', required }
const COMMAND_ARGS = {
  // Moderation
  ban: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  unban: [
    { name: 'user_id', type: 'string', required: true },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  kick: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  mute: [
    { name: 'user', type: 'user', required: true },
    { name: 'duration', type: 'integer', required: false },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  unmute: [
    { name: 'user', type: 'user', required: true },
  ],
  warn: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string_rest', required: true },
  ],
  warnings: [
    { name: 'user', type: 'user', required: true },
  ],
  clear: [
    { name: 'amount', type: 'integer', required: true },
    { name: 'user', type: 'user', required: false },
  ],
  slowmode: [
    { name: 'seconds', type: 'integer', required: true },
  ],
  lock: [
    { name: 'channel', type: 'channel', required: false },
  ],
  unlock: [
    { name: 'channel', type: 'channel', required: false },
  ],
  softban: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  clearwarns: [
    { name: 'user', type: 'user', required: true },
  ],
  timeout: [
    { name: 'user', type: 'user', required: true },
    { name: 'duration', type: 'integer', required: false },
    { name: 'reason', type: 'string_rest', required: false },
  ],
  untimeout: [
    { name: 'user', type: 'user', required: true },
  ],
  nuke: [],

  // Music
  play: [{ name: 'query', type: 'string_rest', required: true }],
  skip: [],
  stop: [],
  pause: [],
  resume: [],
  queue: [],
  nowplaying: [],
  shuffle: [],
  volume: [{ name: 'level', type: 'integer', required: true }],
  loop: [{ name: 'mode', type: 'string', required: true }],
  remove: [{ name: 'position', type: 'integer', required: true }],
  move: [
    { name: 'from', type: 'integer', required: true },
    { name: 'to', type: 'integer', required: true },
  ],
  jump: [{ name: 'position', type: 'integer', required: true }],

  // Leveling
  rank: [{ name: 'user', type: 'user', required: false }],
  leaderboard: [],

  // Utility
  help: [{ name: 'category', type: 'string', required: false }],
  ping: [],
  serverinfo: [],
  userinfo: [{ name: 'user', type: 'user', required: false }],
  avatar: [{ name: 'user', type: 'user', required: false }],
  poll: [
    { name: 'question', type: 'string', required: true },
    { name: 'options', type: 'string_rest', required: true },
  ],
  remind: [
    { name: 'time', type: 'string', required: true },
    { name: 'message', type: 'string_rest', required: true },
  ],

  // Fun
  '8ball': [{ name: 'question', type: 'string_rest', required: true }],
  coinflip: [],
  dice: [{ name: 'sides', type: 'integer', required: false }],
  rps: [{ name: 'choice', type: 'string', required: true }],
  joke: [],
  meme: [],
  ship: [
    { name: 'user1', type: 'user', required: true },
    { name: 'user2', type: 'user', required: true },
  ],
  rate: [{ name: 'thing', type: 'string_rest', required: true }],

  // Economy
  daily: [],
  work: [],
  balance: [{ name: 'user', type: 'user', required: false }],
  pay: [
    { name: 'user', type: 'user', required: true },
    { name: 'amount', type: 'integer', required: true },
  ],
  deposit: [{ name: 'amount', type: 'integer', required: true }],
  withdraw: [{ name: 'amount', type: 'integer', required: true }],
  rob: [{ name: 'user', type: 'user', required: true }],
  richest: [],

  // AFK
  afk: [{ name: 'message', type: 'string_rest', required: false }],

  // Suggestion
  suggest: [{ name: 'suggestion', type: 'string_rest', required: true }],

  // Tebex
  'tebex-verify': [{ name: 'transaction_id', type: 'string', required: true }],

  // Global Ban
  'globalban-report': [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string_rest', required: true },
  ],

  // Tickets
  ticket: [],
  'ticket-close': [{ name: 'delete', type: 'boolean', required: false }],
  'ticket-claim': [],
  'ticket-add': [{ name: 'user', type: 'user', required: true }],
  'ticket-remove': [{ name: 'user', type: 'user', required: true }],
  'ticket-remind': [],

  // Utility (nye)
  uptime: [],
  stats: [],
  invite: [],
  calculate: [{ name: 'expression', type: 'string_rest', required: true }],
  channelinfo: [{ name: 'channel', type: 'channel', required: false }],
  roles: [],
  members: [],
  emojis: [],
  banner: [{ name: 'user', type: 'user', required: false }],
  snipe: [],
  editsnipe: [],
  quote: [{ name: 'message_id', type: 'string', required: true }],
  vote: [{ name: 'question', type: 'string_rest', required: true }],
  announce: [{ name: 'message', type: 'string_rest', required: true }],

  // Fun (nye)
  ascii: [{ name: 'text', type: 'string_rest', required: true }],
  mock: [{ name: 'text', type: 'string_rest', required: true }],
  reverse: [{ name: 'text', type: 'string_rest', required: true }],
  fact: [],

  // Economy (nye)
  shop: [],
  buy: [{ name: 'item', type: 'string_rest', required: true }],
  inventory: [],
  crime: [],
  weekly: [],
  slots: [{ name: 'bet', type: 'integer', required: true }],
  gamble: [{ name: 'bet', type: 'integer', required: true }],
  roulette: [
    { name: 'bet', type: 'integer', required: true },
    { name: 'choice', type: 'string', required: true },
  ],

  // Leveling admin (nye)
  addxp: [
    { name: 'user', type: 'user', required: true },
    { name: 'amount', type: 'integer', required: true },
  ],
  removexp: [
    { name: 'user', type: 'user', required: true },
    { name: 'amount', type: 'integer', required: true },
  ],
  setxp: [
    { name: 'user', type: 'user', required: true },
    { name: 'amount', type: 'integer', required: true },
  ],
  setlevel: [
    { name: 'user', type: 'user', required: true },
    { name: 'level', type: 'integer', required: true },
  ],
  resetxp: [{ name: 'user', type: 'user', required: true }],
  resetleaderboard: [],

  // Aliaser
  close: [{ name: 'delete', type: 'boolean', required: false }],
  claim: [],
  unclaim: [],
  add: [{ name: 'user', type: 'user', required: true }],
  rename: [{ name: 'name', type: 'string_rest', required: true }],
  glist: [],
};


// Subcommand-based commands need special handling
const SUBCOMMAND_ARGS = {
  giveaway: {
    start: [
      { name: 'prize', type: 'string', required: true },
      { name: 'duration', type: 'string', required: true },
      { name: 'winners', type: 'integer', required: false },
      { name: 'description', type: 'string_rest', required: false },
    ],
    end: [{ name: 'message_id', type: 'string', required: true }],
    reroll: [{ name: 'message_id', type: 'string', required: true }],
  },
};

/**
 * Parse user mentions or IDs from message content
 */
function resolveUser(client, guild, arg) {
  if (!arg) return null;
  // <@!123> or <@123>
  const mentionMatch = arg.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return client.users.cache.get(mentionMatch[1]) || null;
  }
  // Raw ID
  if (/^\d{17,20}$/.test(arg)) {
    return client.users.cache.get(arg) || null;
  }
  return null;
}

function resolveRole(guild, arg) {
  if (!arg || !guild) return null;
  const mentionMatch = arg.match(/^<@&(\d+)>$/);
  if (mentionMatch) return guild.roles.cache.get(mentionMatch[1]) || null;
  if (/^\d{17,20}$/.test(arg)) return guild.roles.cache.get(arg) || null;
  return guild.roles.cache.find(r => r.name.toLowerCase() === arg.toLowerCase()) || null;
}

function resolveChannel(guild, arg) {
  if (!arg) return null;
  const mentionMatch = arg.match(/^<#(\d+)>$/);
  if (mentionMatch) {
    return guild.channels.cache.get(mentionMatch[1]) || null;
  }
  if (/^\d{17,20}$/.test(arg)) {
    return guild.channels.cache.get(arg) || null;
  }
  return null;
}

/**
 * Parse arguments from message content based on command argument definitions
 */
function parseArgs(client, message, args, argDefs) {
  const parsed = {};
  let argIndex = 0;

  for (const def of argDefs) {
    if (argIndex >= args.length && def.required) {
      return { error: `Mangler påkrævet argument: \`${def.name}\`` };
    }

    if (argIndex >= args.length) continue;

    switch (def.type) {
      case 'user': {
        const user = resolveUser(client, message.guild, args[argIndex]);
        if (def.required && !user) {
          // Try fetching
          const id = args[argIndex]?.replace(/[<@!>]/g, '');
          if (id && /^\d{17,20}$/.test(id)) {
            parsed[def.name] = { id, tag: id, displayAvatarURL: () => null, username: id, send: async () => {} };
          } else {
            return { error: `Kunne ikke finde bruger: \`${args[argIndex]}\`` };
          }
        } else if (user) {
          parsed[def.name] = user;
        }
        argIndex++;
        break;
      }
      case 'channel': {
        const channel = resolveChannel(message.guild, args[argIndex]);
        if (channel) {
          parsed[def.name] = channel;
          argIndex++;
        }
        break;
      }
      case 'integer': {
        const num = parseInt(args[argIndex], 10);
        if (isNaN(num)) {
          if (def.required) return { error: `\`${def.name}\` skal være et tal` };
          // Skip - might be part of next argument
        } else {
          parsed[def.name] = num;
          argIndex++;
        }
        break;
      }
      case 'boolean': {
        const val = args[argIndex]?.toLowerCase();
        if (['true', 'yes', 'ja', '1'].includes(val)) {
          parsed[def.name] = true;
          argIndex++;
        } else if (['false', 'no', 'nej', '0'].includes(val)) {
          parsed[def.name] = false;
          argIndex++;
        }
        break;
      }
      case 'role': {
        const role = resolveRole(message.guild, args[argIndex]);
        if (role) {
          parsed[def.name] = role;
          argIndex++;
        } else if (def.required) {
          return { error: `Kunne ikke finde rollen: \`${args[argIndex]}\`` };
        }
        break;
      }
      case 'number': {
        const num = parseFloat(String(args[argIndex]).replace(',', '.'));
        if (isNaN(num)) {
          if (def.required) return { error: `\`${def.name}\` skal være et tal` };
        } else {
          parsed[def.name] = num;
          argIndex++;
        }
        break;
      }
      case 'string': {
        parsed[def.name] = args[argIndex];
        argIndex++;
        break;
      }
      case 'string_rest': {
        // Consume all remaining args as a single string
        parsed[def.name] = args.slice(argIndex).join(' ');
        argIndex = args.length;
        break;
      }
    }
  }

  return { parsed };
}

/**
 * Create a fake interaction-like object from a message
 */
function createFakeInteraction(client, message, commandName, parsedArgs, subcommand = null) {
  let _deferred = false;
  let _replied = false;

  const interaction = {
    // Core properties
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    commandName,
    createdTimestamp: message.createdTimestamp,

    get deferred() { return _deferred; },
    get replied() { return _replied; },

    // Options mock
    options: {
      getUser: (name) => parsedArgs[name] || null,
      getString: (name) => parsedArgs[name] != null ? String(parsedArgs[name]) : null,
      getInteger: (name) => parsedArgs[name] != null ? parseInt(parsedArgs[name], 10) : null,
      getBoolean: (name) => parsedArgs[name] != null ? Boolean(parsedArgs[name]) : null,
      getChannel: (name) => parsedArgs[name] || null,
      getSubcommand: () => subcommand,
      getSubcommandGroup: () => null,
      data: subcommand ? [{ options: [{ options: [] }] }] : undefined,
    },

    // Reply methods
    reply: async (content) => {
      _replied = true;
      if (typeof content === 'string') {
        return message.reply(content);
      }
      // Handle flags: 64 (ephemeral) — in prefix mode just reply normally
      const { flags, ...rest } = content;
      return message.reply(rest);
    },

    deferReply: async (opts) => {
      _deferred = true;
      // Send typing indicator as a "defer"
      try { await message.channel.sendTyping(); } catch {}
      // Store a reference so editReply works
      interaction._deferMessage = null;
      return {};
    },

    editReply: async (content) => {
      _replied = true;
      if (typeof content === 'string') {
        if (interaction._lastReply) {
          try { return await interaction._lastReply.edit(content); } catch {}
        }
        return message.reply(content);
      }
      const { flags, ...rest } = content || {};
      if (interaction._lastReply) {
        try { return await interaction._lastReply.edit(rest); } catch {}
      }
      const sent = await message.reply(rest);
      interaction._lastReply = sent;
      return sent;
    },

    followUp: async (content) => {
      if (typeof content === 'string') return message.channel.send(content);
      const { flags, ...rest } = content;
      return message.channel.send(rest);
    },

    // For commands that use fetchReply: true
    _lastReply: null,
  };

  // Override reply to capture for editReply
  const origReply = interaction.reply;
  interaction.reply = async (content) => {
    const result = await origReply(content);
    interaction._lastReply = result;
    return result;
  };

  // Override deferReply - send a placeholder message for editReply to use
  interaction.deferReply = async (opts) => {
    _deferred = true;
    try {
      const placeholder = await message.reply('⏳ Behandler...');
      interaction._lastReply = placeholder;
    } catch {
      try { await message.channel.sendTyping(); } catch {}
    }
    return {};
  };

  return interaction;
}

/**
 * Get the prefix for a guild (cached)
 */
async function getGuildPrefix(guildDiscordId) {
  const cached = prefixCache.get(guildDiscordId);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.prefix;

  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guildDiscordId)
      .single();

    if (!guild) {
      prefixCache.set(guildDiscordId, { prefix: '!', time: Date.now() });
      return '!';
    }

    const { data: settings } = await supabase
      .from('guild_bot_settings')
      .select('command_prefix')
      .eq('guild_id', guild.id)
      .maybeSingle();

    const prefix = settings?.command_prefix || '!';
    prefixCache.set(guildDiscordId, { prefix, time: Date.now() });
    return prefix;
  } catch {
    return '!';
  }
}

/**
 * Setup the prefix command handler
 * @param {Object} slashHandlers - The same handler object from createSlashHandlers()
 * @param {Function} isCommandEnabled - Function to check if a command is enabled
 * @param {Function} shouldHandleGuild - Guild filter function
 */
function setupPrefixHandler(client, slashHandlers, { shouldHandleGuild, isCommandEnabled }) {
  client.on('messageCreate', async (message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

    const prefix = await getGuildPrefix(message.guild.id);
    const content = message.content;

    // Check if message starts with prefix
    if (!content.startsWith(prefix)) return;

    // Parse command and args
    const withoutPrefix = content.slice(prefix.length).trim();
    if (!withoutPrefix) return;

    const allArgs = withoutPrefix.split(/\s+/);
    let commandName = allArgs[0].toLowerCase();
    let args = allArgs.slice(1);
    let subcommand = null;

    // Handle subcommand-based commands
    if (SUBCOMMAND_ARGS[commandName]) {
      subcommand = args[0]?.toLowerCase();
      if (!subcommand || !SUBCOMMAND_ARGS[commandName][subcommand]) {
        const subs = Object.keys(SUBCOMMAND_ARGS[commandName]).join(', ');
        await message.reply(`❌ Brug: \`${prefix}${commandName} <${subs}>\``);
        return;
      }
      args = args.slice(1);
    }

    // Check if we have a handler for this command
    if (!slashHandlers[commandName]) return;

    // Check if command is enabled
    if (isCommandEnabled) {
      const enabled = await isCommandEnabled(message.guild.id, commandName);
      if (!enabled) {
        await message.reply('❌ Denne kommando er deaktiveret.');
        return;
      }
    }

    // Get arg definitions
    const argDefs = subcommand
      ? SUBCOMMAND_ARGS[commandName]?.[subcommand]
      : COMMAND_ARGS[commandName];

    if (!argDefs) {
      // No arg definition = command exists but no prefix mapping yet
      return;
    }

    // Parse arguments
    const { parsed, error } = parseArgs(client, message, args, argDefs);
    if (error) {
      await message.reply(`❌ ${error}`);
      return;
    }

    // For user args, try to fetch if not in cache
    for (const def of argDefs) {
      if (def.type === 'user' && parsed[def.name]?.id && !parsed[def.name]?.tag) {
        try {
          const fetchedUser = await client.users.fetch(parsed[def.name].id);
          if (fetchedUser) parsed[def.name] = fetchedUser;
        } catch {}
      }
    }

    // Create fake interaction
    const interaction = createFakeInteraction(client, message, commandName, parsed, subcommand);

    // Execute handler
    try {
      await slashHandlers[commandName](interaction);
    } catch (error) {
      console.error(`[Prefix] Fejl i command ${commandName}:`, error);
      try {
        await message.reply('❌ Der skete en fejl under udførelse af kommandoen.');
      } catch {}
    }
  });

  console.log(`[Prefix] Handler initialized — ${Object.keys(COMMAND_ARGS).length} commands available as prefix`);
}

module.exports = { setupPrefixHandler, getGuildPrefix };
