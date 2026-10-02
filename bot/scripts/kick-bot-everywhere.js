'use strict';

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require('discord.js');

const DEFAULT_TARGET_BOT_ID = '1067179642391363654';
const targetBotId = process.argv.find((arg) => /^\d{17,20}$/.test(arg)) || DEFAULT_TARGET_BOT_ID;
const execute = process.argv.includes('--execute');
const forceNonBot = process.argv.includes('--force-non-bot');

const APP_API_BASE = process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk';
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY || '';

const DEFAULT_TOKEN_CANDIDATES = [
  ['DEFAULT_BOT_TOKEN', process.env.DEFAULT_BOT_TOKEN],
  ['DISCORD_TOKEN', process.env.DISCORD_TOKEN],
  ['DISCORD_BOT_TOKEN', process.env.DISCORD_BOT_TOKEN],
].filter(([, token]) => typeof token === 'string' && token.trim().length > 20);

function maskToken(token) {
  if (!token) return '(missing)';
  return `${token.slice(0, 5)}...${token.slice(-4)}`;
}

async function fetchCustomBotConfigs() {
  if (!BOT_SECRET_KEY) {
    console.warn('[KickBotEverywhere] BOT_SECRET_KEY mangler. Scanner kun default bot-token(s).');
    return [];
  }

  const response = await fetch(`${APP_API_BASE}/api/public/guild-bot-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET_KEY,
    },
    body: JSON.stringify({ action: 'list_active' }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Kunne ikke hente custom bot configs (HTTP ${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.configs) ? payload.configs : [];
}

async function loginClient(token, label) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.setMaxListeners(20);

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Discord ready timeout efter 20 sekunder')), 20_000);
    client.once('clientReady', () => {
      clearTimeout(timer);
      resolve();
    });
    client.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  await client.login(token);
  await ready;

  console.log(
    `[KickBotEverywhere] ✅ ${label}: ${client.user.tag} (${client.user.id}) · ${client.guilds.cache.size} guild(s)`
  );

  return client;
}

async function scanClient(client, sourceLabel, state) {
  if (client.user.id === targetBotId) {
    console.log(`[KickBotEverywhere] ⏭️  ${sourceLabel} er target-botten selv. Springer over.`);
    return;
  }

  for (const [, guild] of client.guilds.cache) {
    const key = guild.id;
    const existing = state.guilds.get(key) || {
      guildId: guild.id,
      guildName: guild.name,
      found: false,
      kicked: false,
      attempts: [],
    };

    if (existing.kicked) {
      state.guilds.set(key, existing);
      continue;
    }

    let targetMember;
    try {
      targetMember = guild.members.cache.get(targetBotId)
        || await guild.members.fetch(targetBotId);
    } catch {
      existing.attempts.push({
        source: sourceLabel,
        status: 'not-present',
      });
      state.guilds.set(key, existing);
      continue;
    }

    existing.found = true;

    if (!targetMember.user.bot && !forceNonBot) {
      existing.attempts.push({
        source: sourceLabel,
        status: 'refused-non-bot',
      });
      state.guilds.set(key, existing);
      console.error(
        `[KickBotEverywhere] 🛑 ${guild.name}: target ${targetBotId} er ikke en bot-konto. Brug kun --force-non-bot hvis det er helt bevidst.`
      );
      continue;
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const hasKickPermission = Boolean(me?.permissions?.has(PermissionFlagsBits.KickMembers));
    const kickable = Boolean(targetMember.kickable);

    if (!hasKickPermission || !kickable) {
      const reason = !hasKickPermission
        ? 'mangler Kick Members'
        : 'rollehierarki/Discord tillader ikke kick';

      existing.attempts.push({
        source: sourceLabel,
        status: 'not-kickable',
        reason,
      });
      state.guilds.set(key, existing);

      console.warn(
        `[KickBotEverywhere] ⚠️  ${guild.name} (${guild.id}): target fundet, men ${sourceLabel} kan ikke kicke den: ${reason}`
      );
      continue;
    }

    if (!execute) {
      existing.attempts.push({
        source: sourceLabel,
        status: 'would-kick',
      });
      state.guilds.set(key, existing);
      console.log(
        `[KickBotEverywhere] 🔎 DRY RUN: ${guild.name} (${guild.id}) · ${sourceLabel} kan kicke ${targetMember.user.tag}`
      );
      continue;
    }

    try {
      await targetMember.kick(
        `GuildOS Bot global cleanup: removing bot ID ${targetBotId}`
      );

      existing.kicked = true;
      existing.attempts.push({
        source: sourceLabel,
        status: 'kicked',
      });

      state.guilds.set(key, existing);
      console.log(
        `[KickBotEverywhere] ✅ KICKET: ${targetMember.user.tag} fra ${guild.name} (${guild.id}) via ${sourceLabel}`
      );
    } catch (error) {
      existing.attempts.push({
        source: sourceLabel,
        status: 'kick-error',
        reason: error?.message || String(error),
      });
      state.guilds.set(key, existing);
      console.error(
        `[KickBotEverywhere] ❌ ${guild.name} (${guild.id}): kick fejlede via ${sourceLabel}: ${error?.message || error}`
      );
    }
  }
}

async function main() {
  console.log('');
  console.log('==============================================');
  console.log(' GuildOS Bot · Global Bot Removal');
  console.log('==============================================');
  console.log(`Target bot ID: ${targetBotId}`);
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log('');

  const customConfigs = await fetchCustomBotConfigs();

  const tokenSources = [];
  for (const [source, token] of DEFAULT_TOKEN_CANDIDATES) {
    tokenSources.push({
      label: `main:${source}`,
      token: token.trim(),
    });
  }

  for (const config of customConfigs) {
    if (!config?.bot_token) continue;
    tokenSources.push({
      label: `custom:${config.bot_name || config.guild_id}`,
      token: String(config.bot_token).trim(),
    });
  }

  const uniqueTokens = [];
  const seenTokens = new Set();
  for (const item of tokenSources) {
    if (!item.token || seenTokens.has(item.token)) continue;
    seenTokens.add(item.token);
    uniqueTokens.push(item);
  }

  if (!uniqueTokens.length) {
    throw new Error('Ingen bot-tokens fundet. Kontrollér .env og/eller BOT_SECRET_KEY.');
  }

  console.log(
    `[KickBotEverywhere] Scanner med ${uniqueTokens.length} unik bot-token(s) (${DEFAULT_TOKEN_CANDIDATES.length} main candidate(s), ${customConfigs.length} custom config(s)).`
  );

  const state = {
    guilds: new Map(),
    clientsOk: 0,
    clientsFailed: 0,
  };

  for (const source of uniqueTokens) {
    let client = null;
    try {
      console.log(
        `\n[KickBotEverywhere] Logger ind: ${source.label} [${maskToken(source.token)}]`
      );

      client = await loginClient(source.token, source.label);
      state.clientsOk += 1;
      await scanClient(client, source.label, state);
    } catch (error) {
      state.clientsFailed += 1;
      console.error(
        `[KickBotEverywhere] ❌ ${source.label} kunne ikke bruges: ${error?.message || error}`
      );
    } finally {
      try {
        client?.destroy();
      } catch {}
    }
  }

  const guildRows = [...state.guilds.values()];
  const found = guildRows.filter((row) => row.found);
  const kicked = guildRows.filter((row) => row.kicked);
  const wouldKick = guildRows.filter((row) =>
    row.attempts.some((attempt) => attempt.status === 'would-kick')
  );
  const blocked = guildRows.filter((row) =>
    row.found &&
    !row.kicked &&
    !row.attempts.some((attempt) => attempt.status === 'would-kick')
  );

  console.log('');
  console.log('================ SUMMARY ====================');
  console.log(`Clients OK:       ${state.clientsOk}`);
  console.log(`Clients failed:   ${state.clientsFailed}`);
  console.log(`Guilds scanned:   ${guildRows.length}`);
  console.log(`Target fundet:    ${found.length}`);
  if (execute) {
    console.log(`Kicked:           ${kicked.length}`);
  } else {
    console.log(`Kan kickes:       ${wouldKick.length}`);
  }
  console.log(`Blokeret:         ${blocked.length}`);
  console.log('=============================================');

  if (!execute && wouldKick.length > 0) {
    console.log('');
    console.log('Dry-run færdig. Kør igen med --execute for at udføre kicks:');
    console.log(`node scripts/kick-bot-everywhere.js ${targetBotId} --execute`);
  }

  if (blocked.length) {
    console.log('');
    console.log('Servere hvor target blev fundet men ikke kunne fjernes:');
    for (const row of blocked) {
      const reasons = row.attempts
        .filter((attempt) => attempt.status !== 'not-present')
        .map((attempt) => `${attempt.source}: ${attempt.reason || attempt.status}`)
        .join(' | ');
      console.log(`- ${row.guildName} (${row.guildId}): ${reasons || 'ukendt'}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[KickBotEverywhere] FATAL:', error?.stack || error);
    process.exit(1);
  });
