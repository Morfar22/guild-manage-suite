// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Query, QueryResult } from "./mocks/supabase";

const mocks = vi.hoisted(() => ({
  result: vi.fn((_query: Query): QueryResult => ({ data: [], error: null })),
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseStub } = await import("./mocks/supabase");
  return { supabase: createSupabaseStub({ result: mocks.result }) };
});
import { useGuildSelectionData } from "../src/hooks/useGuildSelectionData";

const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const guild = { id: "guild-1", guild_name: "Nordisk RP 16+" };
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  mocks.result.mockReset().mockReturnValue({ data: [], error: null });
});

test("a guild query error is distinct from a successful empty guild list", async () => {
  mocks.result.mockImplementation((query) =>
    query.table === "user_guilds"
      ? { data: null, error: new Error("Cannot load servers") }
      : { data: [], error: null },
  );
  const hook = renderHook(() => useGuildSelectionData("user-1", false), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toBeTruthy();
  expect(hook.result.current.hasLoadedGuilds).toBe(false);
  mocks.result.mockReturnValue({ data: [], error: null });
  await act(() => hook.result.current.refetch());
  await waitFor(() => expect(hook.result.current.error).toBeNull());
  expect(hook.result.current.hasLoadedGuilds).toBe(true);
  expect(hook.result.current.guilds).toEqual([]);
});

test("a failed refresh preserves servers and status failure does not label them offline", async () => {
  mocks.result.mockImplementation((query) =>
    query.table === "guilds"
      ? { data: [guild], error: null }
      : {
          data: [
            {
              guild_id: "guild-1",
              is_online: true,
              last_heartbeat: new Date().toISOString(),
            },
          ],
          error: null,
        },
  );
  const hook = renderHook(() => useGuildSelectionData("admin-1", true), {
    wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.getGuildStatus("guild-1")).toBe("online"),
  );
  expect(hook.result.current.guilds).toEqual([guild]);
  mocks.result.mockReturnValue({
    data: null,
    error: new Error("Network error"),
  });
  await act(() => hook.result.current.refetch());
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(hook.result.current.guilds).toEqual([guild]);
  expect(hook.result.current.hasLoadedGuilds).toBe(true);
  expect(hook.result.current.getGuildStatus("guild-1")).toBe("error");
});

test("normal users retain the user-id and admin-permission filters", async () => {
  mocks.result.mockImplementation((query) =>
    query.table === "user_guilds"
      ? {
          data: [
            { guilds: guild, has_admin_permission: true },
            { guilds: { id: "forbidden" }, has_admin_permission: false },
          ],
          error: null,
        }
      : { data: [], error: null },
  );
  const hook = renderHook(() => useGuildSelectionData("user-1", false), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.guilds).toEqual([guild]);
  expect(mocks.result).toHaveBeenCalledWith(
    expect.objectContaining({
      table: "user_guilds",
      filters: [["user_id", "user-1"]],
    }),
  );
  expect(hook.result.current.getGuildStatus("guild-1")).toBe("unknown");
});

test("an unresolved role neither loads servers nor declares the list empty", async () => {
  const hook = renderHook(() => useGuildSelectionData("user-1", undefined), {
    wrapper,
  });
  await act(async () => {});
  expect(mocks.result).not.toHaveBeenCalled();
  expect(hook.result.current.loading).toBe(true);
  expect(hook.result.current.hasLoadedGuilds).toBe(false);
});
