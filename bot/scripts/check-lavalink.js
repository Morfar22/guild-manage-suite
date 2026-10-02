'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const net = require('net');

const host = process.env.LAVALINK_HOST || 'localhost';
const port = Number(process.env.LAVALINK_PORT || 40191);
const timeoutMs = Number(process.env.LAVALINK_CHECK_TIMEOUT_MS || 5000);

console.log(`[LavalinkCheck] Env: ${path.join(__dirname, '..', '.env')}`);
console.log(`[LavalinkCheck] Tester ${host}:${port}...`);

const socket = net.createConnection({ host, port });
let finished = false;

function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  try { socket.destroy(); } catch {}
  console.log(message);
  process.exit(code);
}

const timer = setTimeout(() => {
  finish(
    1,
    `[LavalinkCheck] ❌ Timeout efter ${timeoutMs}ms. Kontroller at Lavalink kører og lytter på ${host}:${port}.`
  );
}, timeoutMs);

socket.once('connect', () => {
  finish(0, `[LavalinkCheck] ✅ TCP-forbindelse OK til ${host}:${port}.`);
});

socket.once('error', (error) => {
  const hint = error.code === 'ECONNREFUSED'
    ? 'Processen lytter ikke på porten. Start/restart Lavalink eller ret LAVALINK_HOST/LAVALINK_PORT.'
    : 'Kontroller netværk, DNS/firewall og Lavalink-konfiguration.';
  finish(1, `[LavalinkCheck] ❌ ${error.code || error.message}: ${hint}`);
});
