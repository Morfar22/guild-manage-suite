// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
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

vi.mock("@/hooks/useDiscordRoles", () => ({
  useDiscordRoles: () => ({ data: [] }),
}));
vi.mock("@/hooks/useDiscordChannels", () => ({
  useDiscordChannels: () => ({ data: { channels: [] } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: Untyped) => <a href={to}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import OperationsCenter from "../src/pages/OperationsCenter";
afterEach(cleanup);

test("alert pagination and search remain in Alerts and keep the search input mounted while loading", async () => {
  let resolvePage!: (value: unknown) => void,
    resolveSearch!: (value: unknown) => void;
  const pendingPage = new Promise((resolve) => (resolvePage = resolve)),
    pendingSearch = new Promise((resolve) => (resolveSearch = resolve));
  mocks.respond.mockImplementation((query) => {
    if (query.table !== "dashboard_notifications")
      return { data: [], error: null };
    if (query.options.head) return { data: null, error: null, count: 1371 };
    if (query.search) return pendingSearch;
    if (query.range?.[0] === 40) return pendingPage;
    return { data: [], error: null, count: 1371 };
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <OperationsCenter />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Operations Center" });
  const alertsTab = screen.getByRole("tab", { name: "Alerts" });
  fireEvent.mouseDown(alertsTab, { button: 0 });
  const input = await screen.findByRole("textbox", { name: "Søg alerts" });
  fireEvent.click(screen.getByRole("button", { name: "Næste" }));
  await waitFor(() =>
    expect(mocks.queries.some((query) => query.range?.[0] === 40)).toBe(true),
  );
  expect(alertsTab.getAttribute("data-state")).toBe("active");
  expect(screen.getByRole("textbox", { name: "Søg alerts" })).toBe(input);
  expect(screen.getByText("Henter alerts...")).toBeTruthy();
  await act(async () => resolvePage({ data: [], error: null, count: 1371 }));
  await screen.findByText(/Side 2 af 35/);
  expect(alertsTab.getAttribute("data-state")).toBe("active");
  input.focus();
  fireEvent.change(input, { target: { value: "ticket" } });
  await waitFor(() =>
    expect(mocks.queries.some((query) => !!query.search)).toBe(true),
  );
  expect(screen.getByRole("textbox", { name: "Søg alerts" })).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(alertsTab.getAttribute("data-state")).toBe("active");
  await act(async () => resolveSearch({ data: [], error: null, count: 0 }));
  await screen.findByText("Ingen alerts matcher filtrene.");
  expect(document.activeElement).toBe(input);
  expect(alertsTab.getAttribute("data-state")).toBe("active");
});
