/** Buffered, redacted application logs. Writes use service-role credentials only. */
const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("node:crypto");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE =
  /authorization|password|passwd|secret|token|api[_-]?key|cookie/i;

function redactLogText(value) {
  let text = String(value)
    .replace(/((?:Bearer|Bot)\s+)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}/g, "[REDACTED_TOKEN]")
    .replace(
      /((?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    );
  for (const [name, secret] of Object.entries(process.env)) {
    if (SENSITIVE.test(name) && secret?.length >= 8)
      text = text.split(secret).join("[REDACTED]");
  }
  return text.slice(0, 8000);
}

function sanitizeLogMetadata(
  value,
  depth = 0,
  seen = new Set(),
  budget = { remaining: 250 },
) {
  if (--budget.remaining < 0) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") return redactLogText(value);
  if (typeof value === "number")
    return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return String(value);
  if (depth >= 5) return "[Truncated]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  const result = Array.isArray(value)
    ? value
        .slice(0, Math.min(50, Math.max(0, budget.remaining)))
        .map((item) => sanitizeLogMetadata(item, depth + 1, seen, budget))
    : Object.fromEntries(
        Object.entries(value)
          .slice(0, Math.min(50, Math.max(0, budget.remaining)))
          .map(([key, item]) => [
            key,
            SENSITIVE.test(key)
              ? "[REDACTED]"
              : sanitizeLogMetadata(item, depth + 1, seen, budget),
          ]),
      );
  seen.delete(value);
  return result;
}

function createLogTransport({
  client,
  maxBuffer = 1000,
  batchSize = 50,
  requestTimeoutMs = 10_000,
  schedule = setTimeout,
  cancel = clearTimeout,
  now = () => Date.now(),
  errorSink = (message) => console.error(message),
} = {}) {
  const queue = [];
  let timer = null,
    running = null,
    attempts = 0,
    dropped = 0,
    closed = false;
  const waiting = new Set();
  function plan(delay = 2000) {
    if (closed || timer || !queue.length || !client) return;
    timer = schedule(() => {
      timer = null;
      void flush({ drain: false });
    }, delay);
    timer?.unref?.();
  }
  function log(guildId, level, source, message, metadata = null) {
    if (!client || closed) return;
    const internalId =
      typeof guildId === "string" && UUID.test(guildId) ? guildId : null;
    let safeMetadata;
    try {
      safeMetadata = sanitizeLogMetadata(metadata);
      const encoded = JSON.stringify(safeMetadata);
      if (encoded && encoded.length > 16_000)
        safeMetadata = { truncated: true, preview: encoded.slice(0, 16_000) };
    } catch {
      safeMetadata = { unavailable: true };
    }
    const row = {
      id: randomUUID(),
      guild_id: internalId,
      level: ["info", "warn", "error", "debug"].includes(level)
        ? level
        : "info",
      source: redactLogText(source || "bot").slice(0, 100),
      message: redactLogText(message),
      metadata: safeMetadata,
      created_at: new Date(now()).toISOString(),
    };
    if (queue.length >= maxBuffer) {
      const priority = { debug: 0, info: 1, warn: 2, error: 3 };
      let index = -1;
      for (let position = 0; position < queue.length; position++) {
        const item = queue[position];
        if (
          !waiting.has(item.id) &&
          priority[item.level] <= priority[row.level] &&
          (index < 0 || priority[item.level] < priority[queue[index].level])
        )
          index = position;
      }
      if (index < 0) {
        dropped++;
        return;
      }
      queue.splice(index, 1);
      dropped++;
      if (dropped === 1 || dropped % 100 === 0)
        errorSink(
          `[ConsoleLogger] Buffer full; ${dropped} log entries dropped`,
        );
    }
    queue.push(row);
    plan();
  }
  async function flush({ drain = true } = {}) {
    if (running) return running;
    if (!client || !queue.length) return true;
    if (timer) {
      cancel(timer);
      timer = null;
    }
    running = (async () => {
      do {
        const batch = queue.slice(0, batchSize);
        for (const row of batch) waiting.add(row.id);
        try {
          // Stable IDs and DO NOTHING make retries safe after a lost HTTP ack.
          const { error } = await client
            .from("bot_console_logs")
            .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
            .abortSignal(AbortSignal.timeout(requestTimeoutMs));
          if (error) throw error;
          const ids = new Set(batch.map((row) => row.id));
          for (let index = queue.length - 1; index >= 0; index--)
            if (ids.has(queue[index].id)) queue.splice(index, 1);
          attempts = 0;
        } catch (error) {
          // A guild may have been removed between recording and flushing. Keep
          // the event as a staff-only system log rather than poisoning a batch.
          if (error?.code === "23503") {
            try {
              const ids = [
                ...new Set(batch.map((row) => row.guild_id).filter(Boolean)),
              ];
              if (ids.length) {
                const lookup = await client
                  .from("guilds")
                  .select("id")
                  .in("id", ids)
                  .abortSignal(AbortSignal.timeout(requestTimeoutMs));
                if (!lookup.error) {
                  const existing = new Set(
                    (lookup.data || []).map((row) => row.id),
                  );
                  for (const row of batch)
                    if (row.guild_id && !existing.has(row.guild_id)) {
                      row.metadata = {
                        details: row.metadata,
                        unavailable_guild_id: row.guild_id,
                      };
                      row.guild_id = null;
                    }
                }
              }
            } catch {
              /* Preserve the original batch until a later retry. */
            }
          }
          attempts++;
          errorSink(
            "[ConsoleLogger] Log delivery failed; bounded buffer retained for retry",
          );
          return false;
        } finally {
          for (const row of batch) waiting.delete(row.id);
        }
      } while (drain && queue.length);
      return true;
    })();
    try {
      return await running;
    } finally {
      running = null;
      if (queue.length)
        plan(
          attempts ? Math.min(60_000, 2000 * 2 ** Math.min(attempts, 5)) : 2000,
        );
    }
  }
  function close() {
    closed = true;
    if (timer) cancel(timer);
    timer = null;
  }
  return {
    log,
    flush,
    close,
    state: () => ({ buffered: queue.length, dropped, attempts }),
  };
}

// Offline tests exercise explicit injected transports, never a process-global
// provider client with fixture credentials.
const client =
  process.env.NODE_ENV !== "test" &&
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      )
    : null;
const transport = createLogTransport({ client });
const botLog = (...args) => transport.log(...args);
const flushLogs = () => transport.flush();
const createGuildLogger = (guildId) =>
  Object.fromEntries(
    ["info", "warn", "error", "debug"].map((level) => [
      level,
      (source, message, metadata) =>
        botLog(guildId, level, source, message, metadata),
    ]),
  );
module.exports = {
  botLog,
  createGuildLogger,
  flushLogs,
  createLogTransport,
  redactLogText,
  sanitizeLogMetadata,
};
