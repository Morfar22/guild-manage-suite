// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Untyped } from "./untyped";
type Query = {
  table: string;
  options: Record<string, unknown>;
  filters: Record<string, unknown>;
  range?: number[];
  search?: string;
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
      const query: Query = { table, options: {}, filters: {} };
      mocks.queries.push(query);
      return {
        select(_fields: string, options = {}) {
          query.options = options;
          return this;
        },
        eq(key: string, value: unknown) {
          query.filters[key] = value;
          return this;
        },
        neq(key: string, value: unknown) {
          query.filters["neq:" + key] = value;
          return this;
        },
        or(search: string) {
          query.search = search;
          return this;
        },
        order() {
          return this;
        },
        range(a: number, b: number) {
          query.range = [a, b];
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
import {
  useAlertCenterData,
  alertSearchFilter,
} from "../src/hooks/useAlertCenterData";
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useAlertCenterData(), { wrapper }) };
}
beforeEach(() => {
  mocks.guild = { id: "guild-a" };
  mocks.user = { id: "user-a" };
  mocks.queries = [];
  mocks.respond.mockReset().mockImplementation((query) => {
    if (query.options.head)
      return {
        data: null,
        error: null,
        count: query.filters.severity ? 4 : 1371,
      };
    const [from, to] = query.range ?? [0, 5];
    return {
      error: null,
      count: 1371,
      data: Array.from({ length: Math.min(to + 1, 1371) - from }, (_, i) => ({
        id: "alert-" + (from + i),
        status: "open",
        guild_id: query.filters.guild_id,
      })),
    };
  });
});
afterEach(cleanup);
test("1371 active alerts remain reachable past150 and counts stay global across pages/filters", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  expect(hook.result.current.query.data?.rows).toHaveLength(40);
  expect(hook.result.current.counts.data?.active).toBe(1371);
  expect(hook.result.current.pageCount).toBe(35);
  act(() => hook.result.current.setPage(34));
  await waitFor(() =>
    expect(hook.result.current.query.data?.rows[0].id).toBe("alert-1360"),
  );
  expect(hook.result.current.query.data?.rows).toHaveLength(11);
  expect(hook.result.current.counts.data?.active).toBe(1371);
  act(() => hook.result.current.setStatus("resolved"));
  expect(hook.result.current.page).toBe(0);
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  expect(mocks.queries.filter((q) => q.range).at(-1)?.filters.status).toBe(
    "resolved",
  );
  expect(hook.result.current.counts.data?.active).toBe(1371);
});
test("search is server-side and quoted; changing search resets pagination", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  act(() => hook.result.current.setPage(2));
  await waitFor(() => expect(hook.result.current.page).toBe(2));
  act(() => hook.result.current.setSearch('ticket, (old) "quote" %_'));
  expect(hook.result.current.page).toBe(0);
  await waitFor(() => expect(mocks.queries.some((q) => !!q.search)).toBe(true));
  const actual = mocks.queries.find((q) => q.search)!.search!;
  expect(actual).toBe(alertSearchFilter('ticket, (old) "quote" %_'));
  expect(actual).toContain('title.ilike."%ticket, (old)');
  expect(actual).toContain('\\"quote\\"');
  expect(actual).toContain("\\%\\_");
});
test("guild/account switch resets filters and never displays stale private rows", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  act(() => hook.result.current.setPage(2));
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  mocks.respond.mockImplementation(() => new Promise(() => {}));
  mocks.guild = { id: "guild-b" };
  hook.rerender();
  expect(hook.result.current.page).toBe(0);
  expect(hook.result.current.query.data).toBeUndefined();
  expect(hook.result.current.counts.data).toBeUndefined();
  mocks.user = { id: "user-b" };
  hook.rerender();
  expect(hook.result.current.query.data).toBeUndefined();
  hook.unmount();
  expect(mocks.queries.some((q) => q.signal?.aborted)).toBe(true);
});
test("unavailable counts are errors and refresh invalidates every alert surface", async () => {
  mocks.respond.mockReturnValue({
    error: new Error("down"),
    data: null,
    count: null,
  });
  const hook = setup();
  await waitFor(() => expect(hook.result.current.counts.isError).toBe(true));
  expect(hook.result.current.counts.data).toBeUndefined();
  const invalidate = vi.spyOn(hook.client, "invalidateQueries");
  act(() => hook.result.current.refresh());
  expect(invalidate.mock.calls.map((x) => x[0]?.queryKey?.[0])).toEqual(
    expect.arrayContaining([
      "operations-summary",
      "ops-alert-counts",
      "ops-alerts",
      "dashboard-notifications",
    ]),
  );
});

test("a completed mutation refreshes its original guild even after navigation", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  mocks.guild = { id: "guild-b" };
  hook.rerender();
  const invalidate = vi.spyOn(hook.client, "invalidateQueries");
  act(() => hook.result.current.refresh("guild-a"));
  expect(
    invalidate.mock.calls.every((call) => call[0]?.queryKey?.[1] === "guild-a"),
  ).toBe(true);
});
