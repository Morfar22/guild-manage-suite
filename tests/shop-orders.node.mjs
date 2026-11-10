import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
const {
  processShopOrder,
  inspectRoleDelivery,
} = require("../bot/utils/shopOrders.js");
const {
  setupCurrencyShopHandler,
} = require("../bot/handlers/currencyShopHandler.js");
const GUILD = "10000000-0000-0000-0000-000000000001";
const OTHER = "10000000-0000-0000-0000-000000000002";
const ITEM = "20000000-0000-0000-0000-000000000001";
const DISCORD = "123456789012345678";
const ROLE = "223456789012345678";
const USER = "323456789012345678";
const fixture = await readFile(
  new URL("./fixtures/shop-orders-schema.sql", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20261110193956_bot_reliable_role_purchases.sql",
    import.meta.url,
  ),
  "utf8",
);
async function database() {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(migration);
  await db.query(
    "INSERT INTO public.guilds VALUES($1,$2),($3,'other-discord')",
    [GUILD, DISCORD, OTHER],
  );
  await db.query(
    "INSERT INTO public.economy_accounts(guild_id,user_id,wallet) VALUES($1,$2,100)",
    [GUILD, USER],
  );
  await db.query(
    "INSERT INTO public.economy_shop_items(id,guild_id,name,price,role_id,stock) VALUES($1,$2,'VIP',20,$3,2)",
    [ITEM, GUILD, ROLE],
  );
  return db;
}
const functions = {
  bot_shop_claim: ["p_id", "p_lease_seconds"],
  bot_shop_extend: ["p_id", "p_token", "p_lease_seconds"],
  bot_shop_mark_attempted: ["p_id", "p_token"],
  bot_shop_finish: ["p_id", "p_token", "p_outcome", "p_error", "p_uncertain"],
};
function adapter(db, { failFinish = false } = {}) {
  return {
    async rpc(name, args) {
      if (failFinish && name === "bot_shop_finish")
        return {
          data: null,
          error: { message: "acknowledgement unavailable" },
        };
      try {
        const names = functions[name];
        assert.ok(names, name);
        const result = await db.query(
          `SELECT public.${name}(${names.map((_, i) => `$${i + 1}`).join(",")}) AS result`,
          names.map((n) => args[n]),
        );
        return { data: result.rows[0].result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
async function reserve(
  db,
  id = "1001",
  user = USER,
  item = ITEM,
  guild = GUILD,
) {
  return (
    await db.query(
      "SELECT public.bot_shop_reserve($1,$2,$3,'buyer',$4,$5,20) AS result",
      [id, guild, user, item, ROLE],
    )
  ).rows[0].result;
}
async function saved(db, id) {
  return (
    await db.query("SELECT * FROM public.bot_shop_orders WHERE id=$1", [id])
  ).rows[0];
}
async function counts(db) {
  return (
    await db.query(`SELECT (SELECT wallet::int FROM public.economy_accounts WHERE user_id='${USER}') AS wallet,
 (SELECT stock FROM public.economy_shop_items WHERE id='${ITEM}') AS stock,
 (SELECT count(*)::int FROM public.economy_transactions WHERE transaction_type='shop_purchase') AS debits,
 (SELECT count(*)::int FROM public.economy_transactions WHERE transaction_type='shop_refund') AS refunds,
 (SELECT count(*)::int FROM public.economy_purchases) AS purchases`)
  ).rows[0];
}
function discord({
  owned = false,
  canManage = true,
  grantError = null,
  applyThenError = false,
} = {}) {
  const state = { owned, adds: 0 };
  const role = { id: ROLE, managed: false };
  const member = {
    roles: {
      cache: { has: () => state.owned },
      async add() {
        state.adds++;
        if (!grantError || applyThenError) state.owned = true;
        if (grantError) throw grantError;
      },
    },
  };
  const guild = {
    id: DISCORD,
    roles: { fetch: async () => role },
    members: {
      fetch: async () => member,
      fetchMe: async () => ({
        permissions: { has: () => canManage },
        roles: { highest: { comparePositionTo: () => 1 } },
      }),
    },
  };
  return { state, guild, client: { guilds: { fetch: async () => guild } } };
}

test("shop reservation is atomic, immutable per interaction and does not double-debit", async () => {
  const db = await database();
  try {
    const a = await reserve(db);
    const duplicate = await reserve(db);
    assert.equal(a.ok, true);
    assert.equal(duplicate.replayed, true);
    assert.equal(duplicate.order.id, a.order.id);
    assert.deepEqual(await counts(db), {
      wallet: 80,
      stock: 1,
      debits: 1,
      refunds: 0,
      purchases: 0,
    });
    await assert.rejects(
      reserve(db, "1001", "423456789012345678"),
      /another shop request/,
    );
    assert.equal((await reserve(db, "1002")).reason, "purchase_pending");
    assert.equal(
      (await reserve(db, "1003", "523456789012345678")).reason,
      "insufficient",
    );
    assert.deepEqual(await counts(db), {
      wallet: 80,
      stock: 1,
      debits: 1,
      refunds: 0,
      purchases: 0,
    });
  } finally {
    await db.close();
  }
});

test("ledger failure rolls back receipt, stock and payment together", async () => {
  const db = await database();
  try {
    await db.exec(
      "CREATE FUNCTION public.test_ledger_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger unavailable'; END $$; CREATE TRIGGER test_ledger BEFORE INSERT ON public.economy_transactions FOR EACH ROW EXECUTE FUNCTION public.test_ledger_failure();",
    );
    await assert.rejects(reserve(db), /ledger unavailable/);
    assert.deepEqual(await counts(db), {
      wallet: 100,
      stock: 2,
      debits: 0,
      refunds: 0,
      purchases: 0,
    });
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM public.bot_shop_orders"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("permanent role refusal refunds balance and current stock once, without a success purchase", async () => {
  const db = await database();
  try {
    const a = await reserve(db);
    await db.query("UPDATE public.economy_shop_items SET stock=0 WHERE id=$1", [
      ITEM,
    ]);
    const d = discord({
      grantError: Object.assign(new Error("Missing Permissions"), {
        code: 50013,
        status: 403,
      }),
    });
    const result = await processShopOrder(d.client, adapter(db), a.order, {
      guild: d.guild,
    });
    assert.equal(result.status, "refunded");
    assert.equal(d.state.adds, 1);
    assert.deepEqual(await counts(db), {
      wallet: 100,
      stock: 1,
      debits: 1,
      refunds: 1,
      purchases: 0,
    });
    assert.equal(
      await processShopOrder(d.client, adapter(db), a.order, {
        guild: d.guild,
      }),
      null,
    );
    assert.equal((await counts(db)).refunds, 1);
  } finally {
    await db.close();
  }
});

test("a restart after Discord success but failed acknowledgement reconciles the role without charging or granting twice", async () => {
  const db = await database();
  try {
    const a = await reserve(db);
    const d = discord();
    await assert.rejects(
      processShopOrder(d.client, adapter(db, { failFinish: true }), a.order, {
        guild: d.guild,
      }),
      /acknowledgement unavailable/,
    );
    assert.equal(d.state.owned, true);
    assert.equal((await saved(db, a.order.id)).status, "processing");
    await db.query(
      "UPDATE public.bot_shop_orders SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [a.order.id],
    );
    const result = await processShopOrder(d.client, adapter(db), a.order, {
      guild: d.guild,
    });
    assert.equal(result.status, "delivered");
    assert.equal(d.state.adds, 1);
    assert.deepEqual(await counts(db), {
      wallet: 80,
      stock: 1,
      debits: 1,
      refunds: 0,
      purchases: 1,
    });
  } finally {
    await db.close();
  }
});

test("ambiguous network failure is reconciled if the role was granted, never refunded blindly", async () => {
  const db = await database();
  try {
    const a = await reserve(db);
    const d = discord({
      grantError: new Error("socket closed"),
      applyThenError: true,
    });
    const pending = await processShopOrder(d.client, adapter(db), a.order, {
      guild: d.guild,
    });
    assert.equal(pending.status, "pending");
    assert.equal(pending.delivery_uncertain, true);
    await db.query(
      "UPDATE public.bot_shop_orders SET next_attempt_at=now() WHERE id=$1",
      [a.order.id],
    );
    const result = await processShopOrder(d.client, adapter(db), a.order, {
      guild: d.guild,
    });
    assert.equal(result.status, "delivered");
    assert.equal(d.state.adds, 1);
    assert.equal((await counts(db)).refunds, 0);
  } finally {
    await db.close();
  }
});

test("exhausted ambiguous deliveries stop for manual review and cannot be refunded by a stale worker", async () => {
  const db = await database();
  try {
    const a = await reserve(db);
    await db.query(
      "UPDATE public.bot_shop_orders SET attempt_count=4 WHERE id=$1",
      [a.order.id],
    );
    const d = discord({ grantError: new Error("timeout") });
    const result = await processShopOrder(d.client, adapter(db), a.order, {
      guild: d.guild,
    });
    assert.equal(result.status, "manual_review");
    assert.equal(result.attempt_count, 5);
    assert.deepEqual(await counts(db), {
      wallet: 80,
      stock: 1,
      debits: 1,
      refunds: 0,
      purchases: 0,
    });
    assert.equal((await reserve(db, "1002")).reason, "purchase_pending");
    const rejected = await db.query(
      "SELECT public.bot_shop_finish($1,$2,'refund',NULL,false) AS result",
      [a.order.id, "90000000-0000-0000-0000-000000000001"],
    );
    assert.equal(rejected.rows[0].result, null);
    assert.equal((await counts(db)).refunds, 0);
  } finally {
    await db.close();
  }
});

test("an already-owned role and missing permissions are detected before payment", async () => {
  const owned = discord({ owned: true });
  assert.equal(
    (await inspectRoleDelivery(owned.guild, USER, ROLE)).alreadyOwned,
    true,
  );
  await assert.rejects(
    inspectRoleDelivery(discord({ canManage: false }).guild, USER, ROLE),
    /mangler Administrer roller/,
  );
  let reservations = 0;
  const replies = [];
  const supabase = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        in() {
          return q;
        },
        or() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        ilike() {
          return q;
        },
        single: async () => ({ data: { id: GUILD }, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) {
          return Promise.resolve({
            data:
              table === "economy_shop_items"
                ? [{ id: ITEM, role_id: ROLE, price: 20 }]
                : [],
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
    rpc() {
      reservations++;
      throw new Error("Must not reserve");
    },
  };
  const handler = setupCurrencyShopHandler(owned.client, supabase);
  try {
    await handler.handleBuyCommand({
      guild: owned.guild,
      id: "1001",
      user: { id: USER, username: "buyer" },
      options: { getString: () => "VIP" },
      deferReply: async () => {},
      editReply: async (p) => replies.push(p.content),
    });
  } finally {
    handler.cleanup();
  }
  assert.equal(reservations, 0);
  assert.match(replies.at(-1), /allerede denne rolle/);
});

test("shop metadata and RPC writes remain inaccessible to anonymous and foreign-guild users", async () => {
  const db = await database();
  try {
    await reserve(db);
    await db.query("INSERT INTO public.user_guilds VALUES($1,$2,true)", [
      "70000000-0000-0000-0000-000000000001",
      OTHER,
    ]);
    await db.exec(
      "SET ROLE authenticated; SET request.jwt.claim.sub='70000000-0000-0000-0000-000000000001';",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM public.bot_shop_orders"))
        .rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("SELECT public.bot_shop_claim($1,90)", [
        "00000000-0000-0000-0000-000000000001",
      ]),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(
      db.query("SELECT * FROM public.bot_shop_orders"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("free role purchases do not create a zero-balance account when delivery is refunded", async () => {
  const db = await database();
  try {
    await db.exec(
      "DELETE FROM public.economy_accounts; UPDATE public.economy_shop_items SET price=0;",
    );
    const result = await db.query(
      "SELECT public.bot_shop_reserve('2001',$1,$2,'buyer',$3,$4,0) AS result",
      [GUILD, USER, ITEM, ROLE],
    );
    const order = result.rows[0].result.order;
    const d = discord({
      grantError: Object.assign(new Error("Missing Permissions"), {
        code: 50013,
        status: 403,
      }),
    });
    assert.equal(
      (await processShopOrder(d.client, adapter(db), order, { guild: d.guild }))
        .status,
      "refunded",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM public.economy_accounts"))
        .rows[0].n,
      0,
    );
    assert.equal((await counts(db)).stock, 2);
  } finally {
    await db.close();
  }
});
