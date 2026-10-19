// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Untyped } from "./untyped";

const mocks = vi.hoisted(() => ({
  guild: { id: "guild-1" },
  channels: new Map<string, Untyped>(),
  created: [] as Untyped[],
  removeChannel: vi.fn(async (_channel: Untyped) => "ok"),
}));

vi.mock("@/contexts/GuildContext", () => ({
  useGuild: () => ({ selectedGuild: mocks.guild }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    // Model Supabase topic reuse, including channels awaiting async removal.
    channel: (topic: string) => {
      if (mocks.channels.has(topic)) return mocks.channels.get(topic);
      const channel = {
        subscribed: false,
        callback: (_payload: Untyped) => {},
        on(_event: string, _filter: Untyped, callback: Untyped) {
          if (this.subscribed)
            throw new Error("cannot add callbacks after subscribe()");
          this.callback = callback;
          return this;
        },
        subscribe() {
          this.subscribed = true;
          return this;
        },
      };
      mocks.channels.set(topic, channel);
      mocks.created.push(channel);
      return channel;
    },
    removeChannel: mocks.removeChannel,
  },
}));

import { useBotStatus } from "../src/hooks/useBotStatus";

afterEach(() => {
  cleanup();
  mocks.channels.clear();
  mocks.created.length = 0;
  mocks.removeChannel.mockClear();
  mocks.guild = { id: "guild-1" };
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
