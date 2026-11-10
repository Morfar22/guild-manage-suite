import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
const {
  runOperationalJob,
  WorkflowEventSpool,
} = require("../bot/utils/operationalJobs");
const {
  executeScheduledModeration,
} = require("../bot/handlers/advancedModeration");
const {
  executeWorkflowJob,
  ownedGuildRecords,
  scanCommandHealth,
  scanTicketSla,
} = require("../bot/handlers/platformV3Handler");
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";

const functions = {
  bot_claim_operational_job: ["p_kind", "p_id"],
  bot_renew_operational_job: ["p_kind", "p_id", "p_token"],
  bot_finish_operational_job: [
    "p_kind",
    "p_id",
    "p_token",
    "p_success",
    "p_error",
    "p_permanent",
  ],
  bot_workflow_action: ["p_id", "p_token", "p_index", "p_phase", "p_record"],
  bot_enqueue_workflow_event: [
    "p_guild_id",
    "p_trigger_type",
    "p_event_key",
    "p_payload",
  ],
  bot_ingest_workflow_events: ["p_guild_id"],
  bot_upsert_operational_alert: [
    "p_guild_id",
    "p_source",
    "p_key",
    "p_title",
    "p_message",
    "p_severity",
    "p_metadata",
  ],
};
function adapter(db) {
  return {
    async rpc(name, args) {
      try {
        const keys = functions[name];
        assert.ok(keys, name);
        const params = keys.map((k) => args[k] ?? null);
        const result = await db.query(
          `SELECT public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) AS data`,
          params,
        );
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message } };
      }
    },
  };
}
async function rpc(db, name, args) {
  const { data, error } = await adapter(db).rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
const claim = (db, kind, id) =>
  rpc(db, "bot_claim_operational_job", { p_kind: kind, p_id: id });
const finish = (db, kind, job, success, permanent = false) =>
  rpc(db, "bot_finish_operational_job", {
    p_kind: kind,
    p_id: job.id,
    p_token: job.lease_token,
    p_success: success,
    p_permanent: permanent,
    p_error: success ? null : "fixture failure",
  });
async function workflow(db, actions = [], type = "ticket_created", guild = A) {
  return (
    await db.query(
      "INSERT INTO public.automation_workflows(guild_id,name,trigger_type,actions,created_at) VALUES($1,'Fixture workflow',$2,$3,now()-interval '1 day') RETURNING id",
      [guild, type, JSON.stringify(actions)],
    )
  ).rows[0].id;
}
async function enqueue(db, workflowId, eventKey = "fixture-event") {
  const w = (
    await db.query("SELECT * FROM public.automation_workflows WHERE id=$1", [
      workflowId,
    ])
  ).rows[0];
  await rpc(db, "bot_enqueue_workflow_event", {
    p_guild_id: w.guild_id,
    p_trigger_type: w.trigger_type,
    p_event_key: eventKey,
    p_payload: {
      userId: "member",
      username: "fixture",
      channelId: "channel",
      guildId: "untrusted-wrong-guild",
    },
  });
  return (
    await db.query(
      "SELECT * FROM public.bot_workflow_jobs WHERE workflow_id=$1 AND event_key=$2",
      [workflowId, eventKey],
    )
  ).rows[0];
}
async function action(db, job, phase, record = null) {
  return rpc(db, "bot_workflow_action", {
    p_id: job.id,
    p_token: job.lease_token,
    p_index: job.action_index,
    p_phase: phase,
    p_record: record,
  });
}
async function expire(db, table, id) {
  await db.query(
    `UPDATE public.${table} SET lease_expires_at=now()-interval '1 second',next_attempt_at=NULL WHERE id=$1`,
    [id],
  );
}

test("durable automation uses real SQL recovery, checkpoints and tenant-safe service RPCs", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("./fixtures/durable-automation-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query(
      "INSERT INTO public.guilds(id,guild_id,guild_name) VALUES($1,'discord-a','Guild A'),($2,'discord-b','Guild B')",
      [A, B],
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261110193958_bot_durable_automation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("SET ROLE service_role");

    await t.test(
      "temporary moderation recovers executing rows, rejects stale workers and finishes only on success",
      async () => {
        const id = (
          await db.query(
            "INSERT INTO public.moderation_scheduled_actions(guild_id,discord_guild_id,action_type,target_id,execute_at,created_by_id,status) VALUES($1,'discord-a','unban','member',now()-interval '1 minute','staff','executing') RETURNING id",
            [A],
          )
        ).rows[0].id;
        const first = await claim(db, "moderation", id);
        assert.ok(first);
        assert.equal(await claim(db, "moderation", id), null);
        await expire(db, "moderation_scheduled_actions", id);
        const next = await claim(db, "moderation", id);
        assert.notEqual(next.lease_token, first.lease_token);
        assert.equal(await finish(db, "moderation", first, true), false);
        assert.equal(await finish(db, "moderation", next, true), true);
        const saved = (
          await db.query(
            "SELECT status,attempt_count,executed_at FROM public.moderation_scheduled_actions WHERE id=$1",
            [id],
          )
        ).rows[0];
        assert.equal(saved.status, "executed");
        assert.equal(saved.attempt_count, 2);
        assert.ok(saved.executed_at);
      },
    );

    await t.test(
      "moderation transient failures retry with a bound and never claim successful execution",
      async () => {
        const id = (
          await db.query(
            "INSERT INTO public.moderation_scheduled_actions(guild_id,discord_guild_id,action_type,target_id,role_id,execute_at,created_by_id) VALUES($1,'discord-a','remove_role','member','role',now()-interval '1 minute','staff') RETURNING id",
            [A],
          )
        ).rows[0].id;
        for (let n = 0; n < 5; n++) {
          const job = await claim(db, "moderation", id);
          assert.ok(job);
          await finish(db, "moderation", job, false);
          if (n < 4) {
            assert.equal(await claim(db, "moderation", id), null);
            await expire(db, "moderation_scheduled_actions", id);
          }
        }
        const saved = (
          await db.query(
            "SELECT * FROM public.moderation_scheduled_actions WHERE id=$1",
            [id],
          )
        ).rows[0];
        assert.equal(saved.status, "failed");
        assert.equal(saved.attempt_count, 5);
        assert.equal(saved.executed_at, null);
      },
    );

    await t.test(
      "failed ingestion rolls back jobs AND cursor; a later process catches up exactly once",
      async () => {
        await workflow(db);
        await db.query(
          "UPDATE public.bot_workflow_cursors SET started_at=now()-interval '1 hour',scanned_at=now()-interval '1 hour' WHERE guild_id=$1",
          [A],
        );
        await db.query(
          "INSERT INTO public.tickets(guild_id,channel_id,creator_id,created_at) VALUES($1,'channel','member',now()-interval '10 minutes')",
          [A],
        );
        const before = (
          await db.query(
            "SELECT scanned_at::text value FROM public.bot_workflow_cursors WHERE guild_id=$1",
            [A],
          )
        ).rows[0].value;
        await db.exec(
          "RESET ROLE; CREATE FUNCTION public.fixture_block_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture enqueue failure'; END $$; CREATE TRIGGER fixture_block_enqueue BEFORE INSERT ON public.bot_workflow_jobs FOR EACH ROW EXECUTE FUNCTION public.fixture_block_enqueue(); SET ROLE service_role;",
        );
        await assert.rejects(
          rpc(db, "bot_ingest_workflow_events", { p_guild_id: A }),
          /fixture enqueue failure/,
        );
        assert.equal(
          (
            await db.query(
              "SELECT scanned_at::text value FROM public.bot_workflow_cursors WHERE guild_id=$1",
              [A],
            )
          ).rows[0].value,
          before,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM public.bot_workflow_jobs",
            )
          ).rows[0].n,
          0,
        );
        await db.exec(
          "RESET ROLE; DROP TRIGGER fixture_block_enqueue ON public.bot_workflow_jobs; SET ROLE service_role;",
        );
        assert.equal(
          await rpc(db, "bot_ingest_workflow_events", { p_guild_id: A }),
          1,
        );
        assert.equal(
          await rpc(db, "bot_ingest_workflow_events", { p_guild_id: A }),
          0,
        );
        // Persisted cursor, not module state: another caller consumes an event
        // created while the Node process was unavailable.
        await db.query(
          "INSERT INTO public.tickets(guild_id,channel_id,creator_id) VALUES($1,'channel','new-member')",
          [A],
        );
        assert.equal(
          await rpc(db, "bot_ingest_workflow_events", { p_guild_id: A }),
          1,
        );
      },
    );

    await t.test(
      "per-action checkpoints preserve completed effects across restart and reject premature success",
      async () => {
        const w = await workflow(db, [
          { type: "dashboard_alert" },
          { type: "add_role", role_id: "role" },
        ]);
        const queued = await enqueue(db, w, "checkpoint");
        assert.equal(queued.trigger_payload.guildId, "discord-a");
        let job = await claim(db, "workflow", queued.id);
        await assert.rejects(finish(db, "workflow", job, true), /incomplete/);
        job = await action(db, job, "begin");
        job = await action(db, job, "complete", {
          title: "one alert",
          message: "fixture",
          severity: "info",
        });
        await expire(db, "bot_workflow_jobs", job.id);
        job = await claim(db, "workflow", job.id);
        assert.equal(job.action_index, 1);
        let roleChanges = 0;
        const client = {
          guilds: {
            cache: new Map([
              [
                "discord-a",
                {
                  members: {
                    async fetch() {
                      return {
                        roles: {
                          async add() {
                            roleChanges++;
                          },
                        },
                      };
                    },
                  },
                },
              ],
            ]),
          },
        };
        await executeWorkflowJob(client, adapter(db), job);
        await finish(db, "workflow", job, true);
        assert.equal(roleChanges, 1);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM public.dashboard_notifications WHERE title='one alert'",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM public.workflow_executions WHERE job_id=$1",
              [job.id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(await finish(db, "workflow", job, true), false);
      },
    );

    await t.test(
      "lost Discord-send acknowledgement requires review instead of repeating an uncertain message",
      async () => {
        const w = await workflow(db, [
          { type: "send_message", message: "hello" },
        ]);
        const queued = await enqueue(db, w, "ambiguous-send");
        let sends = 0;
        const client = {
          guilds: {
            cache: new Map([
              [
                "discord-a",
                {
                  channels: {
                    cache: new Map([
                      [
                        "channel",
                        {
                          isTextBased: () => true,
                          async send() {
                            sends++;
                            return { id: "message" };
                          },
                        },
                      ],
                    ]),
                  },
                },
              ],
            ]),
          },
        };
        const api = adapter(db);
        const failingApi = {
          async rpc(name, args) {
            if (name === "bot_workflow_action" && args.p_phase === "complete")
              return {
                error: {
                  message: "fixture database outage after Discord success",
                },
              };
            return api.rpc(name, args);
          },
        };
        const operationLogs = [];
        await assert.rejects(
          runOperationalJob(
            failingApi,
            "workflow",
            queued.id,
            (j) => executeWorkflowJob(client, failingApi, j),
            { log: (...args) => operationLogs.push(args) },
          ),
          /database outage/,
        );
        await expire(db, "bot_workflow_jobs", queued.id);
        assert.equal(
          await runOperationalJob(
            adapter(db),
            "workflow",
            queued.id,
            () => {
              throw new Error("Uncertain Discord send must not execute twice");
            },
            { log: (...args) => operationLogs.push(args) },
          ),
          false,
        );
        assert.equal(operationLogs.length, 2);
        assert.ok(
          operationLogs.every(
            (entry) => entry[0] === A && entry[1] === "error",
          ),
        );
        assert.equal(sends, 1);
        const saved = (
          await db.query("SELECT * FROM public.bot_workflow_jobs WHERE id=$1", [
            queued.id,
          ])
        ).rows[0];
        assert.equal(saved.status, "error");
        assert.match(saved.last_error, /ukendt/);
        assert.equal(
          (
            await db.query(
              "SELECT status FROM public.workflow_executions WHERE job_id=$1",
              [queued.id],
            )
          ).rows[0].status,
          "error",
        );
      },
    );

    await t.test(
      "database action and checkpoint roll back together when a case insert fails",
      async () => {
        const w = await workflow(db, [{ type: "create_case" }]);
        const queued = await enqueue(db, w, "case-transaction");
        let job = await claim(db, "workflow", queued.id);
        job = await action(db, job, "begin");
        await db.exec(
          "RESET ROLE; CREATE FUNCTION public.fixture_block_case() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture case insert failure'; END $$; CREATE TRIGGER fixture_block_case BEFORE INSERT ON public.moderation_logs FOR EACH ROW EXECUTE FUNCTION public.fixture_block_case(); SET ROLE service_role;",
        );
        const record = {
          moderator_id: "bot",
          moderator_name: "Fixture bot",
          severity: "medium",
          reason: "fixture",
        };
        await assert.rejects(
          action(db, job, "complete", record),
          /case insert failure/,
        );
        assert.equal(
          (
            await db.query(
              "SELECT action_index FROM public.bot_workflow_jobs WHERE id=$1",
              [job.id],
            )
          ).rows[0].action_index,
          0,
        );
        assert.equal(
          (await db.query("SELECT count(*)::int n FROM public.moderation_logs"))
            .rows[0].n,
          0,
        );
        await db.exec(
          "RESET ROLE; DROP TRIGGER fixture_block_case ON public.moderation_logs; SET ROLE service_role;",
        );
        job = await action(db, job, "complete", record);
        assert.equal(job.action_index, 1);
        await finish(db, "workflow", job, true);
        assert.equal(
          (await db.query("SELECT count(*)::int n FROM public.moderation_logs"))
            .rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "failed Discord effect is not logged as success and completed earlier steps remain partial",
      async () => {
        const w = await workflow(db, [
          { type: "dashboard_alert" },
          { type: "send_message" },
        ]);
        const queued = await enqueue(db, w, "permission-failure");
        const client = {
          guilds: {
            cache: new Map([
              [
                "discord-a",
                {
                  channels: {
                    cache: new Map([
                      [
                        "channel",
                        {
                          isTextBased: () => true,
                          async send() {
                            throw Object.assign(
                              new Error("Missing Permissions"),
                              { code: 50013 },
                            );
                          },
                        },
                      ],
                    ]),
                  },
                },
              ],
            ]),
          },
        };
        assert.equal(
          await runOperationalJob(
            adapter(db),
            "workflow",
            queued.id,
            (j) => executeWorkflowJob(client, adapter(db), j),
            { log: () => {} },
          ),
          false,
        );
        const saved = (
          await db.query(
            "SELECT status,error_message FROM public.workflow_executions WHERE job_id=$1",
            [queued.id],
          )
        ).rows[0];
        assert.equal(saved.status, "partial");
        assert.match(saved.error_message, /Missing Permissions/);
      },
    );

    await t.test(
      "atomic alert dedup adopts prior alerts, scopes guilds and allows a later resolved incident",
      async () => {
        await db.query(
          "INSERT INTO public.dashboard_notifications(guild_id,title,source,metadata) VALUES($1,'prior','command-health','{\"command_name\":\"fixture\",\"executions\":10}')",
          [A],
        );
        const args = {
          p_guild_id: A,
          p_source: "command-health",
          p_key: "fixture",
          p_title: "fixture",
          p_message: "fixture",
          p_severity: "warning",
          p_metadata: { command_name: "fixture", executions: 20 },
        };
        const ids = await Promise.all(
          Array.from({ length: 10 }, () =>
            rpc(db, "bot_upsert_operational_alert", args),
          ),
        );
        assert.equal(new Set(ids).size, 1);
        assert.equal(
          (
            await db.query(
              "SELECT title FROM public.dashboard_notifications WHERE id=$1",
              [ids[0]],
            )
          ).rows[0].title,
          "prior",
        );
        const foreign = await rpc(db, "bot_upsert_operational_alert", {
          ...args,
          p_guild_id: B,
        });
        assert.notEqual(foreign, ids[0]);
        await db.query(
          "UPDATE public.dashboard_notifications SET status='resolved' WHERE id=$1",
          [ids[0]],
        );
        assert.notEqual(
          await rpc(db, "bot_upsert_operational_alert", args),
          ids[0],
        );
      },
    );

    await t.test(
      "backend state/RPCs reject browser roles and job reads remain guild scoped",
      async () => {
        await db.exec("RESET ROLE");
        for (const name of Object.keys(functions)) {
          const perms = (
            await db.query(
              "SELECT has_function_privilege('anon',oid,'EXECUTE') a,has_function_privilege('authenticated',oid,'EXECUTE') u FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=$1",
              [name],
            )
          ).rows[0];
          assert.deepEqual(perms, { a: false, u: false });
        }
        const user = "20000000-0000-4000-8000-000000000001";
        await db.query("INSERT INTO public.user_guilds VALUES($1,$2,true)", [
          user,
          A,
        ]);
        await db.exec(
          `SET ROLE authenticated; SET request.jwt.claim.sub='${user}'`,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM public.bot_workflow_jobs WHERE guild_id=$1",
              [B],
            )
          ).rows[0].n,
          0,
        );
        await assert.rejects(
          db.query("UPDATE public.bot_workflow_jobs SET status='success'"),
          /permission denied/,
        );
        await db.exec("RESET ROLE");
      },
    );
    await t.test(
      "one malformed workflow does not block healthy workflows or trap gateway events in the spool",
      async () => {
        await db.exec("SET ROLE service_role");
        const bad = await workflow(db, {}, "message_keyword");
        const good = await workflow(db, [], "message_keyword");
        await db.query(
          'UPDATE public.automation_workflows SET trigger_config=\'{"keyword":"hello","case_sensitive":"invalid boolean"}\' WHERE id IN ($1,$2)',
          [bad, good],
        );
        assert.equal(
          await rpc(db, "bot_enqueue_workflow_event", {
            p_guild_id: A,
            p_trigger_type: "message_keyword",
            p_event_key: "invalid-workflow",
            p_payload: { messageContent: "hello", guildId: "discord-a" },
          }),
          2,
        );
        const jobs = (
          await db.query(
            "SELECT * FROM public.bot_workflow_jobs WHERE event_key='invalid-workflow' ORDER BY workflow_id",
          )
        ).rows;
        const client = { guilds: { cache: new Map([["discord-a", {}]]) } };
        for (const job of jobs)
          await runOperationalJob(
            adapter(db),
            "workflow",
            job.id,
            (j) => executeWorkflowJob(client, adapter(db), j),
            { log: () => {} },
          );
        assert.equal(
          (
            await db.query(
              "SELECT status FROM public.bot_workflow_jobs WHERE workflow_id=$1 AND event_key='invalid-workflow'",
              [bad],
            )
          ).rows[0].status,
          "error",
        );
        assert.equal(
          (
            await db.query(
              "SELECT status FROM public.bot_workflow_jobs WHERE workflow_id=$1 AND event_key='invalid-workflow'",
              [good],
            )
          ).rows[0].status,
          "success",
        );
      },
    );
  } finally {
    await db.close();
  }
});

