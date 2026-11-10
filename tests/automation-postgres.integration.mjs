// Dedicated fresh test database only. No provider calls or production rows.
// AUTOMATION_TEST_DATABASE_NAME=bot_automation_test
// AUTOMATION_TEST_PSQL='["docker","exec","-i","supabase-db","psql","-U","supabase_admin","-d","bot_automation_test"]'
// node --test tests/automation-postgres.integration.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const argv = process.env.AUTOMATION_TEST_PSQL
  ? JSON.parse(process.env.AUTOMATION_TEST_PSQL)
  : null;
const G = "10000000-0000-4000-8000-000000000001";
function sql(source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      argv[0],
      [...argv.slice(1), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code ? reject(new Error(err.trim())) : resolve(out.trim()),
    );
    child.stdin.end(source);
  });
}
const value = async (source) =>
  JSON.parse((await sql(source)).split("\n").at(-1));
test(
  "operational recovery and alert dedup in independent PostgreSQL sessions",
  { skip: !argv, timeout: 120_000 },
  async (t) => {
    const name =
      process.env.AUTOMATION_TEST_DATABASE_NAME || "bot_automation_test";
    assert.match(name, /_test$/);
    assert.equal(await sql("SELECT current_database()"), name);
    assert.equal(
      await sql(
        "SELECT to_regclass('public.bot_workflow_jobs') IS NULL AND to_regclass('public.guilds') IS NULL",
      ),
      "t",
    );
    await sql(
      await readFile(
        new URL("./fixtures/durable-automation-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await sql(
      `INSERT INTO public.guilds(id,guild_id,guild_name) VALUES('${G}','discord-a','Fixture guild');`,
    );
    await sql(
      await readFile(
        new URL(
          "../supabase/migrations/20261110193958_bot_durable_automation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await t.test(
      "12 simultaneous moderation claims produce one owner; an expired owner cannot finish its replacement",
      async () => {
        const id = await sql(
          `INSERT INTO public.moderation_scheduled_actions(guild_id,discord_guild_id,action_type,target_id,execute_at,created_by_id,status) VALUES('${G}','discord-a','unban','member',now()-interval '1 minute','staff','executing') RETURNING id;`,
        );
        const claims = await Promise.all(
          Array.from({ length: 12 }, () =>
            value(
              `SET ROLE service_role; SELECT coalesce(public.bot_claim_operational_job('moderation','${id}'),'null'::jsonb);`,
            ),
          ),
        );
        const first = claims.filter(Boolean);
        assert.equal(first.length, 1);
        await sql(
          `UPDATE public.moderation_scheduled_actions SET lease_expires_at=now()-interval '1 second' WHERE id='${id}'`,
        );
        const next = await value(
          `SET ROLE service_role; SELECT public.bot_claim_operational_job('moderation','${id}');`,
        );
        assert.notEqual(next.lease_token, first[0].lease_token);
        assert.equal(
          await sql(
            `SET ROLE service_role; SELECT public.bot_finish_operational_job('moderation','${id}','${first[0].lease_token}',true);`,
          ),
          "f",
        );
        assert.equal(
          await sql(
            `SET ROLE service_role; SELECT public.bot_finish_operational_job('moderation','${id}','${next.lease_token}',true);`,
          ),
          "t",
        );
      },
    );
    await t.test(
      "12 simultaneous scanners create one active alert",
      async () => {
        const ids = await Promise.all(
          Array.from({ length: 12 }, () =>
            sql(
              `SET ROLE service_role; SELECT public.bot_upsert_operational_alert('${G}','command-health','fixture','Fixture','Fixture','warning','{"command_name":"fixture"}');`,
            ),
          ),
        );
        assert.equal(new Set(ids).size, 1);
        assert.equal(
          await sql(
            `SELECT count(*) FROM public.dashboard_notifications WHERE status<>'resolved' AND dedupe_key='command-health:fixture'`,
          ),
          "1",
        );
      },
    );
    await t.test(
      "parallel ingestion captures 1100 source events once and cursor persists across callers",
      async () => {
        await sql(`INSERT INTO public.automation_workflows(guild_id,name,trigger_type,created_at) VALUES('${G}','Fixture','ticket_created',now()-interval '1 day');
      UPDATE public.bot_workflow_cursors SET started_at=now()-interval '1 hour',scanned_at=now()-interval '1 hour' WHERE guild_id='${G}';
      INSERT INTO public.tickets(guild_id,channel_id,creator_id,created_at) SELECT '${G}','channel','member',now()-interval '10 seconds' FROM generate_series(1,1100);`);
        const counts = await Promise.all(
          Array.from({ length: 8 }, () =>
            sql(
              `SET ROLE service_role; SELECT public.bot_ingest_workflow_events('${G}');`,
            ),
          ),
        );
        assert.equal(
          counts.map(Number).reduce((a, b) => a + b, 0),
          1100,
        );
        assert.equal(
          await sql("SELECT count(*) FROM public.bot_workflow_jobs"),
          "1100",
        );
        assert.equal(
          await sql(
            `SET ROLE service_role; SELECT public.bot_ingest_workflow_events('${G}');`,
          ),
          "0",
        );
      },
    );
    await t.test(
      "backend functions and internal queue writes are denied to browser roles",
      async () => {
        assert.equal(
          await sql(
            "SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('bot_claim_operational_job','bot_ingest_workflow_events','bot_workflow_action','bot_upsert_operational_alert') AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))",
          ),
          "0",
        );
        await assert.rejects(
          sql(
            "SET ROLE authenticated; UPDATE public.bot_workflow_jobs SET status='success'",
          ),
          /permission denied/,
        );
      },
    );
  },
);
