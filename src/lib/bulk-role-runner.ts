export class RoleUpdateError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterMs = 0,
  ) {
    super(message);
    this.name = "RoleUpdateError";
  }
}

export function retryAfterMilliseconds(
  header: string | null,
  body: unknown,
  now = Date.now(),
) {
  const value =
    typeof body === "object" && body !== null && "retry_after" in body
      ? Number(body.retry_after)
      : NaN;
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0)
      return Math.ceil(seconds * 1000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  return Number.isFinite(value) && value >= 0 ? Math.ceil(value * 1000) : 1000;
}

export interface BulkRoleResult {
  succeeded: string[];
  failed: Array<{ memberId: string; error: string }>;
  remaining: string[];
  cancelled: boolean;
}

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

// PUT/DELETE role updates set an idempotent state. Await each server result;
// only explicit 429 responses are retried automatically, never other failures.
export async function runBulkRoleUpdates(
  memberIds: string[],
  update: (memberId: string, signal: AbortSignal) => Promise<void>,
  options: {
    signal: AbortSignal;
    onProgress?: (result: BulkRoleResult) => void;
    sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  },
): Promise<BulkRoleResult> {
  const ids = [...new Set(memberIds)];
  const result: BulkRoleResult = {
    succeeded: [],
    failed: [],
    remaining: [...ids],
    cancelled: false,
  };
  const sleep = options.sleep ?? abortableDelay;
  for (let index = 0; index < ids.length; index++) {
    if (options.signal.aborted) break;
    const memberId = ids[index];
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await update(memberId, options.signal);
          break;
        } catch (error) {
          if (
            !(error instanceof RoleUpdateError) ||
            error.status !== 429 ||
            attempt >= 2 ||
            error.retryAfterMs > 300_000
          )
            throw error;
          await sleep(Math.max(100, error.retryAfterMs), options.signal);
        }
      }
      result.succeeded.push(memberId);
    } catch (error) {
      result.failed.push({
        memberId,
        error: options.signal.aborted
          ? "Stoppet under forespørgslen. Resultatet kan være gennemført; kontrollér rollen."
          : error instanceof Error
            ? error.message
            : "Rollen kunne ikke ændres",
      });
    }
    result.remaining = ids.slice(index + 1);
    if (!options.signal.aborted)
      options.onProgress?.({
        ...result,
        succeeded: [...result.succeeded],
        failed: [...result.failed],
      });
    if (options.signal.aborted) break;
  }
  result.cancelled = options.signal.aborted;
  return result;
}
