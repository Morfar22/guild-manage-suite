// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Untyped } from "./untyped";
type Query = {
  table: string;
  fields: string;
  options: Record<string, unknown>;
  filters: Record<string, unknown>;
  orders: unknown[];
  limit?: number;
  signal?: AbortSignal;
};
const mocks = vi.hoisted(() => ({
  guild: { id: "guild-a" },
  user: { id: "user-a" },
  queries: [] as Query[],
  respond: vi.fn<(query: Query) => Untyped>(),
}));
vi.mock("@/contexts/GuildContext", () => ({
  useGuild: () => ({ selectedGuild: mocks.guild }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const query: Query = {
        table,
        fields: "",
        options: {},
        filters: {},
        orders: [],
      };
      mocks.queries.push(query);
      return {
        select(fields: string, options = {}) {
          query.fields = fields;
          query.options = options;
          return this;
        },
        eq(key: string, value: unknown) {
          query.filters[key] = value;
          return this;
        },
        gte(key: string, value: unknown) {
          query.filters[key] = value;
          return this;
        },
        order(key: string, options: unknown) {
          query.orders.push([key, options]);
          return this;
        },
        limit(limit: number) {
          query.limit = limit;
          return this;
        },
        abortSignal(signal: AbortSignal) {
          query.signal = signal;
          return this;
        },
        then(resolve: Untyped, reject: Untyped) {
          return Promise.resolve(mocks.respond(query)).then(resolve, reject);
        },
      };
    },
  },
}));
import { useBotHealthData } from "../src/hooks/useBotHealthData";
function setup(level = "all") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ level }) => useBotHealthData(level), {
    wrapper,
    initialProps: { level },
  });
}
beforeEach(() => {
  mocks.guild = { id: "guild-a" };
  mocks.user = { id: "user-a" };
  mocks.queries = [];
  mocks.respond.mockReset().mockImplementation((query) => ({
    error: null,
    count: query.options.head
      ? query.filters.level === "error"
        ? 137
        : 4
      : undefined,
    data: query.options.head
      ? null
      : query.filters.source === "heartbeat"
        ? [
            {
              created_at: "2026-11-10T12:01:00Z",
              metadata: { latency_ms: 200 },
            },
            {
              created_at: "2026-11-10T12:00:00Z",
              metadata: { latency_ms: 100 },
            },
          ]
        : [{ id: "log-1", level: "info" }],
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test("24-hour counts are exact and independent of filtered/latest100 logs; history uses newest50", async () => {
  const now = Date.parse("2026-11-10T12:30:00Z");
  vi.spyOn(Date, "now").mockReturnValue(now);
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.counts.data).toEqual({
      errors: 137,
      warnings: 4,
    }),
  );
  const counts = mocks.queries.filter((q) => q.options.head);
  expect(counts).toHaveLength(2);
  expect(
    counts.every(
      (q) =>
        q.options.count === "exact" &&
        q.filters.created_at === new Date(now - 86400000).toISOString(),
    ),
  ).toBe(true);
  hook.rerender({ level: "info" });
  await waitFor(() => expect(hook.result.current.logs.isSuccess).toBe(true));
  expect(hook.result.current.counts.data?.errors).toBe(137);
  expect(mocks.queries.filter((q) => q.options.head)).toHaveLength(2);
  const history = mocks.queries.find((q) => q.filters.source === "heartbeat")!;
  expect(history.limit).toBe(50);
  expect(history.orders).toEqual([["created_at", { ascending: false }]]);
  expect(hook.result.current.history.data?.map((x) => x.latency)).toEqual([
    100, 200,
  ]);
});
test("log retrieval errors remain errors rather than zero; retry recovers", async () => {
  mocks.respond.mockReturnValue({
    data: null,
    count: null,
    error: new Error("database unavailable"),
  });
  const hook = setup();
  await waitFor(() => expect(hook.result.current.counts.isError).toBe(true));
  expect(hook.result.current.counts.data).toBeUndefined();
  expect(hook.result.current.logs.isError).toBe(true);
  mocks.respond.mockReturnValue({ data: [], count: 0, error: null });
  await act(async () => {
    await hook.result.current.counts.refetch();
  });
  await waitFor(() =>
    expect(hook.result.current.counts.data).toEqual({ errors: 0, warnings: 0 }),
  );
});
test("guild/account switches cannot display another scope's cached log data", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true));
  mocks.respond.mockImplementation(() => new Promise(() => {}));
  mocks.guild = { id: "guild-b" };
  hook.rerender({ level: "all" });
  expect(hook.result.current.counts.data).toBeUndefined();
  expect(hook.result.current.logs.data).toBeUndefined();
  mocks.user = { id: "user-b" };
  hook.rerender({ level: "all" });
  expect(hook.result.current.counts.data).toBeUndefined();
  hook.unmount();
  expect(
    mocks.queries
      .filter((q) => q.filters.guild_id === "guild-b")
      .some((q) => q.signal?.aborted),
  ).toBe(true);
});
