// Opt-in real connection tests. Requires a new, disposable database ending _test.
// SHOP_TEST_DATABASE_NAME=bot_shop_test SHOP_TEST_PSQL='["docker","exec","-i","supabase-db","psql","-U","supabase_admin","-d","bot_shop_test"]'
// node --test tests/shop-orders-postgres.integration.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const argv = process.env.SHOP_TEST_PSQL
  ? JSON.parse(process.env.SHOP_TEST_PSQL)
  : null;
const GUILD = "10000000-0000-0000-0000-000000000001";
const ITEM = "20000000-0000-0000-0000-000000000001";
const ROLE = "223456789012345678";
function sql(source) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      argv[0],
      [...argv.slice(1), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())),
    );
    p.stdin.end(source);
  });
}
async function value(source) {
  const result = (await sql(source)).split("\n").at(-1);
  return result ? JSON.parse(result) : null;
}
const reserve = (id, user, item = ITEM) =>
  value(
    `SET ROLE service_role; SET statement_timeout='15s'; SELECT public.bot_shop_reserve('${id}','${GUILD}','${user}','buyer','${item}','${ROLE}',20);`,
  );
const claim = (id) =>
  value(`SET ROLE service_role; SELECT public.bot_shop_claim('${id}',90);`);
const finish = (id, token, outcome) =>
  value(
    `SET ROLE service_role; SELECT public.bot_shop_finish('${id}','${token}','${outcome}',NULL,false);`,
  );
async function account(user) {
  await sql(
    `INSERT INTO public.economy_accounts(guild_id,user_id,wallet) VALUES('${GUILD}','${user}',100);`,
  );
}
async function reset() {
  await sql(
    "TRUNCATE public.economy_purchases,public.bot_shop_orders,public.economy_transactions,public.economy_accounts RESTART IDENTITY CASCADE; UPDATE public.economy_shop_items SET stock=2;",
  );
}

