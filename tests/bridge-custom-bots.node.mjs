import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { timingSafeEqual } from 'node:crypto';

const source = readFileSync(new URL('../bot/bridge-server.js', import.meta.url), 'utf8');
const guild = '1501891897663295538';
const otherGuild = '1501891897663295539';
const secret = 'x'.repeat(64);

function bridge(configs, { configStatus = 200, discordStatus = 200 } = {}) {
  let handler;
  const calls = [];
  const removals = [];
  vm.runInNewContext(source, {
    require(name) {
      if (name === 'dotenv') return { config() {} };
      if (name === 'node:crypto') return { timingSafeEqual };
      if (name === 'node:http') return { createServer(fn) {
        handler = fn;
        return { listen() {} };
      } };
      throw Error(name);
    },
    process: { env: {
      GUILDOS_BRIDGE_SECRET: secret, DEFAULT_BOT_TOKEN: 'default-token',
      APP_API_BASE: 'https://app.example', BOT_SECRET_KEY: 'config-secret',
    } },
    Buffer, URL, AbortController,
    setTimeout: () => 1, clearTimeout: id => removals.push(id),
    console: { log() {}, error() {} },
    async fetch(url, options) {
      calls.push({ url: String(url), ...options });
      if (String(url).startsWith('https://app.example/')) return {
        ok: configStatus === 200, status: configStatus,
        json: async () => ({ configs }),
      };
      return {
        ok: discordStatus === 200, status: discordStatus,
        json: async () => String(url).endsWith('users/@me')
          ? { id: '1555371176224628787' } : [],
      };
    },
  });
  return { calls, removals, async request(suffix = 'channels', guildId = guild, authorized = true) {
    let status, body;
    await handler({
      url: `/v1/guilds/${guildId}/${suffix}`, method: 'GET',
      headers: { authorization: authorized ? `Bearer ${secret}` : '' },
    }, {
      writeHead(code) { status = code; },
      end(text) { body = JSON.parse(text); },
    });
    return { status, body };
  } };
}
const configs = [{ guild_id: 'internal-uuid', discord_guild_id: guild, bot_token: 'custom-token' }];

test('channels use the selected guild custom token and never expose it', async () => {
  const app = bridge(configs);
  const result = await app.request();
  assert.equal(result.status, 200);
  assert.equal(app.calls[0].headers['x-bot-secret'], 'config-secret');
  assert.equal(app.calls[0].redirect, 'error');
  assert.equal(app.calls[1].headers.Authorization, 'Bot custom-token');
  assert.deepEqual(result.body, { channels: [], categories: [] });
  assert.equal(app.removals.length, 1);
});
test('another guild uses the default bot, not another tenant token', async () => {
  const app = bridge(configs);
  assert.equal((await app.request('channels', otherGuild)).status, 200);
  assert.equal(app.calls[1].headers.Authorization, 'Bot default-token');
});
test('bot identity and subsequent member lookup use the same custom bot', async () => {
  const app = bridge(configs);
  assert.equal((await app.request('bot-member')).status, 200);
  assert.equal(app.calls.length, 3);
  for (const call of app.calls.slice(1)) assert.equal(call.headers.Authorization, 'Bot custom-token');
});
test('config failures and ambiguous or malformed configs fail closed', async () => {
  for (const app of [bridge([], { configStatus: 401 }), bridge(null),
    bridge([{ guild_id: 'uuid', bot_token: 'token' }]),
    bridge([{ discord_guild_id: guild, bot_token: null }]),
    bridge([...configs, ...configs])]) {
    const result = await app.request();
    assert.equal(result.status, 502);
    assert.equal(app.calls.length, 1);
    assert.equal(app.removals.length, 1);
    assert.equal(JSON.stringify(result).includes('token'), false);
  }
});
test('unauthenticated callers cannot fetch bot configuration', async () => {
  const app = bridge(configs);
  assert.equal((await app.request('channels', guild, false)).status, 401);
  assert.equal(app.calls.length, 0);
});
test('Discord missing access is preserved without fallback to default bot', async () => {
  const app = bridge(configs, { discordStatus: 403 });
  assert.equal((await app.request()).status, 403);
  assert.equal(app.calls.length, 2);
});
