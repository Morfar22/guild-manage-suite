import { expect, test, vi } from "vitest";
import {
  runBulkRoleUpdates,
  RoleUpdateError,
  retryAfterMilliseconds,
} from "../src/lib/bulk-role-runner";

test("bulk role updates await acknowledgements and count only confirmed changes", async () => {
  let resolveFirst!: () => void;
  const gate = new Promise<void>((resolve) => (resolveFirst = resolve));
  const calls: string[] = [];
  const progress = vi.fn();
  const update = async (id: string) => {
    calls.push(id);
    if (id === "1") await gate;
    if (id === "2") throw new RoleUpdateError("Missing Permissions", 403);
  };
  const pending = runBulkRoleUpdates(["1", "2", "3"], update, {
    signal: new AbortController().signal,
    onProgress: progress,
  });
  expect(calls).toEqual(["1"]);
  expect(progress).not.toHaveBeenCalled();
  resolveFirst();
  const result = await pending;
  expect(result.succeeded).toEqual(["1", "3"]);
  expect(result.failed.map((x) => x.memberId)).toEqual(["2"]);
  expect(result.remaining).toEqual([]);
  const retried: string[] = [];
  await runBulkRoleUpdates(
    result.failed.map((x) => x.memberId),
    async (id) => {
      retried.push(id);
    },
    { signal: new AbortController().signal },
  );
  expect(retried).toEqual(["2"]);
});
test("429 retries wait for Retry-After, are bounded and never retry 403", async () => {
  const sleep = vi.fn(async (_ms: number, _signal: AbortSignal) => {});
  let calls = 0;
  const result = await runBulkRoleUpdates(
    ["1", "2"],
    async (id) => {
      calls++;
      throw new RoleUpdateError("limited", id === "1" ? 429 : 403, 4500);
    },
    { signal: new AbortController().signal, sleep },
  );
  expect(calls).toBe(4);
  expect(sleep.mock.calls.map((x) => x[0])).toEqual([4500, 4500]);
  expect(result.failed).toHaveLength(2);
  expect(retryAfterMilliseconds("2.5", {})).toBe(2500);
  expect(retryAfterMilliseconds(null, { retry_after: 1.25 })).toBe(1250);
  expect(
    retryAfterMilliseconds(
      "Tue, 10 Nov 2026 12:00:05 GMT",
      {},
      Date.parse("2026-11-10T12:00:00Z"),
    ),
  ).toBe(5000);
});
test("cancellation stops the remaining members and reports an ambiguous in-flight request", async () => {
  const abort = new AbortController();
  const update = vi.fn(async (_id: string, signal: AbortSignal) => {
    await new Promise<void>((_resolve, reject) =>
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  });
  const pending = runBulkRoleUpdates(["1", "2", "3"], update, {
    signal: abort.signal,
  });
  abort.abort();
  const result = await pending;
  expect(update).toHaveBeenCalledTimes(1);
  expect(result.cancelled).toBe(true);
  expect(result.failed[0].error).toMatch(/Resultatet/);
  expect(result.remaining).toEqual(["2", "3"]);
});
