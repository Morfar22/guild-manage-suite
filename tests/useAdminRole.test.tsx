// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));
import { useIsAdmin } from "../src/hooks/useAdmin";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("failed permission checks stay errors instead of becoming a normal-user result", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("Cannot verify role");
  mocks.rpc.mockResolvedValue({ data: null, error });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useIsAdmin(), { wrapper });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.data).toBeUndefined();
  expect(hook.result.current.error).toBe(error);
  hook.unmount();
  client.clear();
});
