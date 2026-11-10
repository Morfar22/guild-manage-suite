// Run against a disposable PostgreSQL database, never the application's DB:
// ECONOMY_TEST_PSQL='["psql","postgresql://.../bot_economy_test"]'
// node --test tests/economy-postgres.integration.mjs
// A docker exec/psql argv array also works; concurrent calls spawn independent
// PostgreSQL sessions. This file is deliberately outside the offline test glob.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const argv = process.env.ECONOMY_TEST_PSQL
  ? JSON.parse(process.env.ECONOMY_TEST_PSQL)
  : null;
const guild = "10000000-0000-0000-0000-000000000001";
const otherGuild = "10000000-0000-0000-0000-000000000002";
function sql(source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      argv[0],
      [...argv.slice(1), "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "",
      error = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      error += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error.trim())),
    );
    child.stdin.end(source);
  });
}
async function value(source) {
  return JSON.parse((await sql(source)).split("\n").at(-1));
}
async function account(user, wallet, bank = 0, g = guild) {
  await sql(
    `INSERT INTO public.economy_accounts(guild_id,user_id,wallet,bank) VALUES('${g}','${user}',${wallet},${bank});`,
  );
}
function operation(
  kind,
  receipt,
  user,
  amount = null,
  target = null,
  g = guild,
) {
  return `SELECT public.bot_economy_operation('${kind}','${receipt}','${g}','${user}',${amount ?? "NULL"},${target ? `'${target}'` : "NULL"},'sender','receiver','programmør');`;
}
async function call(...args) {
  return value(
    `SET ROLE service_role; SET statement_timeout='15s'; ${operation(...args)}`,
  );
}
async function wallet(user) {
  return value(
    `SELECT json_build_array(wallet,bank) FROM public.economy_accounts WHERE guild_id='${guild}' AND user_id='${user}';`,
  );
}
async function count(table, where = "true") {
  return Number(
    await sql(`SELECT count(*) FROM public.${table} WHERE ${where};`),
  );
}

