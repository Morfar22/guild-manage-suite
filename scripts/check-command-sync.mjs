import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function extractBalanced(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error(`Unbalanced source starting at ${start}`);
}

function webDeployNames() {
  const source = read('src/routes/api/public/deploy-guild-commands.ts');
  const declaration = source.indexOf('const COMMANDS =');
  const start = source.indexOf('[', declaration);
  const literal = extractBalanced(source, start, '[', ']');
  return Function(`"use strict"; return (${literal});`)().map((command) => command.name);
}

function botDeployNames() {
  const source = read('bot/deployCommands.js');
  return [...source.matchAll(/new\s+SlashCommandBuilder\s*\(\s*\)\s*\.setName\s*\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((match) => match[1]);
}

function panelEntries() {
  const source = read('src/types/discord.ts');
  const declaration = source.indexOf('const COMMANDS_BY_CATEGORY:');
  const equals = source.indexOf('=', declaration);
  const start = source.indexOf('{', equals);
  const literal = extractBalanced(source, start, '{', '}');
  const catalog = Function(`"use strict"; return (${literal});`)();

  return Object.entries(catalog).flatMap(([category, commands]) =>
    commands.map((command) => ({ name: command.name, category }))
  );
}

function topLevelObjectKeys(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = source.indexOf('{', markerIndex);
  const object = extractBalanced(source, start, '{', '}');
  const keys = [];

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < object.length; i += 1) {
    const char = object[i];
    const next = object[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      continue;
    }

    if (depth === 1) {
      const match = object
        .slice(i)
        .match(/^\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$-]*))\s*:/);
      if (match) {
        keys.push(match[1] || match[2]);
        i += match[0].length - 1;
      }
    }
  }

  return keys;
}

function standaloneHandlerNames() {
  const ticket = read('bot/handlers/ticketHandler.js');
  const musicQuiz = read('bot/handlers/musicQuizHandler.js');
  const names = new Set();

  for (const source of [ticket, musicQuiz]) {
    for (const match of source.matchAll(/interaction\.commandName\s*(?:===|!==)\s*['"]([^'"]+)['"]/g)) {
      names.add(match[1]);
    }
    for (const match of source.matchAll(/\[([^\]]+)\]\.includes\(interaction\.commandName\)/g)) {
      for (const stringMatch of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
        names.add(stringMatch[1]);
      }
    }
  }

  return [...names];
}

function handlerNames() {
  const core = read('bot/bot.js');
  const extra = read('bot/handlers/extraCommands.js');
  const admin = read('bot/handlers/adminCommands.js');
  const games = read('bot/handlers/gameCommands.js');

  return [...new Set([
    ...topLevelObjectKeys(core, 'return {\n    // ==================== MODERATION'),
    ...topLevelObjectKeys(extra, 'return {\n    // ==================== UTILITY'),
    ...topLevelObjectKeys(admin, 'return {\n    // ---------- ADMIN'),
    ...topLevelObjectKeys(games, 'return {\n    // ==================== TRIVIA'),
    ...standaloneHandlerNames(),
  ])];
}

const unique = (values) => [...new Set(values)];
const difference = (left, right) => unique(left).filter((value) => !new Set(right).has(value)).sort();
const duplicates = (values) => unique(values.filter((value, index) => values.indexOf(value) !== index)).sort();

const web = webDeployNames();
const bot = botDeployNames();
const panel = panelEntries().map((entry) => entry.name);
const handlers = handlerNames();

const expectedPanel = unique([...web, 'fivem']).sort();
const failures = [];

const botVsWeb = difference(bot, web);
const webVsBot = difference(web, bot);
const panelMissing = difference(expectedPanel, panel);
const panelExtra = difference(panel, expectedPanel);
const handlerMissing = difference(expectedPanel, handlers);
const panelDuplicates = duplicates(panel);

if (botVsWeb.length) failures.push(`Bot deploy only: ${botVsWeb.join(', ')}`);
if (webVsBot.length) failures.push(`Web deploy only: ${webVsBot.join(', ')}`);
if (panelMissing.length) failures.push(`Missing from panel: ${panelMissing.join(', ')}`);
if (panelExtra.length) failures.push(`Panel-only commands: ${panelExtra.join(', ')}`);
if (handlerMissing.length) failures.push(`Missing handlers: ${handlerMissing.join(', ')}`);
if (panelDuplicates.length) failures.push(`Duplicate panel commands: ${panelDuplicates.join(', ')}`);

console.log('Command sync');
console.log(`  Web deploy:   ${unique(web).length}`);
console.log(`  Bot deploy:   ${unique(bot).length}`);
console.log(`  Panel:        ${unique(panel).length}`);
console.log(`  Handler union:${unique(handlers).length}`);
console.log('  FiveM:        separate /fivem registration');

if (unique(web).length > 100) {
  console.warn(
    `WARNING: Discord allows at most 100 guild CHAT_INPUT commands per app; the main catalog currently has ${unique(web).length}. Grouping commands into subcommands is required before all can be deployed simultaneously.`
  );
}

if (failures.length) {
  console.error('\nCommand synchronization FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nCommand synchronization OK.');
}
