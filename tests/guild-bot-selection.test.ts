import type { Untyped } from "./untyped";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import nacl from "tweetnacl";
import { encryptBotToken } from "../src/lib/server/bot-token-crypto";
import { resolveGuildBotToken } from "../src/lib/server/guild-bot-token";

const state = vi.hoisted(() => ({
  settings: null as Untyped,
  dbError: false,
  queries: [] as Untyped[],
}));
const guild = "1501891897663295538";
const db = {
  from(table: string) {
    const query = { table, filters: [] as Untyped[] };
    state.queries.push(query);
    return {
      select() {
        return this;
      },
      eq(key: string, value: Untyped) {
        query.filters.push([key, value]);
        return this;
      },
      async maybeSingle() {
        return {
          error: state.dbError ? Error("database failure") : null,
          data:
            table === "guilds"
              ? { id: "internal-uuid" }
              : table === "jtc_channels"
                ? { owner_id: "owner" }
                : state.settings,
        };
      },
    };
  },
};
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Untyped) => options,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => db }));
import { Route as configRoute } from "../src/routes/api/public/guild-bot-config";
import { Route as interactionRoute } from "../src/routes/api/public/discord-interactions";

beforeEach(() => {
  state.settings = null;
  state.dbError = false;
  state.queries.length = 0;
  vi.stubEnv("BOT_SECRET_KEY", "test-encryption-secret");
  vi.stubEnv("DISCORD_BOT_TOKEN", "default-token");
  vi.stubEnv("SUPABASE_URL", "https://db.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function custom() {
  state.settings = {
    is_custom_bot: true,
    is_active: true,
    bot_token_encrypted: encryptBotToken(
      "custom-token",
      "test-encryption-secret",
    ),
  };
}
test("resolves custom token by Discord ID then internal UUID", async () => {
  custom();
  expect(await resolveGuildBotToken(db, guild)).toBe("custom-token");
  expect(state.queries[0].filters).toEqual([["guild_id", guild]]);
  expect(state.queries[1].filters).toEqual([["guild_id", "internal-uuid"]]);
});
test("default guild uses default token; absent default fails", async () => {
  expect(await resolveGuildBotToken(db, guild)).toBe("default-token");
  vi.stubEnv("DISCORD_BOT_TOKEN", "");
  await expect(resolveGuildBotToken(db, guild)).rejects.toThrow();
});
test("inactive, missing, corrupted and wrong-key custom tokens never fall back", async () => {
  for (const settings of [
    { is_custom_bot: true, is_active: false },
    { is_custom_bot: true, is_active: true },
    { is_custom_bot: true, is_active: true, bot_token_encrypted: "v1.invalid" },
    {
      is_custom_bot: true,
      is_active: true,
      bot_token_encrypted: encryptBotToken("secret", "wrong-key"),
    },
  ]) {
    state.settings = settings;
    await expect(resolveGuildBotToken(db, guild)).rejects.toThrow();
  }
});
test("database errors and internal UUID input fail closed", async () => {
  state.dbError = true;
  await expect(resolveGuildBotToken(db, guild)).rejects.toThrow();
  state.dbError = false;
  await expect(resolveGuildBotToken(db, "internal-uuid")).rejects.toThrow();
});
async function config(
  secret: string,
  body: Untyped = { action: "resolve_bridge_bot", discord_guild_id: guild },
) {
  return (configRoute as Untyped).server.handlers.POST({
    request: new Request("https://app.example/api/public/guild-bot-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": secret },
      body: JSON.stringify(body),
    }),
  });
}
test("protected API returns only requested custom token, with no-store", async () => {
  custom();
  const response = await config("test-encryption-secret");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    discord_guild_id: guild,
    bot_token: "custom-token",
  });
  expect(state.queries.every((q) => q.filters.length === 1)).toBe(true);
});
test("default API response keeps default token on VPS", async () => {
  const response = await config("test-encryption-secret");
  expect(await response.json()).toEqual({
    discord_guild_id: guild,
    use_default_bot: true,
  });
});
test("API rejects bad auth and invalid guild; bad config is sanitized", async () => {
  custom();
  expect((await config("wrong")).status).toBe(401);
  expect(state.queries).toHaveLength(0);
  expect(
    (
      await config("test-encryption-secret", {
        action: "resolve_bridge_bot",
        discord_guild_id: "uuid",
      })
    ).status,
  ).toBe(400);
  state.settings.is_active = false;
  const response = await config("test-encryption-secret");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("custom-token");
});
test("actual signed JTC rename sends custom token to Discord", async () => {
  custom();
  const keys = nacl.sign.keyPair();
  vi.stubEnv("DISCORD_PUBLIC_KEY", Buffer.from(keys.publicKey).toString("hex"));
  const body = JSON.stringify({
    type: 5,
    guild_id: guild,
    member: { user: { id: "owner" } },
    data: {
      custom_id: "jtc_rename_modal_123456789012345678",
      components: [{ components: [{ value: "New name" }] }],
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = Buffer.from(
    nacl.sign.detached(
      new TextEncoder().encode(timestamp + body),
      keys.secretKey,
    ),
  ).toString("hex");
  const transport = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", transport);
  const response = await (interactionRoute as Untyped).server.handlers.POST({
    request: new Request(
      "https://app.example/api/public/discord-interactions",
      {
        method: "POST",
        body,
        headers: {
          "X-Signature-Ed25519": signature,
          "X-Signature-Timestamp": timestamp,
        },
      },
    ),
  });
  expect(response.status).toBe(200);
  expect(transport).toHaveBeenCalledWith(
    "https://discord.com/api/v10/channels/123456789012345678",
    expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ Authorization: "Bot custom-token" }),
    }),
  );
});
