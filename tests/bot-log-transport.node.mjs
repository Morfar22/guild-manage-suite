import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createLogTransport } = require("../bot/consoleLogger.js");
const guild = "00000000-0000-4000-8000-000000000001";
function setup(deliver, options = {}) {
  const batches = [],
    delays = [],
    errors = [];
  const client = {
    from(table) {
      assert.equal(table, "bot_console_logs");
      return {
        upsert(rows, config) {
          assert.equal(config.ignoreDuplicates, true);
          batches.push(structuredClone(rows));
          return {
            abortSignal(signal) {
              assert.ok(signal instanceof AbortSignal);
              return deliver(rows);
            },
          };
        },
      };
    },
  };
  const transport = createLogTransport({
    client,
    schedule(_cb, ms) {
      delays.push(ms);
      return { unref() {} };
    },
    cancel() {},
    errorSink: (x) => errors.push(x),
    ...options,
  });
  return { transport, batches, delays, errors };
}
test("returned Supabase errors retain logs and retry with stable IDs", async () => {
  let failed = true;
  const t = setup(async () => ({ error: failed ? new Error("down") : null }));
  t.transport.log(guild, "error", "tickets", "failed");
  assert.equal(await t.transport.flush(), false);
  assert.equal(t.transport.state().buffered, 1);
  assert.equal(t.delays.at(-1), 4000);
  failed = false;
  assert.equal(await t.transport.flush(), true);
  assert.equal(t.transport.state().buffered, 0);
  assert.equal(t.batches[0][0].id, t.batches[1][0].id);
  t.transport.close();
});
test("concurrent flushes share one request and preserve logs queued in flight", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let calls = 0;
  const t = setup(
    async () => {
      if (++calls === 1) await gate;
      return { error: null };
    },
    { batchSize: 1 },
  );
  t.transport.log(guild, "info", "bot", "first");
  const first = t.transport.flush();
  t.transport.log(guild, "info", "bot", "second");
  const second = t.transport.flush();
  assert.equal(calls, 1);
  release();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(calls, 2);
  assert.equal(t.transport.state().buffered, 0);
  t.transport.close();
});
test("bounded buffer preserves errors and caps failure backoff", async () => {
  const t = setup(
    async () => {
      throw Error("down");
    },
    { maxBuffer: 3 },
  );
  t.transport.log(guild, "error", "system", "important");
  for (let i = 0; i < 100; i++)
    t.transport.log(guild, "debug", "system", "routine");
  assert.deepEqual(t.transport.state(), {
    buffered: 3,
    dropped: 98,
    attempts: 0,
  });
  for (let i = 0; i < 8; i++) await t.transport.flush();
  assert.ok(
    t.batches.every((batch) =>
      batch.some((row) => row.message === "important"),
    ),
  );
  assert.equal(t.delays.at(-1), 60000);
  t.transport.close();
});
test("logs redact nested credentials and normalize system/snowflake IDs to null", async () => {
  process.env.TRANSPORT_TEST_SECRET = "known-private-fixture-value";
  try {
    const t = setup(async () => ({ error: null }));
    const cyclic = {
      password: "sensitive",
      nested: {
        authorization: "Bearer hidden",
        note: process.env.TRANSPORT_TEST_SECRET,
      },
    };
    cyclic.self = cyclic;
    t.transport.log(
      "1501891897663295538",
      "error",
      "system",
      "Bearer not-public",
      cyclic,
    );
    t.transport.log(
      "00000000-0000-0000-0000-000000000000",
      "warn",
      "system",
      "old-zero-id",
    );
    t.transport.log(guild, "info", "heartbeat", "ok", { latency_ms: 123 });
    await t.transport.flush();
    const [a, b, c] = t.batches[0];
    assert.equal(a.guild_id, null);
    assert.equal(b.guild_id, null);
    assert.equal(c.guild_id, guild);
    const encoded = JSON.stringify(a);
    for (const secret of [
      "sensitive",
      "hidden",
      "known-private-fixture-value",
      "not-public",
    ])
      assert.ok(!encoded.includes(secret));
    assert.match(encoded, /REDACTED/);
    assert.match(encoded, /Circular/);
    t.transport.close();
  } finally {
    delete process.env.TRANSPORT_TEST_SECRET;
  }
});

test("deleted guild IDs become system logs without losing valid guild entries", async () => {
  const missing = "00000000-0000-4000-8000-000000000099";
  const batches = [];
  const client = {
    from(table) {
      if (table === "guilds")
        return {
          select() {
            return this;
          },
          in(_field, ids) {
            assert.deepEqual(ids, [guild, missing]);
            return this;
          },
          abortSignal() {
            return Promise.resolve({ error: null, data: [{ id: guild }] });
          },
        };
      return {
        upsert(rows) {
          batches.push(structuredClone(rows));
          return {
            abortSignal() {
              return Promise.resolve({
                error: rows.some((row) => row.guild_id === missing)
                  ? { code: "23503" }
                  : null,
              });
            },
          };
        },
      };
    },
  };
  const transport = createLogTransport({
    client,
    schedule() {
      return { unref() {} };
    },
    cancel() {},
    errorSink() {},
  });
  transport.log(guild, "error", "job", "valid");
  transport.log(missing, "error", "job", "deleted");
  assert.equal(await transport.flush(), false);
  assert.equal(await transport.flush(), true);
  assert.equal(batches[1][0].guild_id, guild);
  assert.equal(batches[1][1].guild_id, null);
  assert.equal(batches[1][1].metadata.unavailable_guild_id, missing);
  assert.equal(batches[0][1].id, batches[1][1].id);
  assert.equal(transport.state().buffered, 0);
  transport.close();
});

test("routine logs cannot evict a buffer full of unacknowledged errors", async () => {
  const t = setup(async () => ({ error: null }), { maxBuffer: 2 });
  t.transport.log(guild, "error", "system", "first error");
  t.transport.log(guild, "error", "system", "second error");
  t.transport.log(guild, "info", "heartbeat", "routine");
  assert.equal(t.transport.state().dropped, 1);
  await t.transport.flush();
  assert.deepEqual(
    t.batches[0].map((row) => row.message),
    ["first error", "second error"],
  );
  t.transport.close();
});
