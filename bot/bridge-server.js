'use strict';
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
require('dotenv').config();

const host = process.env.GUILDOS_BRIDGE_HOST || '127.0.0.1';
const port = Number(process.env.GUILDOS_BRIDGE_PORT || 3187);
const secret = process.env.GUILDOS_BRIDGE_SECRET;
const token = process.env.DEFAULT_BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!secret || Buffer.byteLength(secret) < 32 || !token) {
  console.error('[guildos-bridge] GUILDOS_BRIDGE_SECRET (>=32 bytes) and bot token required');
  process.exit(1);
}
function authorized(header) {
  if (!header || !header.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7)), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
function reply(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  if (!authorized(req.headers.authorization)) return reply(res, 401, { error: 'Unauthorized' });
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  const guildResource = /^\/v1\/guilds\/(\d{16,22})\/(channels|roles|members|bot-member)$/.exec(path);
  const roleAction = /^\/v1\/guilds\/(\d{16,22})\/members\/(\d{16,22})\/roles\/(\d{16,22})$/.exec(path);
  if (!guildResource && !roleAction) return reply(res, 404, { error: 'Not found' });
  const guildId = guildResource?.[1] || roleAction?.[1];
  if (roleAction ? !['PUT', 'DELETE'].includes(req.method) : req.method !== 'GET') {
    return reply(res, 405, { error: 'Method not allowed' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const discordHeaders = { Authorization: 'Bot ' + token };
    const call = async (suffix, method = 'GET') => {
      const response = await fetch('https://discord.com/api/v10/guilds/' + guildId + suffix, {
        method, headers: discordHeaders, signal: controller.signal,
      });
      if (!response.ok) {
        console.error('[guildos-bridge] Discord HTTP', response.status, suffix.replace(/\d{16,22}/g, ':id'));
        return { status: response.status, error: true };
      }
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    };
    try {
      let result;
      if (roleAction) {
        result = await call('/members/' + roleAction[2] + '/roles/' + roleAction[3], req.method);
      } else if (guildResource[2] === 'bot-member') {
        const identity = await fetch('https://discord.com/api/v10/users/@me', {
          headers: discordHeaders, signal: controller.signal,
        });
        if (!identity.ok) return reply(res, identity.status, { error: 'Unable to resolve bot identity' });
        const me = await identity.json();
        result = await call('/members/' + me.id);
      } else if (guildResource[2] === 'members') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const limit = Math.max(1, Math.min(1000, Number(params.get('limit')) || 100));
        const after = params.get('after') || '0';
        if (!/^\d{1,22}$/.test(after)) return reply(res, 400, { error: 'Invalid cursor' });
        result = await call('/members?limit=' + limit + '&after=' + after);
      } else {
        result = await call('/' + guildResource[2]);
      }
      if (result.error) {
        const status = [401, 403, 404, 429].includes(result.status) ? result.status : 502;
        return reply(res, status, { error: 'Discord API request failed', code: 'DISCORD_' + result.status });
      }
      if (guildResource?.[2] === 'channels') {
        const all = result.data;
        if (!Array.isArray(all)) return reply(res, 502, { error: 'Invalid Discord channels response' });
        const sorted = all.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
        return reply(res, 200, {
          channels: sorted.filter(c => [0, 2, 5, 13, 15].includes(c.type)).map(c => ({ id: c.id, name: c.name, type: c.type, parent_id: c.parent_id || null })),
          categories: sorted.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name, type: c.type })),
        });
      }
      return reply(res, 200, { data: result.data });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    console.error('[guildos-bridge] Failed to retrieve channels:', error.message);
    return reply(res, 502, { error: 'Bot bridge could not contact Discord' });
  }
});
server.requestTimeout = 15000;
server.listen(port, host, () => console.log('[guildos-bridge] Listening on ' + host + ':' + port));
