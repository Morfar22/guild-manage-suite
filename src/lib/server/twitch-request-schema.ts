import { z } from "zod";

const identifier = z.string().trim().min(1).max(128);

export const twitchLookupBodySchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{1,25}$/),
});

export const twitchTestBodySchema = z.object({ streamer_id: identifier });
export const twitchSchedulePostBodySchema = z.object({ guild_id: identifier });

/**
 * This endpoint is a dashboard API and a secret-authenticated polling target,
 * not an EventSub callback. Never let an EventSub delivery trigger polling.
 */
export const twitchEventSubBodySchema = z
  .object({
    subscription: z
      .object({
        id: identifier,
        type: z.string().min(1),
        version: z.string().min(1),
        status: z.string().min(1),
      })
      .passthrough(),
    event: z.record(z.string(), z.unknown()).optional(),
    challenge: z.string().min(1).optional(),
  })
  .passthrough();

export class InvalidTwitchBody extends Error {
  constructor(message = "Invalid request body") {
    super(message);
  }
}

export async function parseTwitchBody<Output>(
  request: Request,
  schema: z.ZodType<Output>,
): Promise<Output> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidTwitchBody("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InvalidTwitchBody();
  return parsed.data;
}
