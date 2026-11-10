"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { botLog } = require("../consoleLogger");

function databaseError(message) {
  const error = new Error(message);
  error.database = true;
  return error;
}

async function operationalRpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw databaseError(`${name}: ${error.message}`);
  return data;
}

function permanentOperationalError(message) {
  const error = new Error(message);
  error.permanent = true;
  return error;
}

function isPermanentDiscordError(error) {
  return Boolean(
    error?.permanent ||
    [10003, 10004, 10007, 10011, 10013, 50001, 50007, 50013, 50035].includes(
      Number(error?.code),
    ) ||
    (Number(error?.status) >= 400 &&
      Number(error?.status) < 500 &&
      ![408, 429].includes(Number(error?.status))),
  );
}

function describeOperationalError(error) {
  return `${error?.code ? `Discord ${error.code}: ` : ""}${error?.message || "Ukendt fejl"}`.slice(
    0,
    1000,
  );
}

async function runOperationalJob(supabase, kind, id, execute, options = {}) {
  const log = options.log || botLog;
  const job = await operationalRpc(supabase, "bot_claim_operational_job", {
    p_kind: kind,
    p_id: id,
  });
  if (!job) return false;
  const logFailure = (message) =>
    log(
      job.guild_id,
      "error",
      kind === "workflow" ? "workflows" : "moderation-scheduler",
      message,
      {
        job_id: id,
        kind,
        attempt_count: job.attempt_count,
        action_index: job.action_index,
      },
    );
  if (job.terminal) {
    logFailure(job.last_error);
    return false;
  }
  let leaseHeld = true;
  let renewing = false;
  const guard = () => {
    if (!leaseHeld)
      throw databaseError("Operational job lease cannot be confirmed");
  };
  const timer = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      leaseHeld = await operationalRpc(supabase, "bot_renew_operational_job", {
        p_kind: kind,
        p_id: id,
        p_token: job.lease_token,
      });
    } catch (error) {
      leaseHeld = false;
      logFailure(`Lease renewal failed: ${describeOperationalError(error)}`);
      console.error(
        `[Operations] Lease renewal failed (${kind}/${id}):`,
        error.message,
      );
    } finally {
      renewing = false;
    }
  }, 30_000);
  timer.unref?.();
  try {
    let failure;
    try {
      await execute(job, guard);
    } catch (error) {
      // An unknown database acknowledgement is not a failed Discord effect.
      // Keep the lease/checkpoint intact and let recovery inspect its state.
      if (error.database) throw error;
      failure = error;
    }
    const acknowledged = await operationalRpc(
      supabase,
      "bot_finish_operational_job",
      {
        p_kind: kind,
        p_id: id,
        p_token: job.lease_token,
        p_success: !failure,
        p_error: failure ? describeOperationalError(failure) : null,
        p_permanent: failure ? isPermanentDiscordError(failure) : false,
      },
    );
    if (!acknowledged)
      throw databaseError("Operational job lease lost before acknowledgement");
    if (failure) {
      logFailure(describeOperationalError(failure));
      console.error(
        `[Operations] ${kind}/${id}:`,
        describeOperationalError(failure),
      );
    }
    return !failure;
  } catch (error) {
    logFailure(describeOperationalError(error));
    error.operationalLogged = true;
    throw error;
  } finally {
    clearInterval(timer);
  }
}

function workflowMessageOptions(jobId, index) {
  return {
    nonce: createHash("sha256")
      .update(`workflow:${jobId}:${index}`)
      .digest("hex")
      .slice(0, 24),
    enforceNonce: true,
  };
}

// Local gateway events cannot be re-read from a database cursor. Persist them
// before attempting the RPC, and remove a file only after confirmed enqueue.
// Files contain event context, never bot credentials; the directory is private.
class WorkflowEventSpool {
  constructor(supabase, options = {}) {
    this.supabase = supabase;
    this.directory =
      options.directory ||
      path.join(
        process.env.BOT_STATE_DIR || path.join(__dirname, "..", ".state"),
        "workflow-events",
      );
    this.maxFiles = options.maxFiles || 10_000;
    this.running = null;
    this.serial = Promise.resolve();
  }

  async prepare() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await fs.chmod(this.directory, 0o700);
  }

  async persist(event) {
    // Serialize file creation within this process; all bot clients share one
    // spool instance. Atomic rename keeps partially written JSON out of drains.
    const work = this.serial.then(async () => {
      await this.prepare();
      const name =
        createHash("sha256")
          .update(`${event.guild_id}:${event.trigger_type}:${event.event_key}`)
          .digest("hex") + ".json";
      const target = path.join(this.directory, name);
      try {
        await fs.access(target);
        return;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const files = (await fs.readdir(this.directory)).filter((f) =>
        f.endsWith(".json"),
      );
      if (files.length >= this.maxFiles)
        throw new Error(
          "Workflow event spool capacity reached; event could not be accepted",
        );
      const temporary = path.join(
        this.directory,
        name + "." + randomUUID() + ".tmp",
      );
      const handle = await fs.open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(event));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, target);
      if (process.platform !== "win32") {
        const directory = await fs.open(this.directory, "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    });
    this.serial = work.catch(() => {});
    return work;
  }

  async drain() {
    // Shared spool draining is serialized. A failed RPC preserves every file
    // still pending; idempotent job keys make response-loss/restart safe.
    if (this.running) return this.running;
    this.running = (async () => {
      await this.prepare();
      for (const name of (await fs.readdir(this.directory))
        .filter((f) => /^[a-f0-9]{64}\.json$/.test(f))
        .slice(0, 100)) {
        const file = path.join(this.directory, name);
        let event;
        try {
          event = JSON.parse(await fs.readFile(file, "utf8"));
        } catch (error) {
          // Preserve a corrupt entry for inspection without blocking every
          // healthy gateway event and database-originated workflow behind it.
          await fs.rename(file, file + ".invalid");
          console.error(
            `[PlatformV3] Workflow spool entry quarantined: ${error.code || error.name}`,
          );
          continue;
        }
        if (
          !event ||
          !["member_join", "message_keyword"].includes(event.trigger_type) ||
          typeof event.event_key !== "string" ||
          event.event_key.length < 1 ||
          event.event_key.length > 200 ||
          !event.payload ||
          typeof event.payload.guildId !== "string" ||
          !event.payload.guildId ||
          (event.payload.eventOccurredAt &&
            !Number.isFinite(Date.parse(event.payload.eventOccurredAt)))
        ) {
          await fs.rename(file, file + ".invalid");
          console.error(
            "[PlatformV3] Invalid workflow spool entry quarantined for inspection",
          );
          continue;
        }
        let guildId = event.guild_id;
        if (!guildId) {
          const { data, error } = await this.supabase
            .from("guilds")
            .select("id")
            .eq("guild_id", event.payload.guildId)
            .maybeSingle();
          if (error)
            throw databaseError(`Workflow guild lookup: ${error.message}`);
          if (!data) continue;
          guildId = data.id;
        }
        await operationalRpc(this.supabase, "bot_enqueue_workflow_event", {
          p_guild_id: guildId,
          p_trigger_type: event.trigger_type,
          p_event_key: event.event_key,
          p_payload: event.payload,
        });
        await fs.unlink(file);
      }
    })();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }
}

module.exports = {
  operationalRpc,
  runOperationalJob,
  permanentOperationalError,
  isPermanentDiscordError,
  describeOperationalError,
  workflowMessageOptions,
  WorkflowEventSpool,
};
