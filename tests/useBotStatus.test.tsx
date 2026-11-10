// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Untyped } from "./untyped";

const mocks = vi.hoisted(() => ({
  guild: { id: "guild-1" },
  channels: new Map<string, Untyped>(),
  created: [] as Untyped[],
  removeChannel: vi.fn(async (_channel: Untyped) => "ok"),
  result: vi.fn((): { data: Untyped; error: Error | null } => ({
    data: null,
    error: null,
  })),
}));

vi.mock("@/contexts/GuildContext", () => ({
  useGuild: () => ({ selectedGuild: mocks.guild }),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseStub } = await import("./mocks/supabase");
  return {
    supabase: createSupabaseStub({
      channels: mocks.channels,
      created: mocks.created,
      removeChannel: mocks.removeChannel,
      result: mocks.result,
    }),
  };
});

import { useBotStatus } from "../src/hooks/useBotStatus";

afterEach(() => {
  cleanup();
  mocks.channels.clear();
  mocks.created.length = 0;
  mocks.removeChannel.mockClear();
  mocks.guild = { id: "guild-1" };
  mocks.result.mockReset().mockReturnValue({ data: null, error: null });
  vi.restoreAllMocks();
});

test("concurrent consumers own independent subscriptions and cleanup", async () => {
  const first = renderHook(() => useBotStatus());
  const second = renderHook(() => useBotStatus());
  await act(async () => {});
  expect(mocks.created).toHaveLength(2);
  const [firstChannel, secondChannel] = mocks.created;
  const status = { guild_id: "guild-1", is_online: true };
  act(() => {
    for (const channel of mocks.created)
      channel.callback({ eventType: "UPDATE", new: status });
  });
  expect(first.result.current.status).toEqual(status);
  expect(second.result.current.status).toEqual(status);
  first.unmount();
  expect(mocks.removeChannel).toHaveBeenCalledWith(firstChannel);
  expect(mocks.removeChannel).not.toHaveBeenCalledWith(secondChannel);
  act(() => secondChannel.callback({ eventType: "DELETE" }));
  expect(second.result.current.status).toBeNull();
});

test("StrictMode effect replay and guild changes create fresh channels", async () => {
  const hook = renderHook(() => useBotStatus(), {
    reactStrictMode: true,
  });
  await act(async () => {});
  expect(mocks.created).toHaveLength(2);
  mocks.guild = { id: "guild-2" };
  hook.rerender();
  await act(async () => {});
  mocks.guild = { id: "guild-1" };
  hook.rerender();
  await act(async () => {});
  expect(mocks.created).toHaveLength(4);
  hook.unmount();
  expect(mocks.removeChannel).toHaveBeenCalledTimes(4);
});

test("a failed query is an error, never an offline heartbeat, and retry can recover", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.result.mockReturnValue({
    data: null,
    error: new Error("Database unavailable"),
  });
  const hook = renderHook(() => useBotStatus());
  expect(hook.result.current.connectionState).toBe("loading");
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.connectionState).toBe("error");
  expect(hook.result.current.error).toBe("Database unavailable");

  mocks.result.mockReturnValue({
    data: {
      guild_id: "guild-1",
      is_online: true,
      last_heartbeat: new Date().toISOString(),
    },
    error: null,
  });
  await act(() => hook.result.current.refetch());
  expect(hook.result.current.connectionState).toBe("online");
  expect(hook.result.current.error).toBeNull();
});

test("refresh failure retains the last heartbeat and changing guilds does not reuse it", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const status = {
    guild_id: "guild-1",
    is_online: true,
    last_heartbeat: new Date().toISOString(),
  };
  mocks.result.mockReturnValue({ data: status, error: null });
  const hook = renderHook(() => useBotStatus());
  await waitFor(() =>
    expect(hook.result.current.connectionState).toBe("online"),
  );
  mocks.result.mockReturnValue({
    data: null,
    error: new Error("Network error"),
  });
  await act(() => hook.result.current.refetch());
  expect(hook.result.current.status).toEqual(status);
  expect(hook.result.current.connectionState).toBe("error");
  const oldChannel = mocks.created[0];
  mocks.guild = { id: "guild-2" };
  hook.rerender();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => oldChannel.callback({ eventType: "UPDATE", new: status }));
  expect(hook.result.current.status).toBeNull();
  expect(hook.result.current.connectionState).toBe("error");
});

test("a successful empty response leaves status unknown until a heartbeat arrives", async () => {
  const hook = renderHook(() => useBotStatus());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.connectionState).toBe("unknown");
  expect(hook.result.current.error).toBeNull();
});
