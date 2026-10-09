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
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  const match = /^\/v1\/guilds\/(\d{16,22})\/channels$/.exec(path);
  if (!match) return reply(res, 404, { error: 'Not found' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let upstream;
    try {
      upstream = await fetch('https://discord.com/api/v10/guilds/' + match[1] + '/channels', {
        headers: { Authorization: 'Bot ' + token },
        signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }
    if (!upstream.ok) {
      console.error('[guildos-bridge] Discord channel request failed:', upstream.status);
      return reply(res, [401, 403, 404, 429].includes(upstream.status) ? upstream.status : 502, {
        error: upstream.status === 404 ? 'Bot is not a member of this guild' : 'Discord channel request failed',
        code: 'DISCORD_' + upstream.status,
      });
    }
    const all = await upstream.json();
    if (!Array.isArray(all)) return reply(res, 502, { error: 'Invalid Discord response' });
    const allowed = new Set([0, 2, 5, 13, 15]);
    const ordered = all.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    return reply(res, 200, {
      channels: ordered.filter(c => allowed.has(c.type)).map(c => ({ id: c.id, name: c.name, type: c.type, parent_id: c.parent_id || null })),
      categories: ordered.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name, type: c.type })),
    });
  } catch (error) {
    console.error('[guildos-bridge] Failed to retrieve channels:', error.message);
    return reply(res, 502, { error: 'Bot bridge could not contact Discord' });
  }
});
server.requestTimeout = 15000;
server.listen(port, host, () => console.log('[guildos-bridge] Listening on ' + host + ':' + port));
