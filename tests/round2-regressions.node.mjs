// Audit round 2 regression tests: bot permission checks, race-safe economy,
// reminders, and migration/route security invariants.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "bot", "package.json"));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// ---------------------------------------------------------------- fake db
// Minimal in-memory PostgREST-like builder: select/insert/update with
// eq/is/or/lte filters, maybeSingle and select-after-update.
function createFakeDb(tables) {
  const db = structuredClone(tables);
  const log = [];
  function from(table) {
    const rows = (db[table] ||= []);
    const filters = [];
    let op = "select";
    let patch = null;
    let returning = false;
    const matches = (r) => filters.every((f) => f(r));
    const api = {
      select() {
        if (op !== "select") returning = true;
        return api;
      },
      update(v) {
        op = "update";
        patch = v;
        return api;
      },
      insert(v) {
        op = "insert";
        patch = v;
        return api;
      },
      eq(c, v) {
        filters.push((r) => r[c] === v);
        return api;
      },
      is(c, v) {
        filters.push((r) => (r[c] ?? null) === v);
        return api;
      },
      lte(c, v) {
        filters.push((r) => r[c] <= v);
        return api;
      },
      or(expr) {
        // supports "sent.eq.false,sent.is.null"
        const parts = expr.split(",").map((p) => p.split("."));
        filters.push((r) =>
          parts.some(([c, o, v]) =>
            o === "is" ? (r[c] ?? null) === null : String(r[c]) === v,
          ),
        );
        return api;
      },
      async maybeSingle() {
        const res = await api.then((x) => x);
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      async single() {
        const res = await api.then((x) => x);
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => {
            if (op === "insert") {
              const list = (Array.isArray(patch) ? patch : [patch]).map(
                (r) => ({
                  id: r.id ?? `gen-${rows.length + 1}`,
                  ...r,
                }),
              );
              rows.push(...list);
              log.push({ table, op, rows: list });
              return { data: list, error: null };
            }
            const hit = rows.filter(matches);
            if (op === "update") {
              hit.forEach((r) => Object.assign(r, patch));
              log.push({ table, op, patch, count: hit.length });
              return {
                data: returning ? hit.map((r) => ({ ...r })) : null,
                error: null,
              };
            }
            return { data: hit.map((r) => ({ ...r })), error: null };
          })
          .then(resolve, reject);
      },
    };
    return api;
  }
  return { from, db, log };
}

// ---------------------------------------------------------------- permissions
const { PermissionFlagsBits, PermissionsBitField } = require("discord.js");
const perms = require("../bot/utils/permissions.js");

function fakeInteraction({
  bits,
  guild = true,
  deferred = false,
  raw = false,
} = {}) {
  const calls = [];
  const field = bits === undefined ? undefined : new PermissionsBitField(bits);
  return {
    calls,
    guild: guild ? { id: "1" } : null,
    guildId: guild ? "1" : null,
    deferred,
    replied: false,
    memberPermissions: raw ? undefined : field,
    member: raw
      ? { permissions: String(bits) }
      : field
        ? { permissions: field }
        : null,
    reply: async (p) => calls.push(["reply", p]),
    editReply: async (p) => calls.push(["editReply", p]),
    followUp: async (p) => calls.push(["followUp", p]),
  };
}

test("bot permissions: ManageGuild allowed, missing denied, DMs fail closed", async () => {
  const ok = fakeInteraction({ bits: PermissionFlagsBits.ManageGuild });
  assert.equal(
    await perms.requirePermission(ok, PermissionFlagsBits.ManageGuild, "x"),
    true,
  );
  assert.equal(ok.calls.length, 0);

  const denied = fakeInteraction({ bits: PermissionFlagsBits.SendMessages });
  assert.equal(
    await perms.requirePermission(
      denied,
      PermissionFlagsBits.ManageGuild,
      "nope",
    ),
    false,
  );
  assert.deepEqual(denied.calls, [["reply", { content: "nope", flags: 64 }]]);

  const dm = fakeInteraction({
    bits: PermissionFlagsBits.Administrator,
    guild: false,
  });
  assert.equal(perms.hasPermission(dm, PermissionFlagsBits.ManageGuild), false);
});

test("bot permissions: Administrator implies everything, raw bitfield strings work", () => {
  const admin = fakeInteraction({ bits: PermissionFlagsBits.Administrator });
  assert.equal(
    perms.hasPermission(admin, PermissionFlagsBits.ManageGuild),
    true,
  );
  const raw = fakeInteraction({
    bits: PermissionFlagsBits.ManageGuild,
    raw: true,
  });
  assert.equal(perms.hasPermission(raw, PermissionFlagsBits.ManageGuild), true);
  assert.equal(perms.hasPermission(raw, PermissionFlagsBits.BanMembers), false);
});

