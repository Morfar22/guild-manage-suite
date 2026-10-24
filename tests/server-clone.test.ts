import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { createSupabaseStub } from "./mocks/supabase";
import {
  fetchChannelMessages,
  fetchGuildMembers,
  fetchGuildBans,
  fetchGuildThreads,
  fetchGuildSettings,
} from "../src/lib/server/server-clone-shared";

const state = vi.hoisted(() => ({
  admin: false,
  templates: [{ id: "own-template" }],
  queries: [] as {
    table: string;
    operation: string;
    filters: [string, unknown][];
  }[],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (route: unknown) => route,
}));
vi.mock("@supabase/supabase-js", async () => {
  const { createSupabaseStub } = await import("./mocks/supabase");
  return {
    createClient: () => {
      const db = createSupabaseStub({
        result: (query) => {
          state.queries.push(query);
          return {
            data:
              query.table === "user_guilds"
                ? { has_admin_permission: state.admin }
                : state.templates,
            error: null,
          };
        },
      });
      return db;
    },
  };
});
import { Route } from "../src/routes/api/public/server-clone";
type RuntimeRoute = {
  server: {
    handlers: Record<string, (ctx: { request: Request }) => Promise<Response>>;
  };
};
function call(body: unknown, authorization = "Bearer valid", method = "POST") {
  return (Route as unknown as RuntimeRoute).server.handlers[method]({
    request: new Request("https://app.invalid/api/public/server-clone", {
      method,
      headers: { authorization },
      body: method === "OPTIONS" ? undefined : JSON.stringify(body),
    }),
  });
}
beforeEach(() => {
  state.admin = false;
  state.queries.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

test("server clone handles preflight and rejects unauthenticated or foreign-guild exports", async () => {
  expect((await call(null, "", "OPTIONS")).status).toBe(200);
  expect((await call({ action: "export" }, "")).status).toBe(401);
  expect((await call({ action: "export" }, "Bearer invalid")).status).toBe(401);
  expect((await call({ action: "export" })).status).toBe(400);
  expect(
    (await call({ action: "export", sourceGuildId: "foreign" })).status,
  ).toBe(403);
  expect(state.queries.at(-1)?.filters).toEqual([
    ["guild_id", "foreign"],
    ["user_id", "user-a"],
  ]);
});
test("templates listing and deletion stay scoped to the authenticated owner", async () => {
  const list = await call({ action: "list-templates" });
  expect(await list.json()).toEqual({ templates: state.templates });
  expect(state.queries[0].filters).toEqual([
    ["or", "created_by.eq.user-a,is_public.eq.true"],
  ]);
  expect((await call({ action: "delete-template" })).status).toBe(400);
  expect(
    (await call({ action: "delete-template", templateId: "template" })).status,
  ).toBe(200);
  expect(state.queries.at(-1)).toMatchObject({
    operation: "delete",
    filters: [
      ["id", "template"],
      ["created_by", "user-a"],
    ],
  });
  expect((await call({ action: "unknown" })).status).toBe(400);
});
test("shared clone transport paginates messages and members with the supplied bot identity", async () => {
  vi.useFakeTimers();
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(Array.from({ length: 100 }, (_, i) => ({ id: String(i) }))),
    )
    .mockResolvedValueOnce(Response.json([{ id: "final" }]));
  vi.stubGlobal("fetch", transport);
  const pending = fetchChannelMessages("custom-token", "channel", 101);
  await vi.runAllTimersAsync();
  expect(await pending).toHaveLength(101);
  expect(transport.mock.calls[1][0]).toContain("before=99");
  expect(transport.mock.calls[0][1].headers.Authorization).toBe(
    "Bot custom-token",
  );
  transport
    .mockResolvedValueOnce(
      Response.json(
        Array.from({ length: 1000 }, (_, i) => ({ user: { id: String(i) } })),
      ),
    )
    .mockResolvedValueOnce(Response.json([]));
  const members = fetchGuildMembers("custom-token", "guild", 1001);
  await vi.runAllTimersAsync();
  expect(await members).toHaveLength(1000);
  expect(transport.mock.calls.at(-1)?.[0]).toContain("after=999");
});
test("clone helpers stop safely on Discord failures and handle empty thread lists", async () => {
  vi.useFakeTimers();
  const transport = vi.fn(async () => new Response("", { status: 403 }));
  vi.stubGlobal("fetch", transport);
  const messages = fetchChannelMessages("token", "channel");
  const members = fetchGuildMembers("token", "guild");
  await vi.runAllTimersAsync();
  expect(await messages).toEqual([]);
  expect(await members).toEqual([]);
  expect(await fetchGuildBans("token", "guild")).toEqual([]);
  expect(await fetchGuildThreads("token", "guild")).toEqual([]);
  expect(await fetchGuildSettings("token", "guild")).toBeNull();
  transport.mockImplementation(async () =>
    Response.json({ name: "Guild", preferred_locale: "en-US" }),
  );
  expect(await fetchGuildThreads("token", "guild")).toEqual([]);
  expect(await fetchGuildSettings("token", "guild")).toMatchObject({
    name: "Guild",
    preferred_locale: "en-US",
  });
  transport.mockImplementation(async () =>
    Response.json([{ user: { id: "banned" } }]),
  );
  expect(await fetchGuildBans("token", "guild")).toHaveLength(1);
});
