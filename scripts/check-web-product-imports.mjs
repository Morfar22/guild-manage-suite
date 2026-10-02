import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = walk('src');
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');

  if (source.includes('PUBLIC_PUBLIC_BOT_INVITE_URL')) {
    failures.push(`${file}: contains invalid PUBLIC_PUBLIC_BOT_INVITE_URL symbol`);
  }

  if (file !== path.normalize('src/lib/product.ts') && source.includes('PUBLIC_BOT_INVITE_URL')) {
    const imported =
      /import\s*\{[^}]*\bPUBLIC_BOT_INVITE_URL\b[^}]*\}\s*from\s*['"]@\/lib\/product['"]/.test(source);

    if (!imported) {
      failures.push(`${file}: uses PUBLIC_BOT_INVITE_URL without importing it from @/lib/product`);
    }
  }

  if (file !== path.normalize('src/lib/product.ts') && source.includes('buildBotInviteUrl(')) {
    const imported =
      /import\s*\{[^}]*\bbuildBotInviteUrl\b[^}]*\}\s*from\s*['"]@\/lib\/product['"]/.test(source);

    if (!imported) {
      failures.push(`${file}: uses buildBotInviteUrl without importing it from @/lib/product`);
    }
  }
}

if (failures.length) {
  console.error('Web product metadata check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Web product metadata check OK');