test("bot permissions: deferred interactions get the denial via editReply", async () => {
  const i = fakeInteraction({ bits: 0n, deferred: true });
  assert.equal(
    await perms.requirePermission(i, PermissionFlagsBits.Administrator, "no"),
    false,
  );
  assert.deepEqual(i.calls, [["editReply", { content: "no" }]]);
});

test("bot handlers use the shared permission helper", () => {
  assert.match(read("bot/handlers/adminCommands.js"), /requirePermission\(/);
  assert.match(
    read("bot/handlers/extraCommands.js"),
    /checkPermissionOrDeny\(/,
  );
  assert.match(
    read("bot/bot.js"),
    /if \(!interaction\.guild\) \{\s*return interaction/,
  );
});

// ---------------------------------------------------------------- economy
const {
  adjustBalance,
  transferWallet,
} = require("../bot/utils/economyAtomic.js");

test("economy: concurrent transfers cannot double-spend", async () => {
  const fake = createFakeDb({
    economy_accounts: [
      { id: "a", wallet: 100, bank: 0 },
      { id: "b", wallet: 0, bank: 0 },
      { id: "c", wallet: 0, bank: 0 },
    ],
  });
  const results = await Promise.all([
    transferWallet(fake, "a", "b", 100),
    transferWallet(fake, "a", "c", 100),
  ]);
  const okCount = results.filter((r) => r.ok).length;
  assert.equal(okCount, 1, JSON.stringify(results));
  const byId = Object.fromEntries(
    fake.db.economy_accounts.map((r) => [r.id, r.wallet]),
  );
  assert.equal(byId.a, 0);
  assert.equal(byId.b + byId.c, 100);
});

test("economy: insufficient funds and invalid amounts are rejected", async () => {
  const fake = createFakeDb({
    economy_accounts: [{ id: "a", wallet: 5, bank: null }],
  });
  assert.equal(
    (await adjustBalance(fake, "a", { wallet: -10 })).reason,
    "insufficient",
  );
  assert.equal(
    (await transferWallet(fake, "a", "a", 1)).reason,
    "same_account",
  );
  assert.equal(
    (await transferWallet(fake, "a", "b", -1)).reason,
    "invalid_amount",
  );
  const dep = await adjustBalance(fake, "a", { wallet: -5, bank: 5 });
  assert.equal(dep.ok, true);
  assert.deepEqual([dep.account.wallet, dep.account.bank], [0, 5]);
});

test("economy: failed credit refunds the debit", async () => {
  const fake = createFakeDb({
    economy_accounts: [{ id: "a", wallet: 50, bank: 0 }],
  });
  const r = await transferWallet(fake, "a", "missing", 20);
  assert.equal(r.ok, false);
  assert.equal(fake.db.economy_accounts[0].wallet, 50);
});

// ---------------------------------------------------------------- reminders
const reminders = require("../bot/handlers/reminderHandler.js");

function fakeClient() {
  const sent = [];
  return {
    sent,
    channels: {
      fetch: async (id) =>
        id === "missing"
          ? null
          : { id, send: async (p) => sent.push(["channel", id, p]) },
    },
    users: {
      fetch: async (id) => {
        if (id === "nodm") throw new Error("DMs closed");
        return { send: async (p) => sent.push(["dm", id, p]) };
      },
    },
  };
}

test("reminders: resolveInterval supports both schemas", () => {
  assert.equal(
    reminders.resolveInterval({ repeat_interval: "daily" }),
    "daily",
  );
  assert.equal(reminders.resolveInterval({ repeat_interval: "none" }), null);
  assert.equal(
    reminders.resolveInterval({
      is_recurring: true,
      recurrence_interval: "weekly",
    }),
    "weekly",
  );
  assert.equal(reminders.resolveInterval({ repeat_interval: "bogus" }), null);
});

test("reminders: next occurrence skips missed slots and stays in the future", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const next = reminders.computeNextOccurrence(
    "2026-10-10T08:00:00Z",
    "daily",
    now,
  );
  assert.ok(next > now);
  assert.ok(next - now <= 24 * 3600 * 1000);
  assert.equal(
    reminders.computeNextOccurrence("2026-10-10T08:00:00Z", "yearly", now),
    null,
  );
});

test("reminders: due reminder is claimed once, sent, and recurring is rescheduled", async () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const fake = createFakeDb({
    reminders: [
      {
        id: "r1",
        guild_id: "g",
        guilds: { guild_id: "123" },
        target_channel_id: "c1",
        message: "hi",
        remind_at: "2026-10-19T11:59:00.000Z",
        is_recurring: true,
        recurrence_interval: "daily",
        sent: false,
      },
    ],
  });
  const client = fakeClient();
  const [a, b] = await Promise.all([
    reminders.processDueReminders(client, fake, { now }),
    reminders.processDueReminders(client, fake, { now }),
  ]);
  assert.equal(
    a.sent + b.sent,
    1,
    "sent exactly once despite overlapping polls",
  );
  assert.equal(client.sent.length, 1);
  assert.equal(client.sent[0][1], "c1");
  const rows = fake.db.reminders;
  assert.equal(rows.find((r) => r.id === "r1").sent, true);
  const next = rows.filter((r) => r.id !== "r1");
  assert.equal(next.length, 1);
  assert.equal(next[0].sent, false);
  assert.equal(next[0].repeat_interval, "daily");
  assert.ok(new Date(next[0].remind_at) > now);
});

test("reminders: DM targets work without a channel; failed DM falls back to channel", async () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const fake = createFakeDb({
    reminders: [
      {
        id: "dm",
        guild_id: "g",
        guilds: { guild_id: "1" },
        target_user_discord_id: "u1",
        message: "a",
        remind_at: "2026-10-19T00:00:00Z",
        sent: null,
      },
      {
        id: "fb",
        guild_id: "g",
        guilds: { guild_id: "1" },
        channel_id: "c2",
        target_user_discord_id: "nodm",
        message: "b",
        remind_at: "2026-10-19T00:00:00Z",
        sent: false,
      },
      {
        id: "skip",
        guild_id: "g",
        guilds: { guild_id: "other" },
        channel_id: "c3",
        message: "c",
        remind_at: "2026-10-19T00:00:00Z",
        sent: false,
      },
    ],
  });
  const client = fakeClient();
  await reminders.processDueReminders(client, fake, {
    now,
    shouldHandleGuild: (g) => g === "1",
  });
  assert.deepEqual(
    client.sent.map((s) => s.slice(0, 2)),
    [
      ["dm", "u1"],
      ["channel", "c2"],
    ],
  );
  assert.equal(fake.db.reminders.find((r) => r.id === "skip").sent, false);
});

