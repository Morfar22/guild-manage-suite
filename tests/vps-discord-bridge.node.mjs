import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  DiscordBridgeError,
  vpsDiscordRequest,
} from "../src/lib/vps-discord-bridge.ts";

const guild = "123456789012345678";
const member = "123456789012345679";
const role = "123456789012345680";
const originalFetch = globalThis.fetch;
const originalUrl = process.env.GUILDOS_BRIDGE_URL;
const originalSecret = process.env.GUILDOS_BRIDGE_SECRET;
let calls;

test("Discord rate limits preserve status and provider retry-after for bulk actions", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { code: "DISCORD_429", retry_after: 2.5 },
      { status: 429, headers: { "Retry-After": "2.5" } },
    );
  await assert.rejects(
    vpsDiscordRequest(guild, `/members/${member}/roles/${role}`, "PUT"),
    (error) =>
      error instanceof DiscordBridgeError &&
      error.status === 429 &&
      error.retryAfter === 2.5,
  );
});

beforeEach(() => {
  calls = [];
  process.env.GUILDOS_BRIDGE_URL = "https://bridge.fixture.invalid/proxy/";
  process.env.GUILDOS_BRIDGE_SECRET = "fixture-only-bridge-secret";
  globalThis.fetch = async (input, options) => {
    calls.push({ url: new URL(input), options });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.GUILDOS_BRIDGE_URL;
  else process.env.GUILDOS_BRIDGE_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.GUILDOS_BRIDGE_SECRET;
  else process.env.GUILDOS_BRIDGE_SECRET = originalSecret;
});

test("members pagination stays in search while preserving the bridge base path", async () => {
  assert.deepEqual(
    await vpsDiscordRequest(guild, "/members?limit=1000&after=0"),
    [],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "https://bridge.fixture.invalid");
  assert.equal(calls[0].url.pathname, `/proxy/v1/guilds/${guild}/members`);
  assert.equal(calls[0].url.search, "?limit=1000&after=0");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer fixture-only-bridge-secret",
  );
});

test("subsequent members page keeps the exact cursor", async () => {
  await vpsDiscordRequest(guild, `/members?limit=1&after=${member}`);
  assert.equal(calls[0].url.searchParams.get("limit"), "1");
  assert.equal(calls[0].url.searchParams.get("after"), member);
  assert.equal(calls[0].url.pathname.includes("%3F"), false);
});

test("roles and other previously allowed routes have no query", async () => {
  for (const suffix of ["/roles", "/members", "/bot-member"]) {
    await vpsDiscordRequest(guild, suffix);
    const { url } = calls.at(-1);
    assert.equal(url.pathname, `/proxy/v1/guilds/${guild}${suffix}`);
    assert.equal(url.search, "");
  }
});

test("existing role-action path and method are preserved without network mutation", async () => {
  const suffix = `/members/${member}/roles/${role}`;
  await vpsDiscordRequest(guild, suffix, "PUT");
  assert.equal(calls[0].url.pathname, `/proxy/v1/guilds/${guild}${suffix}`);
  assert.equal(calls[0].url.search, "");
  assert.equal(calls[0].options.method, "PUT");
});

test("a bridge root without trailing slash remains correct", async () => {
  process.env.GUILDOS_BRIDGE_URL = "https://bridge.fixture.invalid";
  await vpsDiscordRequest(guild, "/members?limit=1&after=0");
  assert.equal(calls[0].url.pathname, `/v1/guilds/${guild}/members`);
  assert.equal(calls[0].url.search, "?limit=1&after=0");
});

test("suffix cannot override host or add unapproved query fields", async () => {
  for (const suffix of [
    "//attacker.fixture.invalid/members",
    "/members?limit=1&after=0&url=https://attacker.fixture.invalid",
    "/members?limit=1&after=0#fragment",
  ]) {
    await assert.rejects(
      vpsDiscordRequest(guild, suffix),
      /Bridge path not allowed/,
    );
  }
  assert.equal(calls.length, 0);
});

test("channel access stays outside this helper's existing allowlist", async () => {
  await assert.rejects(
    vpsDiscordRequest(guild, "/channels"),
    /Bridge path not allowed/,
  );
  assert.equal(calls.length, 0);
});

test("invalid guild and credential-bearing base URLs fail before any request", async () => {
  await assert.rejects(
    vpsDiscordRequest("invalid-guild", "/members"),
    /Invalid Discord guild ID/,
  );
  for (const base of [
    "http://bridge.fixture.invalid",
    "https://user:password@bridge.fixture.invalid",
    "https://bridge.fixture.invalid?forward=elsewhere",
    "https://bridge.fixture.invalid#fragment",
  ]) {
    process.env.GUILDOS_BRIDGE_URL = base;
    await assert.rejects(
      vpsDiscordRequest(guild, "/roles"),
      /Invalid VPS bridge base URL/,
    );
  }
  assert.equal(calls.length, 0);
});
