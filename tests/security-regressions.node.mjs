import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
// Run the actual handlers, replacing only the transport, router and database boundaries.
function load(
  file,
  {
    supabase,
    interval = () => {
      throw Error("Unexpected interval");
    },
    fetch: transport = async () => {
      throw Error("Unexpected network call");
    },
  } = {},
) {
  const cache = new Map();
  let edgeHandler;
  const runtimeProcess = {
    env: {
      SUPABASE_URL: "https://db.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test",
      DISCORD_BOT_TOKEN: "test-token",
      BOT_SECRET_KEY: "test-secret",
      DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-client-secret",
    },
  };
  function evaluate(filename) {
    filename = path.resolve(root, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
      fileName: filename,
    }).outputText;
    const require = (name) => {
      if (
        name.startsWith("https://deno.land/") &&
        name.endsWith("/http/server.ts")
      )
        return {
          serve: (handler) => {
            edgeHandler = handler;
          },
        };
      if (name.includes("@supabase/supabase-js"))
        return { createClient: () => supabase };
      if (name === "@tanstack/react-router")
        return { createFileRoute: () => (options) => options };
      if (name.startsWith("@/"))
        return evaluate(path.join("src", name.slice(2)) + ".ts");
      if (name.startsWith("."))
        return evaluate(path.resolve(path.dirname(filename), name));
      return nativeRequire(name);
    };
    new Function(
      "require",
      "module",
      "exports",
      "process",
      "fetch",
      "Deno",
      "setInterval",
      code,
    )(
      require,
      module,
      module.exports,
      runtimeProcess,
      transport,
      {
        env: { get: (key) => runtimeProcess.env[key] },
        serve: (handler) => {
          edgeHandler = handler;
        },
      },
      interval,
    );
    return module.exports;
  }
  const exports = evaluate(file);
  return {
    exports,
    env: runtimeProcess.env,
    call: (req) =>
      exports.Route
        ? exports.Route.server.handlers[req.method]({ request: req })
        : edgeHandler(req),
  };
}
function database({
  user = { id: "user-a" },
  admin = true,
  discordFailure = false,
} = {}) {
  const queries = [];
  const client = {
    auth: {
      getUser: async (token) =>
        token === "valid"
          ? { data: { user }, error: null }
          : { data: { user: null }, error: Error("invalid") },
    },
    from(table) {
      const query = { table, filters: [], operation: "select" };
      queries.push(query);
      const builder = {
        select() {
          return this;
        },
        eq(key, value) {
          query.filters.push([key, value]);
          return this;
        },
        is() {
          return this;
        },
        insert(row) {
          query.operation = "insert";
          query.row = row;
          return this;
        },
        update(row) {
          query.operation = "update";
          query.row = row;
          return this;
        },
        async single() {
          return result();
        },
        async maybeSingle() {
          return result();
        },
        then(resolve, reject) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      function result() {
        if (table === "user_guilds")
          return { data: admin ? { has_admin_permission: true } : null };
        if (table === "guilds")
          return { data: { id: "guild-a", guild_id: "111111111111111111" } };
        if (table === "guild_bot_settings") return { data: null };
        if (table === "application_submissions")
          return {
            data: {
              id: "submission-a",
              guild_id: "guild-a",
              form: { ai_screening_enabled: true },
            },
          };
        if (table === "tickets")
          return { data: { id: "ticket-a", guild_id: "guild-a" } };
        if (table === "polls")
          return {
            data: {
              id: "poll-a",
              guild_id: "guild-a",
              channel_id: "222222222222222222",
              options: [],
              message_id: "already-sent",
            },
          };
        if (table === "server_backups") {
          const scoped = query.filters.some(
            ([key, value]) => key === "guild_id" && value === "guild-a",
          );
          const foreign = query.filters.some(
            ([key, value]) => key === "id" && value === "foreign-backup",
          );
          return foreign && scoped
            ? { data: null, error: Error("not found") }
            : { data: { id: "backup-a", guild_id: "guild-a" }, error: null };
        }
        return { data: null, error: discordFailure ? Error("failed") : null };
      }
      return builder;
    },
  };
  return { client, queries };
}
function request(endpoint, body, token, extra = {}) {
  return new Request(
    `https://bot.nethost-solutions.dk/api/public/${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
      },
      body: JSON.stringify(body),
    },
  );
}
const bodies = {
  "send-embed": {
    guildId: "guild-a",
    channelId: "222222222222222222",
    embed: { title: "test" },
  },
  "send-poll": { pollId: "poll-a" },
  "ai-screen-application": { submission_id: "submission-a" },
  "ai-ticket-summary": { action: "summarize", data: { ticket_id: "ticket-a" } },
  "send-verification-panel": { guildId: "guild-a" },
  "server-backup": { guildId: "guild-a", action: "create" },
  "ai-chat": { guildId: "guild-a", action: "get_settings" },
  "jtc-handler": { guildId: "guild-a", action: "get_settings" },
};
for (const runtime of ["routes", "edge"]) {
  const file = (name) =>
    runtime === "routes"
      ? `src/routes/api/public/${name}.ts`
      : `supabase/functions/${name}/index.ts`;
  for (const [name, body] of Object.entries(bodies)) {
    test(`${runtime}: ${name} rejects missing/invalid login and foreign guilds`, async () => {
      for (const [token, admin, expected] of [
        [undefined, true, 401],
        ["invalid", true, 401],
        ["valid", false, 403],
      ]) {
        const { client, queries } = database({ admin });
        const handler = load(file(name), { supabase: client });
        assert.equal(
          (await handler.call(request(name, body, token))).status,
          expected,
        );
        assert.equal(
          queries.some((query) => query.operation !== "select"),
          false,
        );
      }
    });
  }
  test(`${runtime}: send-embed rejects channels from another Discord guild`, async () => {
    let sends = 0;
    const { client } = database();
    const handler = load(file("send-embed"), {
      supabase: client,
      fetch: async (_url, init) => {
        if (init.method === "POST") sends++;
        return Response.json({ guild_id: "another-guild" });
      },
    });
    assert.equal(
      (await handler.call(request("send-embed", bodies["send-embed"], "valid")))
        .status,
      403,
    );
    assert.equal(sends, 0);
  });
  test(`${runtime}: authorized send-embed still delivers`, async () => {
    let sends = 0;
    const { client } = database();
    const handler = load(file("send-embed"), {
      supabase: client,
      fetch: async (_url, init) => {
        if (init.method === "POST") {
          sends++;
          return Response.json({ id: "message-a" });
        }
        return Response.json({ guild_id: "111111111111111111" });
      },
    });
    const response = await handler.call(
      request("send-embed", bodies["send-embed"], "valid"),
    );
    assert.equal(response.status, 200);
    assert.equal(sends, 1);
  });
  test(`${runtime}: failed Discord backups are never saved`, async () => {
    const { client, queries } = database();
    const handler = load(file("server-backup"), {
      supabase: client,
      fetch: async () =>
        Response.json({ error: "Discord unavailable" }, { status: 503 }),
    });
    assert.equal(
      (
        await handler.call(
          request("server-backup", bodies["server-backup"], "valid"),
        )
      ).status,
      502,
    );
    assert.equal(
      queries.some((query) => query.operation === "insert"),
      false,
    );
  });
  test(`${runtime}: restore cannot read foreign backups or report a fake success`, async () => {
    const { client } = database();
    const handler = load(file("server-backup"), { supabase: client });
    for (const [id, status] of [
      ["foreign-backup", 404],
      ["backup-a", 501],
    ]) {
      const response = await handler.call(
        request(
          "server-backup",
          { guildId: "guild-a", action: "restore", backupId: id },
          "valid",
        ),
      );
      assert.equal(response.status, status);
      assert.equal((await response.json()).backup, undefined);
    }
  });
  for (const name of ["analytics-aggregate", "auto-report"]) {
    test(`${runtime}: ${name} rejects public anon keys and missing bot configuration`, async () => {
      const handler = load(file(name));
      assert.equal(
        (await handler.call(request(name, {}, "public-anon-key"))).status,
        401,
      );
      delete handler.env.BOT_SECRET_KEY;
      assert.equal(
        (
          await handler.call(
            request(name, {}, undefined, { "x-bot-secret": "test-secret" }),
          )
        ).status,
        401,
      );
    });
  }
  test(`${runtime}: guild-bot-config fails closed when bot secret is absent`, async () => {
    const handler = load(file("guild-bot-config"));
    delete handler.env.BOT_SECRET_KEY;
    assert.equal(
      (
        await handler.call(
          request("guild-bot-config", { action: "list_active" }, undefined, {
            "x-bot-secret": "default-encryption-key",
          }),
        )
      ).status,
      503,
    );
  });
  test(`${runtime}: OAuth binds login to a secure cookie and canonical origin`, async () => {
    const handler = load(file("discord-oauth"));
    const headers = { origin: "https://bot.nethost-solutions.dk" };
    const response = await handler.call(
      request(
        "discord-oauth?action=authorize",
        { redirectUri: `${headers.origin}/auth` },
        undefined,
        headers,
      ),
    );
    assert.equal(response.status, 200);
    const url = new URL((await response.json()).url);
    assert.match(url.searchParams.get("state"), /^[a-f0-9]{64}$/);
    assert.match(
      response.headers.get("set-cookie"),
      /HttpOnly; Secure; SameSite=Lax; Max-Age=600/,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    for (const state of [undefined, "incorrect"]) {
      const callback = await handler.call(
        request(
          "discord-oauth?action=callback",
          { redirectUri: `${headers.origin}/auth`, code: "code", state },
          undefined,
          headers,
        ),
      );
      assert.equal(callback.status, 403);
    }
    assert.equal(
      (
        await handler.call(
          request(
            "discord-oauth?action=authorize",
            { redirectUri: "https://attacker.invalid/auth" },
            undefined,
            headers,
          ),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handler.call(
          request("discord-oauth?action=authorize", {}, undefined, {
            origin: "https://attacker.invalid",
          }),
        )
      ).status,
      403,
    );
  });
}
test("AES-GCM encrypts with fresh nonces, rejects tampering and reads legacy tokens", () => {
  const { encryptBotToken, decryptBotToken } = load(
    "src/lib/server/bot-token-crypto.ts",
  ).exports;
  const secret = "a-long-existing-secret";
  const token = "discord.token.example";
  const first = encryptBotToken(token, secret);
  const second = encryptBotToken(token, secret);
  assert.notEqual(first, second);
  assert.equal(decryptBotToken(first, secret), token);
  assert.throws(() => decryptBotToken(first, "wrong-secret"));
  const parts = first.split(".");
  const tag = Buffer.from(parts[2], "base64url");
  tag[0] ^= 1;
  parts[2] = tag.toString("base64url");
  assert.throws(() => decryptBotToken(parts.join("."), secret));
  assert.throws(() => encryptBotToken(token, ""));
  assert.throws(() => encryptBotToken(token, "default-encryption-key"));
  const legacy = btoa(
    Array.from(token, (char, i) =>
      String.fromCharCode(
        char.charCodeAt(0) ^ secret.charCodeAt(i % secret.length),
      ),
    ).join(""),
  );
  assert.equal(decryptBotToken(legacy, secret), token);
  const edge = load("supabase/functions/_shared/bot-token-crypto.ts").exports;
  assert.equal(edge.decryptBotToken(first, secret), token);
});
test("OAuth state accepts matching browser cookies only", () => {
  const { createOAuthState, validOAuthState } = load(
    "src/lib/server/discord-oauth-security.ts",
  ).exports;
  const { state, cookie } = createOAuthState();
  const req = new Request("https://bot.nethost-solutions.dk", {
    headers: { cookie: cookie.split(";")[0] },
  });
  assert.equal(validOAuthState(req, state), true);
  assert.equal(validOAuthState(req, "a".repeat(64)), false);
  assert.equal(validOAuthState(new Request(req.url), state), false);
});
test("OAuth finds existing users beyond the first page and propagates lookup errors", async () => {
  const { findAuthUserByEmail } = load(
    "src/lib/server/discord-oauth-security.ts",
  ).exports;
  const pages = [];
  const supabase = {
    auth: {
      admin: {
        listUsers: async ({ page }) => {
          pages.push(page);
          return {
            data: {
              users:
                page === 1
                  ? Array.from({ length: 1000 }, () => ({
                      email: "other@example.com",
                    }))
                  : [{ id: "existing", email: "User@Example.com" }],
            },
          };
        },
      },
    },
  };
  assert.equal(
    (await findAuthUserByEmail(supabase, "user@example.com")).id,
    "existing",
  );
  assert.deepEqual(pages, [1, 2]);
  supabase.auth.admin.listUsers = async () => ({
    error: Error("database unavailable"),
  });
  await assert.rejects(
    findAuthUserByEmail(supabase, "user@example.com"),
    /database unavailable/,
  );
});

test("reaction roles use the actual API origin rather than a literal template string", async () => {
  const calls = [];
  const handler = load("bot/handlers/reactionRoleHandler.js", {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ success: true });
    },
  });
  const events = new Map();
  handler.exports.setupReactionRoleHandler({
    on: (name, callback) => events.set(name, callback),
  });
  await events.get("messageReactionAdd")(
    {
      partial: false,
      emoji: { name: "✅" },
      message: { id: "message", guild: { id: "guild" } },
    },
    { id: "user", username: "user", bot: false },
  );
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://bot.nethost-solutions.dk/api/public/reaction-role-handler",
  );
  assert.equal(calls[0].init.headers["x-bot-secret"], "test-secret");
});

test("auto-report scheduler reaches the configured API and authenticates with the bot secret", async () => {
  let tick;
  const calls = [];
  const handler = load("bot/handlers/autoReportHandler.js", {
    interval: (callback) => {
      tick = callback;
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ sent: 1 });
    },
  });
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    not: async () => ({
      data: [
        {
          guilds: { guild_id: "guild" },
          frequency: "daily",
          last_sent_at: null,
        },
      ],
    }),
  };
  handler.exports.setupAutoReportHandler({}, { from: () => query });
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://bot.nethost-solutions.dk/api/public/auto-report",
  );
  assert.equal(calls[0].init.headers["x-bot-secret"], "test-secret");
  assert.equal(calls[0].init.headers.Authorization, undefined);
});
