// Durable queue protocol. Only the service-role bot may call these RPCs.
// Discord and Postgres do not share a transaction: message nonces reduce duplicate
// delivery after an ambiguous network failure, but cannot promise exactly-once.
const { createHash } = require("node:crypto");
const { botLog } = require("../consoleLogger");

const LEASE_SECONDS = 90;
const HEARTBEAT_MS = 30_000;
const TABLES = new Set([
  "reminders",
  "scheduled_messages",
  "scheduled_actions",
]);
const PERMANENT_DISCORD_CODES = new Set([
  10003, 10004, 10007, 10011, 10013, 50001, 50007, 50013, 50035,
]);

function permanentJobError(message) {
  const error = new Error(message);
  error.permanent = true;
  return error;
}

function isPermanentError(error) {
  return Boolean(
    error?.permanent ||
    PERMANENT_DISCORD_CODES.has(Number(error?.code)) ||
    (Number(error?.status) >= 400 &&
      Number(error?.status) < 500 &&
      ![408, 429].includes(Number(error?.status))),
  );
}

function describeError(error) {
  const prefix = error?.code ? `Discord ${error.code}: ` : "";
  return `${prefix}${error?.message || "Ukendt leveringsfejl"}`.slice(0, 500);
}

function messageDeliveryOptions(table, id) {
  return {
    nonce: createHash("sha256")
      .update(`${table}:${id}`)
      .digest("hex")
      .slice(0, 24),
    enforceNonce: true,
  };
}

async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

async function claimJob(supabase, table, id) {
  if (!TABLES.has(table)) throw new Error("Unknown job table");
  return rpc(supabase, "claim_bot_job", {
    p_table: table,
    p_id: id,
    p_lease_seconds: LEASE_SECONDS,
  });
}

async function finishJob(supabase, table, job, result) {
  const finished = await rpc(supabase, "finish_bot_job", {
    p_table: table,
    p_id: job.id,
    p_lease_token: job.lease_token,
    p_success: result.success,
    p_error: result.error || null,
    p_permanent: Boolean(result.permanent),
    p_message_id: result.messageId || null,
    p_next_at: result.nextAt || null,
  });
  if (!finished) throw new Error(`Job lease lost before completion: ${job.id}`);
}

async function listDueJobs(supabase, table, timeColumn, now = new Date()) {
  const { data, error } = await supabase
    .from(table)
    .select("*, guilds!inner(guild_id)")
    .in("delivery_status", ["pending", "processing"])
    .lte(timeColumn, now.toISOString())
    .order(timeColumn, { ascending: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

// Delivery errors and database acknowledgement errors are deliberately separate:
// never turn a successful Discord send into a pending retry just because its
// database acknowledgement failed. The lease/nonce handles recovery instead.
async function runJob(supabase, table, candidate, deliver, nextAt = null) {
  const job = await claimJob(supabase, table, candidate.id);
  if (!job) return false;
  let heartbeatRunning = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try {
      const held = await rpc(supabase, "extend_bot_job_lease", {
        p_table: table,
        p_id: job.id,
        p_lease_token: job.lease_token,
        p_lease_seconds: LEASE_SECONDS,
      });
      if (!held) console.error(`[Jobs] Lease lost for ${table}/${job.id}`);
    } catch (error) {
      console.error(
        `[Jobs] Lease renewal failed for ${table}/${job.id}:`,
        error.message,
      );
    } finally {
      heartbeatRunning = false;
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();
  try {
    let message;
    try {
      message = await deliver(job);
    } catch (error) {
      await finishJob(supabase, table, job, {
        success: false,
        error: describeError(error),
        permanent: isPermanentError(error),
      });
      botLog(job.guild_id, "error", "scheduled-jobs", describeError(error), {
        table,
        job_id: job.id,
        attempt: job.attempt_count,
      });
      console.error(`[Jobs] ${table}/${job.id}:`, describeError(error));
      return false;
    }
    await finishJob(supabase, table, job, {
      success: true,
      messageId: message?.id,
      nextAt: typeof nextAt === "function" ? nextAt(job) : nextAt,
    });
    return true;
  } catch (error) {
    botLog(
      job.guild_id,
      "error",
      "scheduled-jobs",
      "Opgavens databasekvittering kunne ikke gemmes",
      { table, job_id: job.id, error: error.message },
    );
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

function computeNextOccurrence(scheduledAt, interval, now = new Date()) {
  const next = new Date(scheduledAt);
  if (Number.isNaN(next.getTime())) return null;
  const advance = () => {
    switch (interval) {
      case "hourly":
        next.setUTCHours(next.getUTCHours() + 1);
        break;
      case "daily":
        next.setUTCDate(next.getUTCDate() + 1);
        break;
      case "weekly":
        next.setUTCDate(next.getUTCDate() + 7);
        break;
      case "monthly":
        next.setUTCMonth(next.getUTCMonth() + 1);
        break;
      default:
        return false;
    }
    return true;
  };
  for (let i = 0; i < 100_000; i++) {
    if (!advance()) return null;
    if (next > now) return next;
  }
  return null;
}

module.exports = {
  claimJob,
  finishJob,
  listDueJobs,
  runJob,
  messageDeliveryOptions,
  permanentJobError,
  isPermanentError,
  computeNextOccurrence,
};
