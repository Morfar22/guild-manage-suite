import { vi } from "vitest";

export async function rejectNetwork(input: RequestInfo | URL): Promise<never> {
  throw new Error(`Unmocked network request in offline test: ${String(input)}`);
}

/** Fail on unexpected URLs rather than accidentally falling through to the internet. */
export function createFetchStub(
  respond: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(
      respond(
        new URL(input instanceof Request ? input.url : String(input)),
        init,
      ),
    ),
  );
}
