import fs from 'node:fs';

const restricted = ['crime', 'slots', 'gamble', 'roulette', 'blackjack'];
const deploySource = fs.readFileSync(new URL('../bot/deployCommands.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../bot/bot.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../src/pages/Index.tsx', import.meta.url), 'utf8');
const guildSelectSource = fs.readFileSync(new URL('../src/pages/GuildSelect.tsx', import.meta.url), 'utf8');

const failures = [];

for (const command of restricted) {
  const quoted = [`'${command}'`, `"${command}"`];
  if (!quoted.some((value) => deploySource.includes(value))) {
    failures.push(`deployCommands.js mangler Discovery-blokering for ${command}`);
  }
  if (!quoted.some((value) => runtimeSource.includes(value))) {
    failures.push(`bot.js mangler runtime-blokering for ${command}`);
  }
}

if (!deploySource.includes('removeDiscoveryRestrictedRoutes')) {
  failures.push('deployCommands.js filtrerer ikke Discovery-begrænsede routes');
}

if (!runtimeSource.includes('delete slashHandlers[commandName]')) {
  failures.push('bot.js deaktiverer ikke Discovery-begrænsede handlers på default-botten');
}

for (const [name, source] of [
  ['Index.tsx', indexSource],
  ['GuildSelect.tsx', guildSelectSource],
]) {
  if (/permissions=8(?:&|\`|"|'|$)/.test(source) || /BOT_PERMISSIONS\s*=\s*['"]8['"]/.test(source)) {
    failures.push(`${name} bruger stadig Administrator-permission i offentligt bot-invite`);
  }
}

if (failures.length > 0) {
  console.error('Discovery safety check fejlede:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Discovery safety check OK');
console.log(`Restricted commands on official app: ${restricted.join(', ')}`);