// ---------------------------------------------------------------- invariants
test("migrations: tenant isolation and self-granted admin fixes are present", () => {
  const iso = read(
    "supabase/migrations/20261019201000_audit_tenant_isolation_policies.sql",
  );
  for (const t of [
    "raid_protection_settings",
    "webhook_configs",
    "fivem_role_permissions",
    "server_backups",
    "tiktok_accounts",
    "polls",
  ]) {
    assert.match(iso, new RegExp(`'${t}'`), t);
  }
  assert.match(iso, /ug\.has_admin_permission = true/);
  const ug = read(
    "supabase/migrations/20261019202000_audit_block_self_granted_guild_admin.sql",
  );
  assert.match(
    ug,
    /DROP POLICY IF EXISTS "Users can insert their own guild links" ON public\.user_guilds/,
  );
  const v3 = read(
    "supabase/migrations/20261019200000_audit_enable_rls_platform_v3_tables.sql",
  );
  for (const t of [
    "moderation_evidence",
    "ticket_internal_notes",
    "automation_workflows",
  ]) {
    assert.match(v3, new RegExp(`'${t}'`));
  }
  assert.match(v3, /ENABLE ROW LEVEL SECURITY/);
});

test("api routes: guild-admin checks on previously unguarded dashboard routes", () => {
  for (const name of [
    "tebex-handler",
    "tiktok-test-notify",
    "giveaway-handler",
    "xp-handler",
    "application-handler",
    "twitch-handler",
  ]) {
    assert.match(
      read(`src/routes/api/public/${name}.ts`),
      /requireGuildAdmin\(/,
      name,
    );
    assert.match(
      read(`supabase/functions/${name}/index.ts`),
      /requireGuildAdmin\(/,
      `edge ${name}`,
    );
  }
  const twitch = read("src/routes/api/public/twitch-handler.ts");
  assert.doesNotMatch(twitch, /action === "check" && !safeEqual/);
  assert.match(
    read("src/hooks/useTwitchStreamers.ts"),
    /twitch-handler\?action=lookup/,
  );
  const app = read("src/routes/api/public/application-handler.ts");
  assert.match(
    app,
    /\["send_panel", "review", "get_form"\]\.includes\(action\)/,
  );
});

test("api routes: no plain === comparison of bot secrets", () => {
  const dirs = ["src/routes/api/public", "supabase/functions"];
  const offenders = [];
  for (const d of dirs) {
    const files = fs
      .readdirSync(path.join(root, d), { recursive: true })
      .filter((f) => String(f).endsWith(".ts"));
    for (const f of files) {
      const src = read(path.join(d, String(f)));
      if (
        /(botSecret|BotSecret|botSecretKey|expectedSecret|encryptionKey|expectedKey)\s*[!=]==\s*\w*(Secret|Key|secret|botAuthHeader|apiKey)\b/.test(
          src,
        )
      )
        offenders.push(`${d}/${f}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("edge functions import _shared modules with explicit .ts extensions", () => {
  const files = fs
    .readdirSync(path.join(root, "supabase/functions"), { recursive: true })
    .filter((f) => String(f).endsWith(".ts"));
  const bad = files.filter((f) =>
    /from "\.\.\/_shared\/[\w-]+"/.test(
      read(path.join("supabase/functions", String(f))),
    ),
  );
  assert.deepEqual(bad, []);
});
