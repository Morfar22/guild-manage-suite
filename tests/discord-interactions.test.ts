import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import nacl from "tweetnacl";
import { createSupabaseStub } from "./mocks/supabase";
import { createFetchStub } from "./mocks/fetch";
import {
  discordInteractionSchema,
  ticketQuestionsSchema,
  pollSettingsSchema,
} from "../src/lib/server/discord-interactions-schema";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => database }));
import { Route } from "../src/routes/api/public/discord-interactions";

let storedGiveaway: Record<string, unknown> | null = null;
const database = createSupabaseStub({
  result: (query) => ({
    data:
      query.table === "guilds"
        ? { id: "internal-guild" }
        : query.table === "giveaways"
          ? storedGiveaway
          : null,
    error: null,
  }),
});

const handlers = (
  Route as unknown as {
    server: {
      handlers: Record<
        string,
        (input: { request: Request }) => Promise<Response>
      >;
    };
  }
).server.handlers;
const keys = nacl.sign.keyPair();
const publicKey = Buffer.from(keys.publicKey).toString("hex");

function signedRequest(body: string, timestamp = "1760000000") {
  const signature = Buffer.from(
    nacl.sign.detached(
      new TextEncoder().encode(timestamp + body),
      keys.secretKey,
    ),
  ).toString("hex");
  return new Request("https://app.invalid/api/public/discord-interactions", {
    method: "POST",
    headers: {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("DISCORD_PUBLIC_KEY", publicKey);
  vi.stubEnv("DISCORD_BOT_TOKEN", "bot-token");
  database.queries.length = 0;
  storedGiveaway = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("signed giveaway actions", () => {
  const giveaway = {
    id: "giveaway-id",
    channel_id: "channel",
    prize: "Prize",
    winners_count: 1,
    ends_at: "2099-01-01T00:00:00.000Z",
    entries: ["other"],
    required_role_id: "required-role",
  };
  const request = (roles = ["required-role"]) =>
    signedRequest(
      JSON.stringify({
        type: 3,
        application_id: "application",
        token: "interaction-token",
        guild_id: "123456789012345678",
        member: { user: { id: "entrant" }, roles },
        message: { id: "message" },
        data: { custom_id: "giveaway_enter_giveaway-id" },
      }),
    );

  test("joins and leaves, updates Discord and scopes lookup to the interaction guild", async () => {
    for (const alreadyEntered of [false, true]) {
      const work: Promise<unknown>[] = [];
      vi.stubGlobal("EdgeRuntime", {
        waitUntil: (promise: Promise<unknown>) => work.push(promise),
      });
      const transport = createFetchStub((url) => {
        if (url.hostname !== "discord.com") throw new Error("Unexpected URL");
        return new Response(null, { status: 204 });
      });
      vi.stubGlobal("fetch", transport);
      storedGiveaway = {
        ...giveaway,
        entries: alreadyEntered ? ["other", "entrant"] : ["other"],
      };
      database.queries.length = 0;
      const response = await handlers.POST({ request: request() });
      expect(await response.json()).toMatchObject({
        type: 5,
        data: { flags: 64 },
      });
      await Promise.all(work);
      expect(
        database.queries.find(
          (query) =>
            query.table === "giveaways" && query.operation === "select",
        )?.filters,
      ).toEqual([
        ["id", "giveaway-id"],
        ["guild_id", "internal-guild"],
      ]);
      expect(
        database.queries.find((query) => query.operation === "update")?.values,
      ).toEqual({ entries: alreadyEntered ? ["other"] : ["other", "entrant"] });
      expect(transport).toHaveBeenCalledTimes(2);
      expect(transport.mock.calls[0][0]).toBe(
        "https://discord.com/api/v10/channels/channel/messages/message",
      );
      const followup = JSON.parse(String(transport.mock.calls[1][1]?.body));
      expect(followup.content).toContain(
        alreadyEntered ? "fjernet" : "deltager nu",
      );
      expect(followup.flags).toBe(64);
    }
  });

  test("rejects missing required roles before mutating the giveaway", async () => {
    const work: Promise<unknown>[] = [];
    vi.stubGlobal("EdgeRuntime", {
      waitUntil: (promise: Promise<unknown>) => work.push(promise),
    });
    const transport = createFetchStub(
      () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", transport);
    storedGiveaway = giveaway;
    await handlers.POST({ request: request([]) });
    await Promise.all(work);
    expect(database.queries.some((query) => query.operation === "update")).toBe(
      false,
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][1]?.body)).toContain("required-role");
  });
});

describe("Discord request authentication", () => {
  test("actual route responds to signed PING without database or network", async () => {
    const response = await handlers.POST({
      request: signedRequest('{"type":1}'),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: 1 });
  });

  test("authenticates before parsing, then returns 400 for invalid signed bodies", async () => {
    const unsigned = new Request("https://app.invalid", {
      method: "POST",
      body: "{",
    });
    expect((await handlers.POST({ request: unsigned })).status).toBe(401);
    for (const body of [
      "{",
      "null",
      '{"type":999}',
      '{"type":2}',
      '{"type":3,"data":null}',
    ]) {
      expect(
        (await handlers.POST({ request: signedRequest(body) })).status,
      ).toBe(400);
    }
  });

  test("preflight succeeds without authentication", async () => {
    const response = await handlers.OPTIONS({
      request: new Request("https://app.invalid", { method: "OPTIONS" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("validated Discord data", () => {
  const base = {
    type: 2,
    application_id: "app",
    token: "token",
    user: { id: "user" },
    data: { name: "help" },
  };

  test("validates commands and normalizes the member or direct user", () => {
    expect(discordInteractionSchema.parse(base).user.id).toBe("user");
    const member = discordInteractionSchema.parse({
      ...base,
      user: undefined,
      member: { user: { id: "member" } },
    });
    expect(member.user.id).toBe("member");
    expect(member.member?.roles).toEqual([]);
    expect(discordInteractionSchema.parse({ type: 1 }).user.id).toBe("");
  });

  test("rejects absent users, follow-up credentials and action identifiers", () => {
    for (const invalid of [
      { ...base, user: undefined },
      { ...base, token: "" },
      { ...base, application_id: "" },
      { ...base, data: {} },
      { ...base, type: 3, data: {} },
      { ...base, type: 5, data: {} },
    ])
      expect(discordInteractionSchema.safeParse(invalid).success).toBe(false);
  });

  test("validates recursive command options, modal input and preserved embed fields", () => {
    const command = discordInteractionSchema.parse({
      ...base,
      data: {
        name: "fivem",
        options: [
          {
            name: "players",
            type: 1,
            options: [{ name: "target", type: 3, value: "17" }],
          },
        ],
      },
    });
    expect(command.data.options?.[0].options?.[0].value).toBe("17");
    const modal = discordInteractionSchema.parse({
      ...base,
      type: 5,
      data: {
        custom_id: "rename",
        components: [{ components: [{ custom_id: "name", value: "hello" }] }],
      },
      message: { embeds: [{ title: "Original", footer: { text: "Keep" } }] },
    });
    expect(modal.data.components?.[0].components[0].value).toBe("hello");
    expect(modal.message.embeds[0].footer).toEqual({ text: "Keep" });
  });

  test("handles malformed stored question and poll settings safely", () => {
    expect(ticketQuestionsSchema.parse(null)).toEqual([]);
    expect(
      ticketQuestionsSchema.parse([{ label: "Reason", required: true }]),
    ).toHaveLength(1);
    expect(pollSettingsSchema.parse(null).allow_multiple).toBe(false);
    expect(
      pollSettingsSchema.parse({ allow_multiple: true }).allow_multiple,
    ).toBe(true);
  });
});
