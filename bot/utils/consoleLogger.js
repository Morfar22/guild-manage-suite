'use strict';

const util = require('util');

const INSTALLED = Symbol.for('guild-manage.console-logger.installed');
const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 };
const LEVEL_LABEL = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' };
const LEVEL_COLOR = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function getConfiguredLevel() {
  const value = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVEL_WEIGHT, value) ? value : 'info';
}

function shouldUseColor() {
  return Boolean(process.stdout?.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb');
}

function timestamp() {
  const timeZone = process.env.LOG_TIMEZONE || 'Europe/Copenhagen';

  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    return parts.replace(',', '');
  } catch {
    return new Date().toISOString();
  }
}

function redactSecrets(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/(authorization\s*[:=]\s*(?:bot|bearer)\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:DISCORD_TOKEN|DEFAULT_BOT_TOKEN|DISCORD_BOT_TOKEN|BOT_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/([\w-]{20,}\.[\w-]{5,}\.[\w-]{20,})/g, '[REDACTED_DISCORD_TOKEN]')
    .replace(/(eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,})/g, '[REDACTED_JWT]');
}

function formatValue(value) {
  if (value instanceof Error) {
    return redactSecrets(value.stack || `${value.name}: ${value.message}`);
  }

  if (typeof value === 'string') {
    return redactSecrets(value);
  }

  if (typeof value === 'object' && value !== null) {
    return redactSecrets(util.inspect(value, {
      depth: 5,
      colors: false,
      compact: 3,
      maxArrayLength: 50,
      maxStringLength: 2000,
      breakLength: 140,
    }));
  }

  return String(value);
}

function installGlobalConsoleLogger() {
  if (globalThis[INSTALLED]) return globalThis[INSTALLED];

  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const configuredLevel = getConfiguredLevel();
  const useColor = shouldUseColor();

  function write(level, args) {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[configuredLevel]) return;

    const prefix = `[${timestamp()}] [${LEVEL_LABEL[level]}]`;
    const body = args.map(formatValue).join(' ');
    const line = `${prefix} ${body}`;

    const output = useColor
      ? `${LEVEL_COLOR[level]}${line}${RESET}`
      : line;

    if (level === 'error') originals.error(output);
    else if (level === 'warn') originals.warn(output);
    else if (level === 'debug') originals.debug(output);
    else originals.log(output);
  }

  console.log = (...args) => write('info', args);
  console.info = (...args) => write('info', args);
  console.warn = (...args) => write('warn', args);
  console.error = (...args) => write('error', args);
  console.debug = (...args) => write('debug', args);

  const api = {
    debug: (...args) => write('debug', args),
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
    originals,
  };

  globalThis[INSTALLED] = api;
  return api;
}

module.exports = { installGlobalConsoleLogger };
