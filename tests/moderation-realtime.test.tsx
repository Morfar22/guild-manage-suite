// @vitest-environment jsdom
import type { Untyped } from "./untyped";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  channels: new Map<string, Untyped>(),
  remove: vi.fn(),
  guild: { id: "guild" },
}));
vi.mock("@/contexts/GuildContext", () => ({
  useGuild: () => ({ selectedGuild: mocks.guild }),
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseStub } = await import("./mocks/supabase");
  return {
    supabase: createSupabaseStub({
      channels: mocks.channels,
      removeChannel: mocks.remove,
      result: () => ({ data: [], count: 0, error: null }),
    }),
  };
});

import { useModerationLogs } from "../src/hooks/useModerationLogs";
afterEach(() => {
  cleanup();
  mocks.channels.clear();
  mocks.remove.mockClear();
});
test("concurrent filtered consumers and StrictMode own independent subscriptions", async () => {
  // Stable guild context prevents unrelated dependency replay in this mock.
  const first = renderHook(() => useModerationLogs({ actionType: "ban" }), {
    reactStrictMode: true,
  });
  const second = renderHook(() => useModerationLogs({ actionType: "kick" }), {
    reactStrictMode: true,
  });
  await act(async () => {});
  const live = [...mocks.channels.values()].filter(
    (c) => !mocks.remove.mock.calls.some(([removed]) => removed === c),
  );
  expect(live).toHaveLength(2);
  act(() =>
    live.forEach((c) => c.callback({ new: { id: "log", action_type: "ban" } })),
  );
  expect(first.result.current.logs).toHaveLength(1);
  expect(first.result.current.totalCount).toBe(1);
  expect(second.result.current.logs).toHaveLength(0);
  first.unmount();
  expect(mocks.remove).not.toHaveBeenCalledWith(live[1]);
});
