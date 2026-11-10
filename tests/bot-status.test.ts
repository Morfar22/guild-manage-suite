import { expect, test } from "vitest";
import {
  BOT_HEARTBEAT_MAX_AGE_MS,
  getHeartbeatState,
} from "../src/lib/bot-status";

test("heartbeat freshness has one strict two-minute boundary", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const status = (age: number) => ({
    is_online: true,
    last_heartbeat: new Date(now - age).toISOString(),
  });
  expect(BOT_HEARTBEAT_MAX_AGE_MS).toBe(120_000);
  expect(getHeartbeatState(status(119_999), now)).toBe("online");
  expect(getHeartbeatState(status(120_000), now)).toBe("offline");
  expect(getHeartbeatState(status(300_000), now)).toBe("offline");
});

test("missing/invalid heartbeat is unknown and explicit offline remains offline", () => {
  expect(getHeartbeatState(null)).toBe("unknown");
  expect(getHeartbeatState({ is_online: true, last_heartbeat: null })).toBe(
    "unknown",
  );
  expect(
    getHeartbeatState({ is_online: true, last_heartbeat: "invalid" }),
  ).toBe("unknown");
  expect(
    getHeartbeatState({
      is_online: false,
      last_heartbeat: new Date().toISOString(),
    }),
  ).toBe("offline");
});
