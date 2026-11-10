import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
const {
  processDueReminders,
  deliverReminder,
} = require("../bot/handlers/reminderHandler.js");
const { SchedulerHandler } = require("../bot/schedulerHandler.js");
const {
  processDueScheduledActions,
  executeAction,
} = require("../bot/handlers/scheduledActionHandler.js");
const { claimJob, finishJob, runJob } = require("../bot/utils/durableJobs.js");
const { createJobDb } = require("./helpers/job-db.cjs");
const GUILD = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";

function postgresAdapter(db) {
  return {
    from(table) {
      let dueColumn, dueValue;
      const q = {
        select() {
          return q;
        },
        in() {
          return q;
        },
        order() {
          return q;
        },
        lte(column, value) {
          dueColumn = column;
          dueValue = value;
          return q;
        },
        then(resolve, reject) {
          assert.ok(
            ["reminders", "scheduled_messages", "scheduled_actions"].includes(
              table,
            ),
          );
          assert.ok(
            ["remind_at", "scheduled_at", "execute_at"].includes(dueColumn),
          );
          return db
            .query(
              `SELECT j.*, jsonb_build_object('guild_id', g.guild_id) AS guilds FROM public.${table} j
            JOIN public.guilds g ON g.id = j.guild_id WHERE j.delivery_status IN ('pending', 'processing') AND j.${dueColumn} <= $1
            ORDER BY j.${dueColumn}`,
              [dueValue],
            )
            .then((r) => ({ data: r.rows, error: null }))
            .then(resolve, reject);
        },
      };
      return q;
    },
    async rpc(name, a) {
      let result;
      if (name === "claim_bot_job")
        result = await db.query(
          "SELECT public.claim_bot_job($1,$2,$3) AS data",
          [a.p_table, a.p_id, a.p_lease_seconds],
        );
      else if (name === "finish_bot_job")
        result = await db.query(
          "SELECT public.finish_bot_job($1,$2,$3,$4,$5,$6,$7,$8) AS data",
          [
            a.p_table,
            a.p_id,
            a.p_lease_token,
            a.p_success,
            a.p_error,
            a.p_permanent,
            a.p_message_id,
            a.p_next_at,
          ],
        );
      else if (name === "extend_bot_job_lease")
        result = await db.query(
          "SELECT public.extend_bot_job_lease($1,$2,$3,$4) AS data",
          [a.p_table, a.p_id, a.p_lease_token, a.p_lease_seconds],
        );
      else throw new Error(name);
      return { data: result.rows[0].data, error: null };
    },
  };
}