test("gateway event spool persists a DB outage across restart and removes files only after enqueue acknowledgement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guildos-workflow-spool-"));
  try {
    const event = {
      guild_id: A,
      trigger_type: "member_join",
      event_key: "fixture",
      payload: { guildId: "discord-a" },
    };
    const failed = new WorkflowEventSpool(
      {
        async rpc() {
          return { error: { message: "fixture outage" } };
        },
      },
      { directory },
    );
    await failed.persist(event);
    await failed.persist(event);
    await assert.rejects(failed.drain(), /fixture outage/);
    assert.equal(
      (await readdir(directory)).filter((x) => x.endsWith(".json")).length,
      1,
    );
    let accepted = 0;
    const restarted = new WorkflowEventSpool(
      {
        async rpc() {
          accepted++;
          return { data: 1, error: null };
        },
      },
      { directory },
    );
    await restarted.drain();
    assert.equal(accepted, 1);
    assert.deepEqual(await readdir(directory), []);
    const corruptName = "a".repeat(64) + ".json";
    await writeFile(join(directory, corruptName), "{bad JSON");
    await restarted.persist(event);
    await restarted.drain();
    assert.equal(accepted, 2);
    assert.deepEqual(await readdir(directory), [corruptName + ".invalid"]);
    await rm(join(directory, corruptName + ".invalid"));
    const bounded = new WorkflowEventSpool({}, { directory, maxFiles: 1 });
    await bounded.persist(event);
    await assert.rejects(
      bounded.persist({ ...event, event_key: "another" }),
      /capacity/,
    );
    assert.equal((await readdir(directory)).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("moderation treats already-achieved state as success but preserves permission errors", async () => {
  const client = {
    guilds: {
      cache: new Map([
        [
          "discord-a",
          {
            members: {
              async unban() {
                throw Object.assign(new Error("Unknown Ban"), { code: 10026 });
              },
            },
          },
        ],
      ]),
    },
  };
  await executeScheduledModeration(client, {
    discord_guild_id: "discord-a",
    action_type: "unban",
    target_id: "member",
  });
  client.guilds.cache.get("discord-a").members.unban = async () => {
    throw Object.assign(new Error("Missing Permissions"), { code: 50013 });
  };
  await assert.rejects(
    executeScheduledModeration(client, {
      discord_guild_id: "discord-a",
      action_type: "unban",
      target_id: "member",
    }),
    /Missing Permissions/,
  );
});

test("scanners do no work for an unowned guild and scope database scans to owned guilds", async () => {
  let calls = 0;
  const filters = [];
  const api = {
    from(table) {
      calls++;
      const q = {
        select() {
          return q;
        },
        in(k, v) {
          filters.push({ table, key: k, value: v });
          return q;
        },
        gte() {
          return q;
        },
        is() {
          return q;
        },
        not() {
          return q;
        },
        lte() {
          return q;
        },
        limit() {
          return q;
        },
        then(resolve) {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  const client = {
    isReady: () => true,
    guilds: {
      cache: new Map([
        ["discord-a", {}],
        ["discord-b", {}],
      ]),
    },
  };
  assert.deepEqual(await ownedGuildRecords(client, api, () => false), []);
  assert.equal(calls, 0);
  await scanCommandHealth(api, []);
  await scanTicketSla(api, []);
  assert.equal(calls, 0);
  await scanCommandHealth(api, [{ id: A }]);
  await scanTicketSla(api, [{ id: A }]);
  assert.deepEqual(
    filters.map((x) => x.value),
    [[A], [A]],
  );
});
