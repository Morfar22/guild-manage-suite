import { expect, test, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (route: unknown) => route,
}));
import { Route } from "../src/routes/api/public/health";
test("dashboard liveness is cache-free and reveals no runtime configuration", async () => {
  const response = (
    Route as unknown as { server: { handlers: { GET: () => Response } } }
  ).server.handlers.GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    service: "guildos-dashboard",
  });
});
