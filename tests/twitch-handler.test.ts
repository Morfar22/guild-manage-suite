import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFetchStub } from "./mocks/fetch";
import {
  createSupabaseStub,
  type Query,
  type QueryResult,
} from "./mocks/supabase";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.getClient }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
import { handleTwitchRequest } from "../src/routes/api/public/twitch-handler";

let client: ReturnType<typeof createSupabaseStub>;
let respond: (query: Query) => QueryResult;

function request(action?: string, options: RequestInit = {}) {
  return new Request(
    `https://dashboard.invalid/api/public/twitch-handler${action ? `?action=${action}` : ""}`,
    options,
  );
}
function dashboardBody(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: "Bearer valid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://database.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-anon");
  vi.stubEnv("BOT_SECRET_KEY", "test-bot-secret");
  vi.stubEnv("TWITCH_CLIENT_ID", "test-twitch-client");
  vi.stubEnv("TWITCH_CLIENT_SECRET", "test-twitch-secret");
  vi.stubEnv("DISCORD_BOT_TOKEN", "test-discord-token");
  respond = () => ({ data: null, error: null });
  client = createSupabaseStub({ result: (query) => respond(query) });
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-a" } },
    error: null,
  });
  mocks.getClient.mockReset().mockReturnValue(client);
});

describe("Twitch request authorization and validation", () => {
  test("preflight succeeds without initializing any external client", async () => {
    const response = await handleTwitchRequest(
      request(undefined, { method: "OPTIONS" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mocks.getClient).not.toHaveBeenCalled();
  });

  test.each([undefined, "check", "partner_check", "schedule_post"])(
    "automated action %s fails closed without its secret",
    async (action) => {
      const response = await handleTwitchRequest(request(action));
      expect(response.status).toBe(401);
      expect(client.queries).toHaveLength(0);
    },
  );

  test.each(["lookup", "test", "upcoming", "schedule_post_manual"])(
    "dashboard action %s requires a bearer session",
    async (action) => {
      const response = await handleTwitchRequest(
        request(action, { method: "POST" }),
      );
      expect(response.status).toBe(401);
      expect(client.queries).toHaveLength(0);
    },
  );

  test("invalid sessions are rejected before body parsing or Twitch requests", async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: Error("Expired"),
    });
    const response = await handleTwitchRequest(
      request("lookup", dashboardBody({ username: "streamer" })),
    );
    expect(response.status).toBe(401);
  });

  test.each([
    ["lookup", { username: { name: "streamer" } }],
    ["lookup", { username: "bad/name" }],
    ["lookup", { username: " " }],
    ["test", { streamer_id: 123 }],
    ["test", {}],
    ["schedule_post_manual", { guild_id: [] }],
  ])(
    "action %s rejects invalid JSON shapes before database access",
    async (action, body) => {
      const response = await handleTwitchRequest(
        request(String(action), dashboardBody(body)),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid request body" });
      expect(client.queries).toHaveLength(0);
    },
  );

  test("malformed JSON returns 400 instead of an internal error", async () => {
    const response = await handleTwitchRequest(
      request("lookup", {
        method: "POST",
        headers: { Authorization: "Bearer valid" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  test("EventSub delivery cannot trigger the secret-authenticated polling loop", async () => {
    const response = await handleTwitchRequest(
      request(undefined, {
        method: "POST",
        headers: {
          "Twitch-Eventsub-Message-Type": "notification",
          "Twitch-Eventsub-Message-Signature": "sha256=untrusted",
        },
        body: JSON.stringify({
          subscription: {
            id: "sub",
            type: "stream.online",
            version: "1",
            status: "enabled",
          },
          event: { broadcaster_user_id: "123" },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "EventSub callbacks are not supported by this polling endpoint",
    });
    expect(mocks.getClient).not.toHaveBeenCalled();
  });

  test("malformed EventSub shapes are rejected before a client is initialized", async () => {
    const response = await handleTwitchRequest(
      request(undefined, {
        method: "POST",
        headers: { "Twitch-Eventsub-Message-Type": "notification" },
        body: JSON.stringify({ subscription: null }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.getClient).not.toHaveBeenCalled();
  });

  test("unknown actions return a client error", async () => {
    const response = await handleTwitchRequest(request("unknown"));
    expect(response.status).toBe(400);
  });
});

describe("Twitch handler behavior with offline transports", () => {
  const trackedStreamer = {
    id: "streamer-id",
    guild_id: "guild-a",
    twitch_user_id: "123",
    twitch_username: "streamer",
    is_live: false,
    is_partner: true,
    current_week_streams: 2,
    current_stream_started_at: null,
    last_stream_id: "previous-stream",
    last_went_live_at: null,
    notification_channel_id: "channel-a",
    mention_role_id: null,
  };

  function pollingTransport(discordStatus = 200) {
    return createFetchStub((url) => {
      if (url.hostname === "id.twitch.tv")
        return Response.json({ access_token: "test-access" });
      if (url.pathname === "/helix/streams")
        return Response.json({
          data: [
            {
              id: "live-stream",
              user_id: "123",
              user_login: "streamer",
              title: "Now live",
              viewer_count: 12,
              started_at: new Date().toISOString(),
              thumbnail_url: "https://cdn.invalid/{width}x{height}",
              language: "en",
              game_name: "Game",
            },
          ],
        });
      if (url.pathname === "/helix/users")
        return Response.json({
          data: [
            {
              id: "123",
              login: "streamer",
              display_name: "Streamer",
              profile_image_url: "https://cdn.invalid/avatar",
            },
          ],
        });
      if (url.hostname === "discord.com")
        return new Response("delivery", { status: discordStatus });
      throw Error(`Unexpected URL ${url}`);
    });
  }

  function pollingDatabase(claimed: boolean) {
    respond = (query) => {
      if (query.table === "admin_ip_whitelist")
        return { data: null, count: 0, error: null };
      if (query.table === "twitch_settings") return { data: [], error: null };
      if (query.table === "twitch_streamers")
        return {
          data:
            query.operation === "select"
              ? [{ ...trackedStreamer }]
              : claimed
                ? [{ id: trackedStreamer.id }]
                : [],
          error: null,
        };
      return { data: null, error: null };
    };
  }

  test("polling claims a live transition atomically before delivering one notification", async () => {
    pollingDatabase(true);
    const transport = pollingTransport();
    vi.stubGlobal("fetch", transport);
    const response = await handleTwitchRequest(
      request("check", { headers: { "x-bot-secret": "test-bot-secret" } }),
    );
    expect(response.status).toBe(200);
    const claim = client.queries.find(
      (query) =>
        query.table === "twitch_streamers" && query.operation === "update",
    );
    expect(claim?.filters).toContainEqual([
      "or",
      "is_live.eq.false,is_live.is.null",
    ]);
    expect(claim?.values).toMatchObject({
      is_live: true,
      last_stream_id: "live-stream",
      current_week_streams: 3,
    });
    const deliveries = transport.mock.calls.filter(([input]) =>
      String(input).includes("discord.com"),
    );
    expect(deliveries).toHaveLength(1);
    expect(
      client.queries.some(
        (query) =>
          query.table === "twitch_notification_logs" &&
          query.operation === "insert",
      ),
    ).toBe(true);
  });

  test("a live transition claimed by another poll sends no duplicate notification", async () => {
    pollingDatabase(false);
    const transport = pollingTransport();
    vi.stubGlobal("fetch", transport);
    const response = await handleTwitchRequest(
      request("check", { headers: { "x-bot-secret": "test-bot-secret" } }),
    );
    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      client.queries.some(
        (query) => query.table === "twitch_notification_logs",
      ),
    ).toBe(false);
  });

  test("failed Discord delivery releases only its own claim so polling can retry", async () => {
    pollingDatabase(true);
    vi.stubGlobal("fetch", pollingTransport(503));
    const response = await handleTwitchRequest(
      request("check", { headers: { "x-bot-secret": "test-bot-secret" } }),
    );
    expect(response.status).toBe(200);
    const updates = client.queries.filter(
      (query) =>
        query.table === "twitch_streamers" && query.operation === "update",
    );
    expect(updates).toHaveLength(2);
    expect(updates[1].values).toMatchObject({
      is_live: false,
      last_stream_id: "previous-stream",
      current_week_streams: 2,
      current_stream_started_at: null,
    });
    expect(updates[1].filters).toContainEqual([
      "last_stream_id",
      "live-stream",
    ]);
    expect(
      client.queries.some(
        (query) => query.table === "twitch_notification_logs",
      ),
    ).toBe(false);
  });

  test("lookup exchanges credentials and returns the requested Twitch user", async () => {
    const user = {
      id: "123",
      login: "streamer",
      display_name: "Streamer",
      profile_image_url: "https://cdn.invalid/avatar.png",
    };
    const transport = createFetchStub((url, init) => {
      if (url.hostname === "id.twitch.tv") {
        expect(init?.method).toBe("POST");
        expect(String(init?.body)).toContain("grant_type=client_credentials");
        return Response.json({
          access_token: "test-access",
          expires_in: 3600,
          token_type: "bearer",
        });
      }
      if (url.pathname === "/helix/users") {
        expect(url.searchParams.get("login")).toBe("streamer");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer test-access",
        );
        return Response.json({ data: [user] });
      }
      throw Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", transport);
    const response = await handleTwitchRequest(
      request("lookup", dashboardBody({ username: " streamer " })),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  test("lookup reports missing Twitch users", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchStub((url) =>
        url.hostname === "id.twitch.tv"
          ? Response.json({ access_token: "test-access" })
          : Response.json({ data: [] }),
      ),
    );
    const response = await handleTwitchRequest(
      request("lookup", dashboardBody({ username: "nobody" })),
    );
    expect(response.status).toBe(404);
  });

  test("test notifications require admin permission for the streamer's guild", async () => {
    respond = ({ table }) => ({
      data:
        table === "twitch_streamers"
          ? { id: "streamer-id", guild_id: "guild-a" }
          : { has_admin_permission: false },
      error: null,
    });
    const response = await handleTwitchRequest(
      request("test", dashboardBody({ streamer_id: "streamer-id" })),
    );
    expect(response.status).toBe(403);
    expect(
      client.queries.find((query) => query.table === "user_guilds")?.filters,
    ).toContainEqual(["guild_id", "guild-a"]);
  });

  test("secret-authenticated polling with no tracked streamers does not need Twitch credentials", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "");
    respond = ({ table }) => ({
      data: table === "twitch_streamers" ? [] : null,
      count: 0,
      error: null,
    });
    const response = await handleTwitchRequest(
      request("check", { headers: { "x-bot-secret": "test-bot-secret" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "No streamers to check" });
  });

  test("a configured whitelist prevents polling from unauthorized IPs", async () => {
    respond = () => ({ data: null, count: 1, error: null });
    const response = await handleTwitchRequest(
      request("check", {
        headers: {
          "x-bot-secret": "test-bot-secret",
          "x-forwarded-for": "192.0.2.1, 192.0.2.2",
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ip: "192.0.2.1" });
    expect(
      client.queries.every((query) => query.table === "admin_ip_whitelist"),
    ).toBe(true);
  });
});
