export interface Guild {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon: string | null;
  owner_id: string;
  command_prefix: string;
  log_channel_id: string | null;
  auto_moderation_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuildModule {
  id: string;
  guild_id: string;
  module_type: ModuleType;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuildCommand {
  id: string;
  guild_id: string;
  command_name: string;
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Database module types (can be toggled on/off in database)
export type DbModuleType = 'moderation' | 'music' | 'leveling' | 'utility' | 'fun' | 'economy' | 'tickets' | 'giveaway' | 'tebex';

// All command categories (includes db modules + additional categories)
export type CommandCategory = DbModuleType | 'admin' | 'reactionroles';

// For backwards compatibility
export type ModuleType = DbModuleType;

export interface ModuleInfo {
  type: CommandCategory;
  name: string;
  description: string;
  icon: string;
  commandCount: number;
}

export interface CommandInfo {
  name: string;
  description: string;
  category: string;
  usage: string;
}

// Helper function to get command count from COMMANDS_BY_CATEGORY
const getCommandCount = (category: CommandCategory): number => {
  // This will be calculated after COMMANDS_BY_CATEGORY is defined
  const counts: Record<CommandCategory, number> = {
    moderation: 16,
    music: 17,
    leveling: 10,
    utility: 26,
    fun: 20,
    economy: 16,
    tickets: 8,
    giveaway: 6,
    tebex: 1,
    admin: 12,
    reactionroles: 5,
  };
  return counts[category];
};

// Module info for toggleable modules (stored in database)
export const MODULE_INFO: Record<DbModuleType, Omit<ModuleInfo, 'type'>> = {
  moderation: {
    name: 'Moderation',
    description: 'Ban, kick, mute, warn, and manage server members',
    icon: 'Shield',
    commandCount: getCommandCount('moderation'),
  },
  music: {
    name: 'Music',
    description: 'Play music from YouTube, Spotify, and more',
    icon: 'Music',
    commandCount: getCommandCount('music'),
  },
  leveling: {
    name: 'Leveling',
    description: 'XP system, leaderboards, and level roles',
    icon: 'TrendingUp',
    commandCount: getCommandCount('leveling'),
  },
  utility: {
    name: 'Utility',
    description: 'Server info, user lookup, polls, and more',
    icon: 'Wrench',
    commandCount: getCommandCount('utility'),
  },
  fun: {
    name: 'Fun',
    description: 'Games, memes, and entertainment commands',
    icon: 'Gamepad2',
    commandCount: getCommandCount('fun'),
  },
  economy: {
    name: 'Economy',
    description: 'Virtual currency, shop, gambling, and trading',
    icon: 'Coins',
    commandCount: getCommandCount('economy'),
  },
  tickets: {
    name: 'Tickets',
    description: 'Support ticket system and management',
    icon: 'Ticket',
    commandCount: getCommandCount('tickets'),
  },
  giveaway: {
    name: 'Giveaway',
    description: 'Create and manage giveaways',
    icon: 'Gift',
    commandCount: getCommandCount('giveaway'),
  },
  tebex: {
    name: 'Tebex',
    description: 'Verify Tebex purchases and transactions',
    icon: 'ShoppingCart',
    commandCount: getCommandCount('tebex'),
  },
};

// Additional category info for non-toggleable command categories
export const CATEGORY_INFO: Record<CommandCategory, Omit<ModuleInfo, 'type'>> = {
  ...MODULE_INFO,
  admin: {
    name: 'Admin',
    description: 'Server setup and configuration commands',
    icon: 'Settings',
    commandCount: getCommandCount('admin'),
  },
  reactionroles: {
    name: 'Reaction Roles',
    description: 'Reaction role panel management',
    icon: 'Smile',
    commandCount: getCommandCount('reactionroles'),
  },
};

export const COMMANDS_BY_CATEGORY: Record<string, CommandInfo[]> = {
  moderation: [
    { name: 'ban', description: 'Ban a user from the server', category: 'moderation', usage: '/ban @user [reason]' },
    { name: 'kick', description: 'Kick a user from the server', category: 'moderation', usage: '/kick @user [reason]' },
    { name: 'mute', description: 'Mute a user', category: 'moderation', usage: '/mute @user [duration] [reason]' },
    { name: 'unmute', description: 'Unmute a user', category: 'moderation', usage: '/unmute @user' },
    { name: 'warn', description: 'Warn a user', category: 'moderation', usage: '/warn @user [reason]' },
    { name: 'warnings', description: 'View warnings for a user', category: 'moderation', usage: '/warnings @user' },
    { name: 'clearwarns', description: 'Clear warnings for a user', category: 'moderation', usage: '/clearwarns @user' },
    { name: 'clear', description: 'Clear messages from a channel', category: 'moderation', usage: '/clear [amount]' },
    { name: 'slowmode', description: 'Set slowmode for a channel', category: 'moderation', usage: '/slowmode [seconds]' },
    { name: 'lock', description: 'Lock a channel', category: 'moderation', usage: '/lock [channel]' },
    { name: 'unlock', description: 'Unlock a channel', category: 'moderation', usage: '/unlock [channel]' },
    { name: 'softban', description: 'Softban a user (ban and unban)', category: 'moderation', usage: '/softban @user [reason]' },
    { name: 'unban', description: 'Unban a user', category: 'moderation', usage: '/unban [user-id]' },
    { name: 'timeout', description: 'Timeout a user', category: 'moderation', usage: '/timeout @user [duration] [reason]' },
    { name: 'untimeout', description: 'Remove timeout from a user', category: 'moderation', usage: '/untimeout @user' },
    { name: 'nuke', description: 'Delete and recreate a channel', category: 'moderation', usage: '/nuke [channel]' },
  ],
  music: [
    { name: 'play', description: 'Play a song', category: 'music', usage: '/play [song]' },
    { name: 'pause', description: 'Pause the current song', category: 'music', usage: '/pause' },
    { name: 'resume', description: 'Resume playback', category: 'music', usage: '/resume' },
    { name: 'skip', description: 'Skip the current song', category: 'music', usage: '/skip' },
    { name: 'stop', description: 'Stop playback and clear queue', category: 'music', usage: '/stop' },
    { name: 'queue', description: 'View the song queue', category: 'music', usage: '/queue' },
    { name: 'nowplaying', description: 'Show current song', category: 'music', usage: '/nowplaying' },
    { name: 'volume', description: 'Set the volume', category: 'music', usage: '/volume [0-100]' },
    { name: 'shuffle', description: 'Shuffle the queue', category: 'music', usage: '/shuffle' },
    { name: 'loop', description: 'Toggle loop mode', category: 'music', usage: '/loop [off/song/queue]' },
    { name: 'seek', description: 'Seek to a position', category: 'music', usage: '/seek [time]' },
    { name: 'lyrics', description: 'Get lyrics for current song', category: 'music', usage: '/lyrics' },
    { name: 'remove', description: 'Remove a song from queue', category: 'music', usage: '/remove [position]' },
    { name: 'move', description: 'Move a song in queue', category: 'music', usage: '/move [from] [to]' },
    { name: 'jump', description: 'Jump to a song in queue', category: 'music', usage: '/jump [position]' },
    { name: 'autoplay', description: 'Toggle autoplay mode', category: 'music', usage: '/autoplay' },
    { name: 'filter', description: 'Apply audio filter', category: 'music', usage: '/filter [filter-name]' },
  ],
  leveling: [
    { name: 'rank', description: 'View your rank', category: 'leveling', usage: '/rank [@user]' },
    { name: 'leaderboard', description: 'View the leaderboard', category: 'leveling', usage: '/leaderboard' },
    { name: 'setxp', description: 'Set XP for a user', category: 'leveling', usage: '/setxp @user [amount]' },
    { name: 'addxp', description: 'Add XP to a user', category: 'leveling', usage: '/addxp @user [amount]' },
    { name: 'removexp', description: 'Remove XP from a user', category: 'leveling', usage: '/removexp @user [amount]' },
    { name: 'resetxp', description: 'Reset XP for a user', category: 'leveling', usage: '/resetxp @user' },
    { name: 'levelroles', description: 'View level roles', category: 'leveling', usage: '/levelroles' },
    { name: 'setlevelrole', description: 'Set a level role', category: 'leveling', usage: '/setlevelrole [level] @role' },
    { name: 'xpmultiplier', description: 'Set XP multiplier for a role', category: 'leveling', usage: '/xpmultiplier @role [multiplier]' },
    { name: 'resetleaderboard', description: 'Reset the entire leaderboard', category: 'leveling', usage: '/resetleaderboard' },
  ],
  utility: [
    { name: 'help', description: 'Show help menu', category: 'utility', usage: '/help [command]' },
    { name: 'ping', description: 'Check bot latency', category: 'utility', usage: '/ping' },
    { name: 'serverinfo', description: 'View server information', category: 'utility', usage: '/serverinfo' },
    { name: 'userinfo', description: 'View user information', category: 'utility', usage: '/userinfo [@user]' },
    { name: 'avatar', description: 'View user avatar', category: 'utility', usage: '/avatar [@user]' },
    { name: 'banner', description: 'View user banner', category: 'utility', usage: '/banner [@user]' },
    { name: 'poll', description: 'Create a poll', category: 'utility', usage: '/poll [question] [options]' },
    { name: 'remind', description: 'Set a reminder', category: 'utility', usage: '/remind [time] [message]' },
    { name: 'afk', description: 'Set AFK status', category: 'utility', usage: '/afk [reason]' },
    { name: 'embed', description: 'Create an embed', category: 'utility', usage: '/embed' },
    { name: 'roleinfo', description: 'View role information', category: 'utility', usage: '/roleinfo @role' },
    { name: 'channelinfo', description: 'View channel information', category: 'utility', usage: '/channelinfo [#channel]' },
    { name: 'emojis', description: 'List server emojis', category: 'utility', usage: '/emojis' },
    { name: 'roles', description: 'List server roles', category: 'utility', usage: '/roles' },
    { name: 'members', description: 'Server member count', category: 'utility', usage: '/members' },
    { name: 'invite', description: 'Get bot invite link', category: 'utility', usage: '/invite' },
    { name: 'support', description: 'Get support server link', category: 'utility', usage: '/support' },
    { name: 'vote', description: 'Vote for the bot', category: 'utility', usage: '/vote' },
    { name: 'stats', description: 'Bot statistics', category: 'utility', usage: '/stats' },
    { name: 'uptime', description: 'Bot uptime', category: 'utility', usage: '/uptime' },
    { name: 'snipe', description: 'Snipe deleted messages', category: 'utility', usage: '/snipe' },
    { name: 'editsnipe', description: 'Snipe edited messages', category: 'utility', usage: '/editsnipe' },
    { name: 'translate', description: 'Translate text', category: 'utility', usage: '/translate [language] [text]' },
    { name: 'weather', description: 'Get weather information', category: 'utility', usage: '/weather [location]' },
    { name: 'calculate', description: 'Calculator', category: 'utility', usage: '/calculate [expression]' },
    { name: 'globalban-report', description: 'Report a user to the global ban system', category: 'utility', usage: '/globalban-report @user [reason] [severity] [evidence]' },
  ],
  fun: [
    { name: '8ball', description: 'Ask the magic 8ball', category: 'fun', usage: '/8ball [question]' },
    { name: 'coinflip', description: 'Flip a coin', category: 'fun', usage: '/coinflip' },
    { name: 'dice', description: 'Roll a dice', category: 'fun', usage: '/dice [sides]' },
    { name: 'rps', description: 'Rock paper scissors', category: 'fun', usage: '/rps [choice]' },
    { name: 'trivia', description: 'Play trivia', category: 'fun', usage: '/trivia [category]' },
    { name: 'joke', description: 'Get a random joke', category: 'fun', usage: '/joke' },
    { name: 'meme', description: 'Get a random meme', category: 'fun', usage: '/meme' },
    { name: 'quote', description: 'Get an inspirational quote', category: 'fun', usage: '/quote' },
    { name: 'fact', description: 'Get a random fact', category: 'fun', usage: '/fact' },
    { name: 'ship', description: 'Ship two users', category: 'fun', usage: '/ship @user1 @user2' },
    { name: 'rate', description: 'Rate something', category: 'fun', usage: '/rate [thing]' },
    { name: 'reverse', description: 'Reverse text', category: 'fun', usage: '/reverse [text]' },
    { name: 'mock', description: 'Mock text', category: 'fun', usage: '/mock [text]' },
    { name: 'ascii', description: 'Convert text to ASCII art', category: 'fun', usage: '/ascii [text]' },
    { name: 'slots', description: 'Play slots', category: 'fun', usage: '/slots' },
    { name: 'roulette', description: 'Play roulette', category: 'fun', usage: '/roulette' },
    { name: 'ttt', description: 'Play tic-tac-toe', category: 'fun', usage: '/ttt @user' },
    { name: 'connect4', description: 'Play connect 4', category: 'fun', usage: '/connect4 @user' },
    { name: 'hangman', description: 'Play hangman', category: 'fun', usage: '/hangman' },
    { name: 'wordle', description: 'Play wordle', category: 'fun', usage: '/wordle' },
  ],
  economy: [
    { name: 'balance', description: 'Check your balance', category: 'economy', usage: '/balance [@user]' },
    { name: 'daily', description: 'Claim daily reward', category: 'economy', usage: '/daily' },
    { name: 'weekly', description: 'Claim weekly reward', category: 'economy', usage: '/weekly' },
    { name: 'work', description: 'Work to earn money', category: 'economy', usage: '/work' },
    { name: 'crime', description: 'Commit a crime (risky)', category: 'economy', usage: '/crime' },
    { name: 'rob', description: 'Rob another user', category: 'economy', usage: '/rob @user' },
    { name: 'pay', description: 'Pay another user', category: 'economy', usage: '/pay @user [amount]' },
    { name: 'deposit', description: 'Deposit money to bank', category: 'economy', usage: '/deposit [amount]' },
    { name: 'withdraw', description: 'Withdraw money from bank', category: 'economy', usage: '/withdraw [amount]' },
    { name: 'shop', description: 'View the shop', category: 'economy', usage: '/shop' },
    { name: 'buy', description: 'Buy an item', category: 'economy', usage: '/buy [item]' },
    { name: 'sell', description: 'Sell an item', category: 'economy', usage: '/sell [item]' },
    { name: 'inventory', description: 'View your inventory', category: 'economy', usage: '/inventory' },
    { name: 'richest', description: 'View richest users', category: 'economy', usage: '/richest' },
    { name: 'gamble', description: 'Gamble your money', category: 'economy', usage: '/gamble [amount]' },
    { name: 'blackjack', description: 'Play blackjack', category: 'economy', usage: '/blackjack [bet]' },
  ],
  tickets: [
    { name: 'ticket', description: 'Create a new ticket', category: 'tickets', usage: '/ticket [reason]' },
    { name: 'close', description: 'Close a ticket', category: 'tickets', usage: '/close [reason]' },
    { name: 'claim', description: 'Claim a ticket', category: 'tickets', usage: '/claim' },
    { name: 'unclaim', description: 'Unclaim a ticket', category: 'tickets', usage: '/unclaim' },
    { name: 'add', description: 'Add a user to the ticket', category: 'tickets', usage: '/add @user' },
    { name: 'remove', description: 'Remove a user from the ticket', category: 'tickets', usage: '/remove @user' },
    { name: 'transcript', description: 'Generate a transcript', category: 'tickets', usage: '/transcript' },
    { name: 'rename', description: 'Rename the ticket channel', category: 'tickets', usage: '/rename [name]' },
    { name: 'ticket-remind', description: 'Remind ticket owner to respond (auto-close after 12h)', category: 'tickets', usage: '/ticket-remind' },
  ],
  giveaway: [
    { name: 'giveaway', description: 'Create a giveaway', category: 'giveaway', usage: '/giveaway [duration] [winners] [prize]' },
    { name: 'gstart', description: 'Quick start a giveaway', category: 'giveaway', usage: '/gstart' },
    { name: 'gend', description: 'End a giveaway early', category: 'giveaway', usage: '/gend [message-id]' },
    { name: 'greroll', description: 'Reroll giveaway winners', category: 'giveaway', usage: '/greroll [message-id]' },
    { name: 'glist', description: 'List active giveaways', category: 'giveaway', usage: '/glist' },
    { name: 'gpause', description: 'Pause a giveaway', category: 'giveaway', usage: '/gpause [message-id]' },
  ],
  tebex: [
    { name: 'tebex-verify', description: 'Verificér et Tebex køb med transaktions-ID', category: 'tebex', usage: '/tebex-verify [transaction_id]' },
  ],
  admin: [
    { name: 'setup', description: 'Interactive server setup', category: 'admin', usage: '/setup' },
    { name: 'config', description: 'View/edit bot configuration', category: 'admin', usage: '/config [setting] [value]' },
    { name: 'prefix', description: 'Change command prefix', category: 'admin', usage: '/prefix [new-prefix]' },
    { name: 'setlog', description: 'Set logging channel', category: 'admin', usage: '/setlog [#channel]' },
    { name: 'autorole', description: 'Set auto-role on join', category: 'admin', usage: '/autorole [@role]' },
    { name: 'setwelcome', description: 'Configure welcome messages', category: 'admin', usage: '/setwelcome' },
    { name: 'setleave', description: 'Configure leave messages', category: 'admin', usage: '/setleave' },
    { name: 'setlevel', description: 'Configure leveling system', category: 'admin', usage: '/setlevel' },
    { name: 'automod', description: 'Configure auto-moderation', category: 'admin', usage: '/automod [rule] [action]' },
    { name: 'backup', description: 'Create server backup', category: 'admin', usage: '/backup create' },
    { name: 'restore', description: 'Restore server backup', category: 'admin', usage: '/restore [backup-id]' },
    { name: 'announce', description: 'Make an announcement', category: 'admin', usage: '/announce [#channel] [message]' },
  ],
  reactionroles: [
    { name: 'reactionrole', description: 'Create a reaction role panel', category: 'reactionroles', usage: '/reactionrole create' },
    { name: 'rr-add', description: 'Add a role to panel', category: 'reactionroles', usage: '/rr-add [message-id] [emoji] @role' },
    { name: 'rr-remove', description: 'Remove a role from panel', category: 'reactionroles', usage: '/rr-remove [message-id] [emoji]' },
    { name: 'rr-list', description: 'List all reaction roles', category: 'reactionroles', usage: '/rr-list' },
    { name: 'rr-clear', description: 'Clear all reaction roles from a message', category: 'reactionroles', usage: '/rr-clear [message-id]' },
  ],
};