async function reminder(db, extras = {}) {
  const row = {
    guild_id: GUILD,
    created_by_user_id: null,
    target_channel_id: "channel",
    message: "hello",
    remind_at: new Date(Date.now() - 60_000).toISOString(),
    ...extras,
  };
  const keys = Object.keys(row);
  return (
    await db.query(
      `INSERT INTO reminders (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
      Object.values(row),
    )
  ).rows[0];
}
function discord(send = async () => ({ id: "discord-message" })) {
  return { channels: { fetch: async () => ({ send }) } };
}

// Real SQL, not a JavaScript reproduction of the claim/update rules. PGlite
// serializes connections; the deploy runbook additionally races real PG sessions.
test("durable scheduler SQL and delivery outcomes", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("./fixtures/durable-jobs-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    // Existing sent flag from either generation must never be replayed.
    await db.query(
      "INSERT INTO guilds VALUES ($1,'discord-guild'),($2,'other-guild')",
      [GUILD, OTHER],
    );
    await db.query(
      "INSERT INTO reminders (guild_id,created_by_user_id,message,remind_at,is_sent,sent) VALUES ($1,$1,'historic',now()-interval '1 day',true,false)",
      [GUILD],
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261110182703_bot_reliable_delivery.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const api = postgresAdapter(db);
    await t.test(
      "historical sent rows remain completed and reminder command schema is aligned",
      async () => {
        const old = (await db.query("SELECT * FROM reminders")).rows[0];
        assert.equal(old.delivery_status, "sent");
        assert.equal(old.sent, true);
        assert.equal(old.is_sent, true);
        assert.equal(
          (
            await reminder(db, {
              message: "Discord-created reminder",
              created_by_id: "123",
            })
          ).created_by_user_id,
          null,
        );
        await db.exec("DELETE FROM reminders");
      },
    );
    await t.test(
      "overlapping polls deliver once and create one future recurrence transactionally",
      async () => {
        const source = await reminder(db, {
          is_recurring: true,
          recurrence_interval: "daily",
          repeat_interval: "daily",
        });
        let sends = 0;
        const client = discord(async (payload) => {
          sends++;
          assert.equal(payload.enforceNonce, true);
          assert.equal(payload.nonce.length, 24);
          await new Promise((r) => setTimeout(r, 5));
          return { id: "one" };
        });
        const results = await Promise.all([
          processDueReminders(client, api),
          processDueReminders(client, api),
        ]);
        assert.equal(sends, 1);
        assert.equal(results[0].sent + results[1].sent, 1);
        const rows = (
          await db.query("SELECT * FROM reminders ORDER BY remind_at")
        ).rows;
        assert.equal(rows.length, 2);
        assert.equal(rows[0].sent, true);
        assert.equal(rows[0].delivery_message_id, "one");
        assert.equal(rows[1].recurrence_parent_id, source.id);
        assert.equal(rows[1].sent, false);
        assert.ok(new Date(rows[1].remind_at) > new Date());
        await db.exec("DELETE FROM reminders");
      },
    );
    await t.test(
      "a permanent Discord failure remains unsent with error and no recurring child",
      async () => {
        await reminder(db, {
          is_recurring: true,
          recurrence_interval: "daily",
        });
        const result = await processDueReminders(
          discord(async () => {
            throw Object.assign(new Error("Missing Permissions"), {
              code: 50013,
            });
          }),
          api,
        );
        assert.equal(result.sent, 0);
        const rows = (await db.query("SELECT * FROM reminders")).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].sent, false);
        assert.equal(rows[0].is_sent, false);
        assert.equal(rows[0].delivery_status, "failed");
        assert.match(rows[0].last_error, /50013.*Missing Permissions/);
        await db.exec("DELETE FROM reminders");
      },
    );
    await t.test(
      "transient failures back off, survive restart, and stop after five attempts",
      async () => {
        const row = await reminder(db);
        for (let attempt = 1; attempt <= 5; attempt++) {
          const claim = await claimJob(api, "reminders", row.id);
          assert.ok(claim);
          assert.equal(claim.attempt_count, attempt);
          await finishJob(api, "reminders", claim, {
            success: false,
            error: "Discord temporarily unavailable",
          });
          const after = (
            await db.query("SELECT * FROM reminders WHERE id=$1", [row.id])
          ).rows[0];
          assert.equal(after.sent, false);
          if (attempt < 5) {
            assert.equal(after.delivery_status, "pending");
            assert.ok(new Date(after.next_attempt_at) > new Date());
            assert.equal(await claimJob(api, "reminders", row.id), null);
            await db.query(
              "UPDATE reminders SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
              [row.id],
            );
          } else assert.equal(after.delivery_status, "failed");
        }
        assert.equal(await claimJob(api, "reminders", row.id), null);
        await db.exec("DELETE FROM reminders");
      },
    );
    await t.test(
      "expired leases recover and stale workers cannot finish or renew the new lease",
      async () => {
        const row = await reminder(db);
        const first = await claimJob(api, "reminders", row.id);
        assert.equal(await claimJob(api, "reminders", row.id), null);
        await db.query(
          "UPDATE reminders SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
          [row.id],
        );
        const replacement = await claimJob(api, "reminders", row.id);
        assert.ok(replacement);
        assert.notEqual(first.lease_token, replacement.lease_token);
        await assert.rejects(
          () => finishJob(api, "reminders", first, { success: true }),
          /lease lost/,
        );
        const renew = await api.rpc("extend_bot_job_lease", {
          p_table: "reminders",
          p_id: row.id,
          p_lease_token: first.lease_token,
          p_lease_seconds: 90,
        });
        assert.equal(renew.data, false);
        await finishJob(api, "reminders", replacement, { success: true });
        await db.exec("DELETE FROM reminders");
      },
    );
    await t.test(
      "scheduled messages and missing moderation targets fail visibly instead of completed flags",
      async () => {
        await db.query(
          "INSERT INTO scheduled_messages(guild_id,channel_id,content,scheduled_at,created_by_id) VALUES ($1,'missing','hello',now()-interval '1 minute','test')",
          [GUILD],
        );
        const scheduler = new SchedulerHandler(
          { channels: { fetch: async () => null } },
          api,
        );
        await scheduler.checkScheduledMessages();
        const message = (await db.query("SELECT * FROM scheduled_messages"))
          .rows[0];
        assert.equal(message.sent, false);
        assert.equal(message.delivery_status, "failed");
        await db.query(
          "INSERT INTO scheduled_actions(guild_id,action_type,target_discord_id,execute_at,created_by,role_id) VALUES ($1,'role_add','gone',now()-interval '1 minute','test','role')",
          [GUILD],
        );
        const client = {
          guilds: {
            cache: new Map([
              [
                "discord-guild",
                {
                  members: {
                    fetch: async () => {
                      throw Object.assign(new Error("Unknown Member"), {
                        code: 10007,
                      });
                    },
                  },
                },
              ],
            ]),
          },
        };
        await processDueScheduledActions(client, api);
        const action = (await db.query("SELECT * FROM scheduled_actions"))
          .rows[0];
        assert.equal(action.executed, false);
        assert.equal(action.delivery_status, "failed");
      },
    );
    await t.test(
      "stale kick is not retried across a possible member rejoin",
      async () => {
        const row = (
          await db.query(
            "INSERT INTO scheduled_actions(guild_id,action_type,target_discord_id,execute_at,created_by) VALUES ($1,'kick','user',now()-interval '1 minute','test') RETURNING *",
            [GUILD],
          )
        ).rows[0];
        assert.ok(await claimJob(api, "scheduled_actions", row.id));
        await db.query(
          "UPDATE scheduled_actions SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
          [row.id],
        );
        assert.equal(await claimJob(api, "scheduled_actions", row.id), null);
        const action = (
          await db.query("SELECT * FROM scheduled_actions WHERE id=$1", [
            row.id,
          ])
        ).rows[0];
        assert.equal(action.executed, false);
        assert.equal(action.delivery_status, "failed");
        assert.match(action.last_error, /ukendt/);
      },
    );
    await t.test(
      "RPCs and delivery state are private; verified guild admins and platform staff retain schedule access",
      async () => {
        const privileges = (
          await db.query(
            "SELECT has_function_privilege('anon','public.claim_bot_job(text,uuid,integer)','EXECUTE') AS anon, has_function_privilege('authenticated','public.finish_bot_job(text,uuid,uuid,boolean,text,boolean,text,timestamptz)','EXECUTE') AS authenticated, has_function_privilege('service_role','public.claim_bot_job(text,uuid,integer)','EXECUTE') AS service",
          )
        ).rows[0];
        assert.deepEqual(privileges, {
          anon: false,
          authenticated: false,
          service: true,
        });
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM pg_proc WHERE proname IN ('claim_bot_job','finish_bot_job','extend_bot_job_lease') AND prosecdef",
            )
          ).rows[0].n,
          0,
        );
        const owned = await reminder(db, { guild_id: GUILD });
        await reminder(db, { guild_id: OTHER });
        const user = "00000000-0000-0000-0000-000000000011";
        const staff = "00000000-0000-0000-0000-000000000012";
        await db.query("INSERT INTO user_guilds VALUES ($1,$2,true)", [
          user,
          GUILD,
        ]);
        await db.query("INSERT INTO test_platform_roles VALUES ($1)", [staff]);
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
          user,
        ]);
        await db.exec("SET ROLE authenticated");
        assert.equal(
          (await db.query("SELECT count(*)::int AS n FROM reminders")).rows[0]
            .n,
          1,
        );
        await assert.rejects(
          () =>
            db.query("SELECT claim_bot_job('reminders',gen_random_uuid(),90)"),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query(
              "UPDATE reminders SET lease_token=gen_random_uuid() WHERE id=$1",
              [owned.id],
            ),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query("UPDATE reminders SET sent=true WHERE id=$1", [owned.id]),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query("UPDATE reminders SET attempt_count=0 WHERE id=$1", [
              owned.id,
            ]),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query(
              "INSERT INTO reminders(guild_id,message,remind_at,delivery_status) VALUES ($1,'spoofed',now(),'sent')",
              [GUILD],
            ),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query(
              "INSERT INTO reminders(guild_id,message,remind_at) VALUES ($1,'foreign',now())",
              [OTHER],
            ),
          /row-level security/,
        );
        await assert.rejects(
          () =>
            db.query("UPDATE reminders SET guild_id=$1 WHERE id=$2", [
              OTHER,
              owned.id,
            ]),
          /row-level security/,
        );
        assert.equal(
          (
            await db.query(
              "UPDATE reminders SET message='edited' WHERE guild_id=$1 RETURNING id",
              [OTHER],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "DELETE FROM reminders WHERE guild_id=$1 RETURNING id",
              [OTHER],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "UPDATE reminders SET message='edited' WHERE id=$1 RETURNING id",
              [owned.id],
            )
          ).rows.length,
          1,
        );
        await db.query(
          "INSERT INTO reminders(guild_id,message,remind_at) VALUES ($1,'new own schedule',now())",
          [GUILD],
        );
        await assert.rejects(
          () =>
            db.query("INSERT INTO user_guilds VALUES ($1,$2,true)", [
              user,
              OTHER,
            ]),
          /permission denied/,
        );
        await db.exec("RESET ROLE");
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
          staff,
        ]);
        await db.exec("SET ROLE authenticated");
        assert.equal(
          (await db.query("SELECT count(*)::int AS n FROM reminders")).rows[0]
            .n,
          3,
        );
        await db.exec("RESET ROLE; SET ROLE anon");
        await assert.rejects(
          () => db.query("SELECT * FROM reminders"),
          /permission denied/,
        );
        await db.exec("RESET ROLE");
      },
    );
  } finally {
    await db.close();
  }
});

test("acknowledgement failure after send never invokes failure acknowledgement", async () => {
  const fake = createJobDb(
    { reminders: [{ id: "job", sent: false }] },
    { failAcknowledgement: true },
  );
  let sends = 0;
  await assert.rejects(
    () =>
      runJob(fake, "reminders", { id: "job" }, async () => {
        sends++;
        return { id: "sent" };
      }),
    /acknowledgment/,
  );
  assert.equal(sends, 1);
  assert.equal(fake.db.reminders[0].delivery_status, "processing");
});

test("ambiguous DM network failure is not sent again to the fallback channel", async () => {
  let fallback = 0;
  await assert.rejects(
    () =>
      deliverReminder(
        {
          users: {
            fetch: async () => ({
              send: async () => {
                throw new Error("socket reset");
              },
            }),
          },
          channels: {
            fetch: async () => ({
              send: async () => {
                fallback++;
              },
            }),
          },
        },
        {
          id: "job",
          message: "hello",
          target_user_discord_id: "user",
          channel_id: "channel",
        },
      ),
    /socket reset/,
  );
  assert.equal(fallback, 0);
});

test("mute retries preserve the scheduled end time instead of extending timeout", async () => {
  const action = {
    guilds: { guild_id: "guild" },
    action_type: "mute",
    target_discord_id: "member",
    execute_at: new Date(Date.now() - 10_000).toISOString(),
  };
  const times = [];
  const client = {
    guilds: {
      cache: new Map([
        [
          "guild",
          {
            members: {
              fetch: async () => ({
                disableCommunicationUntil: async (time) =>
                  times.push(time.getTime()),
              }),
            },
          },
        ],
      ]),
    },
  };
  await executeAction(client, action);
  await executeAction(client, action);
  assert.deepEqual(times, [
    new Date(action.execute_at).getTime() + 3_600_000,
    new Date(action.execute_at).getTime() + 3_600_000,
  ]);
});
