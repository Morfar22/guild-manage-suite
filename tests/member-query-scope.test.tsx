// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guild: { id: "guild-a" },
  user: { id: "user-a" },
}));
vi.mock("@/contexts/GuildContext", () => ({
  useGuild: () => ({ selectedGuild: mocks.guild }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "fixture-session" } },
      }),
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { useDiscordMembers } from "../src/hooks/useDiscordMembers";
afterEach(() => {
  cleanup();
  mocks.user = { id: "user-a" };
  vi.unstubAllGlobals();
});
test("member caches and bulk-operation scope change with the account, even in the same guild", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const request = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          members: [{ user: { id: "private-member" } }],
          roles: [],
        }),
      ),
  );
  vi.stubGlobal("fetch", request);
  const hook = renderHook(() => useDiscordMembers(), { wrapper });
  await waitFor(() => expect(hook.result.current.members).toHaveLength(1));
  const previousScope = hook.result.current.scopeKey;
  request.mockImplementation(() => new Promise(() => {}));
  mocks.user = { id: "user-b" };
  hook.rerender();
  expect(hook.result.current.members).toEqual([]);
  expect(hook.result.current.scopeKey).not.toBe(previousScope);
});
