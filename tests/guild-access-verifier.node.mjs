import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
const require = createRequire(import.meta.url);
const {
  setupGuildAccessVerifier,
  isAdministrator,
  VALIDITY_MS,
} = require("../bot/handlers/guildAccessVerifier.js");

function fixture() {
  const rows = [
    {
      id: "a",
      guild_id: "internal-a",
      discord_user_id: "111111111111111112",
      guilds: { guild_id: "111111111111111111" },
      has_admin_permission: false,
      admin_verified_until: null,
    },
    {
      id: "b",
      guild_id: "internal-b",
      discord_user_id: "222222222222222223",
      guilds: { guild_id: "222222222222222222" },
      has_admin_permission: true,
      admin_verified_until: "old",
    },
  ];
  const state = {
    ready: false,
    permissions: 8n,
    memberError: null,
    dbError: false,
    fetches: 0,
  };
  const client = new EventEmitter();
  client.isReady = () => state.ready;
  const guild = {
    ownerId: "other",
    roles: { fetch: async () => {} },
    members: {
      fetch: async (options) => {
        assert.equal(options.force, true);
        state.fetches++;
        if (state.memberError) throw state.memberError;
        return {
          id: options.user,
          permissions: { bitfield: state.permissions },
        };
      },
    },
  };
  client.guilds = {
    fetch: async (options) => {
      assert.equal(options.force, true);
      return guild;
    },
  };
  const db = {
    from(table) {
      const filters = [];
      let patch,
        offset = 0,
        end = rows.length;
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        range(from, to) {
          offset = from;
          end = to + 1;
          return q;
        },
        update(value) {
          patch = value;
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: { id: "internal-a" }, error: null });
        },
        then(resolve, reject) {
          if (state.dbError)
            return Promise.resolve({
              data: null,
              error: Error("database unavailable"),
            }).then(resolve, reject);
          if (patch) {
            for (const row of rows.filter((row) =>
              filters.every(([k, v]) => row[k] === v),
            ))
              Object.assign(row, patch);
            return Promise.resolve({ data: null, error: null }).then(
              resolve,
              reject,
            );
          }
          return Promise.resolve({
            data: rows.slice(offset, end),
            error: null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const worker = setupGuildAccessVerifier(client, db, {
    shouldHandleGuild: (id) => id === "111111111111111111",
  });
  return { rows, state, client, worker, guild };
}

test("Discord verification renews only the assigned guild and revokes a lost administrator role", async () => {
  const f = fixture();
  try {
    f.state.ready = true;
    const before = Date.now();
    await f.worker.scan();
    assert.equal(f.rows[0].has_admin_permission, true);
    assert.ok(
      Date.parse(f.rows[0].admin_verified_until) >= before + VALIDITY_MS,
    );
    assert.equal(f.rows[1].admin_verified_until, "old");
    f.state.permissions = 0n;
    await f.worker.scan();
    assert.equal(f.rows[0].has_admin_permission, false);
    assert.equal(f.rows[0].admin_verified_until, null);
  } finally {
    f.worker.cleanup();
  }
  assert.equal(f.client.eventNames().length, 0);
});
test("revocation clears an existing claim before failed Discord validation and missing members stay revoked", async () => {
  const f = fixture();
  try {
    f.state.ready = true;
    await f.worker.scan();
    f.state.memberError = Error("Discord timeout");
    await f.worker.invalidate("111111111111111111", "111111111111111112");
    assert.equal(f.rows[0].has_admin_permission, false);
    assert.equal(f.rows[0].admin_verified_until, null);
    f.state.memberError = Object.assign(Error("Unknown member"), {
      code: 10007,
    });
    await f.worker.scan();
    assert.equal(f.rows[0].has_admin_permission, false);
  } finally {
    f.worker.cleanup();
  }
});
test("database failures cannot extend verification and cleanup stops further writes", async () => {
  const f = fixture();
  try {
    f.state.ready = true;
    await f.worker.scan();
    const expiry = f.rows[0].admin_verified_until;
    f.state.dbError = true;
    await f.worker.scan();
    assert.equal(f.rows[0].admin_verified_until, expiry);
    f.worker.cleanup();
    f.state.dbError = false;
    f.state.permissions = 0n;
    await f.worker.scan();
    assert.equal(f.rows[0].admin_verified_until, expiry);
  } finally {
    f.worker.cleanup();
  }
});
test("only a confirmed Discord owner or Administrator bit grants administration", () => {
  assert.equal(
    isAdministrator(
      { ownerId: "owner" },
      { id: "owner", permissions: { bitfield: 0n } },
    ),
    true,
  );
  assert.equal(
    isAdministrator(
      { ownerId: "owner" },
      { id: "other", permissions: { bitfield: 32n } },
    ),
    false,
  );
  assert.equal(isAdministrator({ ownerId: "owner" }, null), false);
});
