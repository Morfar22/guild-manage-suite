import fs from 'node:fs';

const files = [
  'src/pages/Index.tsx',
  'src/pages/Auth.tsx',
  'src/pages/GuildSelect.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/PublicFeatures.tsx',
  'src/pages/Security.tsx',
  'src/pages/BotSettings.tsx',
  'src/components/dashboard/SetupProgress.tsx',
  'src/components/dashboard/DashboardSidebarContent.tsx',
];

function collectBindings(source) {
  const bindings = new Set();

  for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) {
    bindings.add(match[1]);
  }

  for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from/g)) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      if (!cleaned) continue;
      const alias = cleaned.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      const name = alias ? alias[1] : cleaned.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      if (name) bindings.add(name);
    }
  }

  for (const regex of [
    /(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g,
  ]) {
    for (const match of source.matchAll(regex)) bindings.add(match[1]);
  }

  return bindings;
}

const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const bindings = collectBindings(source);
  const jsxIdentifiers = new Set(
    [...source.matchAll(/<([A-Z][A-Za-z0-9_$]*)\b/g)].map((match) => match[1])
  );

  for (const identifier of jsxIdentifiers) {
    if (!bindings.has(identifier)) {
      failures.push(`${file}: JSX component ${identifier} is used but no import/local declaration was found`);
    }
  }
}

if (failures.length) {
  console.error('Web runtime symbol check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Web runtime symbol check OK');