test(
  "atomic economy in real PostgreSQL sessions",
  { skip: !argv, timeout: 120_000 },
  async (t) => {
    const testDatabase =
      process.env.ECONOMY_TEST_DATABASE_NAME || "bot_economy_test";
    assert.match(
      testDatabase,
      /_test$/,
      "A dedicated test database is required",
    );
    assert.equal(
      await sql("SELECT current_database();"),
      testDatabase,
      "Refusing to initialize another database",
    );
    assert.equal(
      await sql("SELECT to_regclass('public.economy_accounts') IS NULL;"),
      "t",
      "Use a fresh disposable database",
    );
    await sql(`
    DO $$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;
    CREATE TABLE public.guilds(id uuid PRIMARY KEY);
    INSERT INTO public.guilds VALUES('${guild}'),('${otherGuild}');
    CREATE TABLE public.economy_accounts(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL REFERENCES public.guilds(id),
      user_id text NOT NULL, discord_username text, wallet bigint NOT NULL DEFAULT 0, bank bigint NOT NULL DEFAULT 0,
      total_earned bigint NOT NULL DEFAULT 0,last_daily_at timestamptz,last_work_at timestamptz,
      UNIQUE(guild_id,user_id));
    CREATE TABLE public.economy_transactions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),
      from_user_id text,to_user_id text NOT NULL,amount bigint NOT NULL,transaction_type text NOT NULL,description text);
    CREATE TABLE public.economy_settings(
      guild_id uuid PRIMARY KEY REFERENCES public.guilds(id),daily_amount integer NOT NULL DEFAULT 100,
      daily_cooldown_hours integer NOT NULL DEFAULT 24,work_min integer NOT NULL DEFAULT 30,work_max integer NOT NULL DEFAULT 30,
      work_cooldown_minutes integer NOT NULL DEFAULT 60,starting_balance integer NOT NULL DEFAULT 50);
    INSERT INTO public.economy_settings(guild_id) VALUES('${guild}');
    GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);
    await sql(
      await readFile(
        new URL(
          "../supabase/migrations/20261110182701_bot_atomic_economy.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );

    await t.test(
      "concurrent debits cannot double-spend or create a failed receiver",
      async () => {
        await account("1", 100);
        const results = await Promise.all([
          call("transfer", "1001", "1", 100, "2"),
          call("transfer", "1002", "1", 100, "3"),
        ]);
        assert.equal(results.filter((r) => r.ok).length, 1);
        assert.equal(
          results.filter((r) => r.reason === "insufficient").length,
          1,
        );
        assert.deepEqual(await wallet("1"), [0, 0]);
        assert.equal(
          await sql(
            "SELECT sum(wallet) FROM public.economy_accounts WHERE user_id IN ('1','2','3');",
          ),
          "100",
        );
        assert.equal(
          await count("economy_accounts", "user_id IN ('2','3')"),
          1,
        );
        assert.equal(
          await count("economy_transactions", "from_user_id='1'"),
          1,
        );
      },
    );

    await t.test(
      "the same interaction commits once and rejects another payload",
      async () => {
        await account("11", 100);
        const results = await Promise.all(
          Array.from({ length: 8 }, () =>
            call("transfer", "2001", "11", 20, "12"),
          ),
        );
        assert.ok(results.every((r) => r.ok));
        assert.equal(results.filter((r) => !r.replayed).length, 1);
        assert.equal(new Set(results.map((r) => r.ledger_id)).size, 1);
        assert.deepEqual(await wallet("11"), [80, 0]);
        assert.deepEqual(await wallet("12"), [20, 0]);
        await assert.rejects(
          call("transfer", "2001", "11", 21, "12"),
          /another economy request/,
        );
        assert.equal(
          await count("economy_transactions", "from_user_id='11'"),
          1,
        );
      },
    );

    await t.test(
      "opposite transfers use consistent account lock ordering",
      async () => {
        await account("21", 100);
        await account("22", 100);
        const results = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            call(
              "transfer",
              String(3000 + i),
              i % 2 ? "21" : "22",
              1,
              i % 2 ? "22" : "21",
            ),
          ),
        );
        assert.ok(results.every((r) => r.ok));
        assert.deepEqual(await wallet("21"), [100, 0]);
        assert.deepEqual(await wallet("22"), [100, 0]);
      },
    );

    await t.test(
      "deposit and withdraw preserve funds and reject parallel overdrafts",
      async () => {
        await account("31", 100);
        assert.equal(
          (
            await Promise.all([
              call("deposit", "4001", "31", 100),
              call("deposit", "4002", "31", 100),
            ])
          ).filter((r) => r.ok).length,
          1,
        );
        assert.deepEqual(await wallet("31"), [0, 100]);
        assert.equal(
          (
            await Promise.all([
              call("withdraw", "4003", "31", 100),
              call("withdraw", "4004", "31", 100),
            ])
          ).filter((r) => r.ok).length,
          1,
        );
        assert.deepEqual(await wallet("31"), [100, 0]);
        assert.equal(await count("economy_transactions", "to_user_id='31'"), 2);
      },
    );

    await t.test(
      "concurrent rewards enforce cooldowns and keep transfers",
      async () => {
        const daily = await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            call("daily", String(5000 + i), "41"),
          ),
        );
        assert.equal(daily.filter((r) => r.ok).length, 1);
        assert.equal(daily.filter((r) => r.reason === "cooldown").length, 7);
        assert.deepEqual(await wallet("41"), [150, 0]);
        const [transfer, work] = await Promise.all([
          call("transfer", "5101", "41", 50, "42"),
          call("work", "5102", "41"),
        ]);
        assert.ok(transfer.ok && work.ok);
        assert.deepEqual(await wallet("41"), [130, 0]);
        assert.equal((await call("work", "5103", "41")).reason, "cooldown");
        assert.equal(await count("economy_transactions", "to_user_id='41'"), 2);
      },
    );

    await t.test(
      "ledger errors roll back debit, receiver creation and receipt",
      async () => {
        await account("71", 100);
        await sql(`CREATE FUNCTION public.fail_test_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.from_user_id='71' THEN RAISE EXCEPTION 'forced ledger failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_test_ledger BEFORE INSERT ON public.economy_transactions FOR EACH ROW EXECUTE FUNCTION public.fail_test_ledger();`);
        await assert.rejects(
          call("transfer", "9001", "71", 20, "72"),
          /forced ledger failure/,
        );
        assert.deepEqual(await wallet("71"), [100, 0]);
        assert.equal(await count("economy_accounts", "user_id='72'"), 0);
        assert.equal(
          await count("bot_economy_operations", "interaction_id='9001'"),
          0,
        );
        await sql(
          "DROP TRIGGER fail_test_ledger ON public.economy_transactions; DROP FUNCTION public.fail_test_ledger();",
        );
        assert.equal((await call("transfer", "9001", "71", 20, "72")).ok, true);
      },
    );

    await t.test(
      "random robbery outcomes replay without a second debit",
      async () => {
        await account("81", 10);
        await account("82", 100);
        const first = await call("rob", "9201", "81", null, "82");
        const replay = await call("rob", "9201", "81", null, "82");
        assert.equal(first.ok, true);
        assert.deepEqual({ ...replay, replayed: false }, first);
        assert.equal(
          await count("economy_transactions", "from_user_id IN ('81','82')"),
          1,
        );
        assert.equal(
          Number(
            await sql(
              "SELECT sum(wallet) FROM public.economy_accounts WHERE user_id IN ('81','82');",
            ),
          ),
          first.outcome === "robbed" ? 110 : 110 - first.amount,
        );
      },
    );

    await t.test(
      "invalid input, cross-guild access and browser roles cannot debit",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await assert.rejects(
            sql(
              `SET ROLE ${role}; ${operation("transfer", "9901", "71", 1, "72")}`,
            ),
            /permission denied/,
          );
          await assert.rejects(
            sql(
              `SET ROLE ${role}; SELECT * FROM public.bot_economy_operations;`,
            ),
            /permission denied/,
          );
        }
        assert.equal(
          await sql(
            "SELECT prosecdef FROM pg_proc WHERE oid='public.bot_economy_operation(text,text,uuid,text,bigint,text,text,text,text)'::regprocedure;",
          ),
          "f",
        );
        assert.equal(
          (await call("transfer", "9902", "71", 0, "72")).reason,
          "invalid_amount",
        );
        assert.equal(
          (await call("transfer", "9903", "71", "9007199254740992", "72"))
            .reason,
          "invalid_amount",
        );
        assert.equal(
          (await call("transfer", "9904", "71", 1, "71")).reason,
          "invalid_target",
        );
        assert.equal(
          (await call("transfer", "9905", "71", 1, "72", otherGuild)).reason,
          "not_found",
        );
        assert.deepEqual(await wallet("71"), [80, 0]);
      },
    );
  },
);
