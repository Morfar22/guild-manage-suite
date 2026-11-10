import { expect, test } from "vitest";
import {
  hasFreshLogTelemetry,
  logCountDisplay,
} from "../src/lib/log-observability";
test("zero errors require recent telemetry; missing/failed telemetry is unknown", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  expect(hasFreshLogTelemetry("2026-11-10T11:59:00Z", now)).toBe(true);
  expect(hasFreshLogTelemetry("2026-11-10T11:58:00Z", now)).toBe(false);
  expect(hasFreshLogTelemetry("2100-01-01", now)).toBe(false);
  expect(hasFreshLogTelemetry(null, now)).toBe(false);
  expect(logCountDisplay(0, false, false)).toBe("—");
  expect(logCountDisplay(0, false, true)).toBe(0);
  expect(logCountDisplay(5, false, false)).toBe(5);
  expect(logCountDisplay(5, true, true)).toBe("—");
  expect(logCountDisplay(undefined, false, true)).toBe("—");
});
