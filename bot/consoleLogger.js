/**
 * Bot Console Logger
 * Sends structured logs to the bot_console_logs table in Supabase
 * so they can be viewed in the admin panel.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Buffer logs to batch insert
let logBuffer = [];
let flushTimer = null;

async function flushLogs() {
  if (!supabase || logBuffer.length === 0) return;
  
  const batch = [...logBuffer];
  logBuffer = [];
  
  try {
    await supabase.from('bot_console_logs').insert(batch);
  } catch (err) {
    // Don't recurse - just print to actual console
    console.error('[ConsoleLogger] Failed to flush logs:', err.message);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, 2000); // Flush every 2 seconds
}

/**
 * Log a message to the console logs table
 * @param {string} guildId - The guild ID (use 'system' for non-guild logs)
 * @param {'info'|'warn'|'error'|'debug'} level - Log level
 * @param {string} source - Source module (e.g., 'bot', 'tickets', 'xp')
 * @param {string} message - Log message
 * @param {object} [metadata] - Optional metadata
 */
function botLog(guildId, level, source, message, metadata = null) {
  if (!supabase) return;
  
  logBuffer.push({
    guild_id: guildId,
    level,
    source,
    message,
    metadata,
  });
  
  scheduleFlush();
}

// Convenience methods
const createGuildLogger = (guildId) => ({
  info: (source, message, metadata) => botLog(guildId, 'info', source, message, metadata),
  warn: (source, message, metadata) => botLog(guildId, 'warn', source, message, metadata),
  error: (source, message, metadata) => botLog(guildId, 'error', source, message, metadata),
  debug: (source, message, metadata) => botLog(guildId, 'debug', source, message, metadata),
});

module.exports = { botLog, createGuildLogger, flushLogs };
