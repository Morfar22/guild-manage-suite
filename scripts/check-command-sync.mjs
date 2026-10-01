import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const routeConfig = JSON.parse(read('shared/command-routes.json'));

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

function webFlatCommands() {
  const source = read('src/routes/api/public/deploy-guild-commands.ts');
  const declaration = source.indexOf('const COMMANDS =');
  const start = source.indexOf('[', declaration);
  const literal = extractBalanced(source, start, '[', ']');
  return Function(`"use strict"; return (${literal});`)();
}

function botFlatNames() {
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

function handlerNames() {
  const core = read('bot/bot.js');
  const extra = read('bot/handlers/extraCommands.js');
  const admin = read('bot/handlers/adminCommands.js');
  const games = read('bot/handlers/gameCommands.js');
  const advancedModeration = read('bot/handlers/advancedModeration.js');
  const tickets = read('bot/handlers/ticketHandler.js');
  const musicQuiz = read('bot/handlers/musicQuizHandler.js');

  const names = new Set([
    ...topLevelObjectKeys(core, 'return {\n    // ==================== MODERATION'),
    ...topLevelObjectKeys(extra, 'return {\n    // ==================== UTILITY'),
    ...topLevelObjectKeys(admin, 'return {\n    // ---------- ADMIN'),
    ...topLevelObjectKeys(games, 'return {\n    // ==================== TRIVIA'),
    ...[...advancedModeration.matchAll(/^    ([a-z][a-z0-9-]*): async \(interaction\) => \{/gm)]
      .map((match) => match[1]),
  ]);

  for (const match of tickets.matchAll(/commandName\s*===\s*['"]([^'"]+)['"]/g)) {
    names.add(match[1]);
  }

  if (musicQuiz.includes("startsWith('musicquiz-')")) names.add('musicquiz');

  return [...names];
}

const unique = (values) => [...new Set(values)];
const difference = (left, right) => unique(left).filter((value) => !new Set(right).has(value)).sort();
const duplicates = (values) => unique(values.filter((value, index) => values.indexOf(value) !== index)).sort();

const routes = routeConfig.routes || [];
const webFlat = webFlatCommands();
const webFlatNames = webFlat.map((command) => command.name);
const botFlat = botFlatNames();
const panel = panelEntries();
const handlers = handlerNames();

const canonical = routes.map((route) => route.logical);
const failures = [];

const canonicalDuplicates = duplicates(canonical);
const panelDuplicates = duplicates(panel.map((entry) => entry.name));
const pathKeys = routes
  .filter((route) => !route.passthrough)
  .map((route) => [route.root, route.group || '', route.sub || ''].join(':'));
const pathDuplicates = duplicates(pathKeys);

if (canonicalDuplicates.length) failures.push(`Duplicate logical routes: ${canonicalDuplicates.join(', ')}`);
if (panelDuplicates.length) failures.push(`Duplicate panel commands: ${panelDuplicates.join(', ')}`);
if (pathDuplicates.length) failures.push(`Duplicate Discord paths: ${pathDuplicates.join(', ')}`);

const panelNames = panel.map((entry) => entry.name);
const panelMissing = difference(canonical, panelNames);
const panelExtra = difference(panelNames, canonical);
if (panelMissing.length) failures.push(`Missing from panel: ${panelMissing.join(', ')}`);
if (panelExtra.length) failures.push(`Panel-only commands: ${panelExtra.join(', ')}`);

const webVsBot = difference(webFlatNames, botFlat);
const botVsWeb = difference(botFlat, webFlatNames);
if (webVsBot.length) failures.push(`Web flat definitions only: ${webVsBot.join(', ')}`);
if (botVsWeb.length) failures.push(`Bot flat definitions only: ${botVsWeb.join(', ')}`);

const webSources = new Set(webFlatNames);
const botSources = new Set(botFlat);
for (const route of routes) {
  if (!route.passthrough) {
    if (!webSources.has(route.source)) failures.push(`Web source missing for ${route.logical}: ${route.source}`);
    if (!botSources.has(route.source)) failures.push(`Bot source missing for ${route.logical}: ${route.source}`);
  }

  const handlerName = route.handler || route.source || route.logical;
  if (!handlers.includes(handlerName)) {
    failures.push(`Handler missing for ${route.logical}: ${handlerName}`);
  }
}

const rootMap = new Map();
for (const route of routes.filter((route) => !route.passthrough)) {
  if (!rootMap.has(route.root)) rootMap.set(route.root, { direct: 0, groups: new Map() });
  const root = rootMap.get(route.root);
  if (route.group) {
    root.groups.set(route.group, (root.groups.get(route.group) || 0) + 1);
  } else {
    root.direct += 1;
  }
}

for (const [rootName, root] of rootMap) {
  const optionCount = root.direct + root.groups.size;
  if (optionCount > 25) failures.push(`/${rootName} has ${optionCount}/25 top-level options`);
  for (const [groupName, count] of root.groups) {
    if (count > 25) failures.push(`/${rootName} ${groupName} has ${count}/25 subcommands`);
  }
}

const topLevelRoots = unique([
  ...routes.filter((route) => !route.passthrough).map((route) => route.root),
  ...routes.filter((route) => route.passthrough).map((route) => route.root),
]);

if (topLevelRoots.length > 100) {
  failures.push(`Discord top-level command limit exceeded: ${topLevelRoots.length}/100`);
}

console.log('Grouped command sync');
console.log(`  Canonical leaves: ${unique(canonical).length}`);
console.log(`  Panel leaves:     ${unique(panelNames).length}`);
console.log(`  Flat web sources: ${unique(webFlatNames).length}`);
console.log(`  Flat bot sources: ${unique(botFlat).length}`);
console.log(`  Handler names:    ${unique(handlers).length}`);
console.log(`  Discord roots:    ${topLevelRoots.length}/100`);
console.log(`  Roots:            ${topLevelRoots.map((root) => `/${root}`).join(', ')}`);

for (const [rootName, root] of rootMap) {
  const groupInfo = [...root.groups.entries()]
    .map(([name, count]) => `${name}=${count}`)
    .join(', ');
  console.log(
    `  /${rootName}: direct=${root.direct}, groups=${root.groups.size}${groupInfo ? ` (${groupInfo})` : ''}`
  );
}

if (failures.length) {
  console.error('\nCommand synchronization FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nCommand synchronization OK.');
}