test(
  "durable role purchases in independent PostgreSQL sessions",
  { skip: !argv, timeout: 120000 },
  async (t) => {
    const db = process.env.SHOP_TEST_DATABASE_NAME || "bot_shop_test";
    assert.match(db, /_test$/);
    assert.equal(await sql("SELECT current_database()"), db);
    assert.equal(
      await sql("SELECT to_regclass('public.bot_shop_orders') IS NULL"),
      "t",
    );
    assert.equal(
      await sql("SELECT to_regclass('public.guilds') IS NULL"),
      "t",
      "Use a fresh isolated database",
    );
    await sql(
      await readFile(
        new URL("./fixtures/shop-orders-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await sql(
      await readFile(
        new URL(
          "../supabase/migrations/20261110193956_bot_reliable_role_purchases.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await sql(
      `INSERT INTO public.guilds VALUES('${GUILD}','123456789012345678'); INSERT INTO public.economy_shop_items(id,guild_id,name,price,role_id,stock) VALUES('${ITEM}','${GUILD}','VIP',20,'${ROLE}',2);`,
    );

    await t.test(
      "eight duplicate deliveries debit and reserve once",
      async () => {
        await account("1");
        const results = await Promise.all(
          Array.from({ length: 8 }, () => reserve("1001", "1")),
        );
        assert.ok(results.every((r) => r.ok));
        assert.equal(new Set(results.map((r) => r.order.id)).size, 1);
        assert.equal(results.filter((r) => !r.replayed).length, 1);
        assert.equal(
          await sql(
            "SELECT wallet FROM public.economy_accounts WHERE user_id='1'",
          ),
          "80",
        );
        assert.equal(
          await sql(
            `SELECT stock FROM public.economy_shop_items WHERE id='${ITEM}'`,
          ),
          "1",
        );
        assert.equal(
          await sql("SELECT count(*) FROM public.economy_transactions"),
          "1",
        );
      },
    );
    await t.test(
      "last stock cannot be sold twice to concurrent buyers",
      async () => {
        await reset();
        await sql(
          `UPDATE public.economy_shop_items SET stock=1 WHERE id='${ITEM}'`,
        );
        await Promise.all(["11", "12", "13", "14", "15", "16"].map(account));
        const results = await Promise.all(
          ["11", "12", "13", "14", "15", "16"].map((u, i) =>
            reserve(String(2000 + i), u),
          ),
        );
        assert.equal(results.filter((r) => r.ok).length, 1);
        assert.equal(
          results.filter((r) => r.reason === "out_of_stock").length,
          5,
        );
        assert.equal(
          await sql("SELECT sum(wallet) FROM public.economy_accounts"),
          "580",
        );
        assert.equal(
          await sql("SELECT count(*) FROM public.economy_transactions"),
          "1",
        );
      },
    );
    await t.test(
      "competing workers and repeated refunds change funds and stock once",
      async () => {
        await reset();
        await account("21");
        const order = (await reserve("3001", "21")).order;
        const claims = await Promise.all(
          Array.from({ length: 8 }, () => claim(order.id)),
        );
        const winner = claims.filter(Boolean);
        assert.equal(winner.length, 1);
        const refunds = await Promise.all(
          Array.from({ length: 8 }, () =>
            finish(order.id, winner[0].lease_token, "refund"),
          ),
        );
        assert.equal(refunds.filter(Boolean).length, 1);
        assert.equal(
          await sql(
            "SELECT wallet FROM public.economy_accounts WHERE user_id='21'",
          ),
          "100",
        );
        assert.equal(
          await sql(
            `SELECT stock FROM public.economy_shop_items WHERE id='${ITEM}'`,
          ),
          "2",
        );
        assert.equal(
          await sql(
            "SELECT count(*) FROM public.economy_transactions WHERE transaction_type='shop_refund'",
          ),
          "1",
        );
      },
    );
    await t.test(
      "simultaneous purchase and refund use additive stock restoration",
      async () => {
        await reset();
        await account("31");
        await account("32");
        const order = (await reserve("4001", "31")).order;
        const lease = await claim(order.id);
        const results = await Promise.all([
          finish(order.id, lease.lease_token, "refund"),
          reserve("4002", "32"),
        ]);
        assert.equal(results[0].status, "refunded");
        assert.equal(results[1].ok, true);
        assert.equal(
          await sql(
            `SELECT stock FROM public.economy_shop_items WHERE id='${ITEM}'`,
          ),
          "1",
        );
        assert.equal(
          await sql("SELECT sum(wallet) FROM public.economy_accounts"),
          "180",
        );
      },
    );
    await t.test(
      "ledger failures roll back the entire reservation",
      async () => {
        await reset();
        await account("41");
        await sql(
          "CREATE FUNCTION public.test_ledger_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger unavailable'; END $$; CREATE TRIGGER shop_test_error BEFORE INSERT ON public.economy_transactions FOR EACH ROW EXECUTE FUNCTION public.test_ledger_error();",
        );
        await assert.rejects(reserve("5001", "41"), /ledger unavailable/);
        assert.equal(
          await sql(
            "SELECT wallet FROM public.economy_accounts WHERE user_id='41'",
          ),
          "100",
        );
        assert.equal(
          await sql(
            `SELECT stock FROM public.economy_shop_items WHERE id='${ITEM}'`,
          ),
          "2",
        );
        assert.equal(
          await sql("SELECT count(*) FROM public.bot_shop_orders"),
          "0",
        );
        await sql(
          "DROP TRIGGER shop_test_error ON public.economy_transactions; DROP FUNCTION public.test_ledger_error();",
        );
      },
    );
    await t.test(
      "expired worker cannot acknowledge a replacement lease",
      async () => {
        await reset();
        await account("51");
        const order = (await reserve("6001", "51")).order;
        const old = await claim(order.id);
        await sql(
          `UPDATE public.bot_shop_orders SET lease_expires_at=now()-interval '1 second',attempted_delivery=true WHERE id='${order.id}'`,
        );
        const replacement = await claim(order.id);
        assert.notEqual(old.lease_token, replacement.lease_token);
        assert.equal(replacement.delivery_uncertain, true);
        assert.equal(await finish(order.id, old.lease_token, "refund"), null);
        const guarded = await finish(
          order.id,
          replacement.lease_token,
          "refund",
        );
        assert.equal(guarded.status, "manual_review");
        assert.equal(
          await sql(
            "SELECT wallet FROM public.economy_accounts WHERE user_id='51'",
          ),
          "80",
        );
      },
    );
    await t.test(
      "browser roles cannot reserve, acknowledge or refund orders",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await assert.rejects(
            sql(
              `SET ROLE ${role}; SELECT public.bot_shop_reserve('7001','${GUILD}','1','buyer','${ITEM}','${ROLE}',20);`,
            ),
            /permission denied/,
          );
          await assert.rejects(
            sql(
              `SET ROLE ${role}; UPDATE public.bot_shop_orders SET status='refunded';`,
            ),
            /permission denied/,
          );
        }
      },
    );
  },
);
