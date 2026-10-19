import type { SupabaseClient } from "@supabase/supabase-js";

export function apiError(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireUser(req: Request, supabase: SupabaseClient) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) {
    throw apiError(401, "Unauthorized");
  }
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !data.user) throw apiError(401, "Unauthorized");
  return data.user;
}

export async function requireGuildAdmin(
  supabase: SupabaseClient,
  userId: string,
  guildId: string,
) {
  if (typeof guildId !== "string" || !guildId)
    throw apiError(400, "guildId required");
  const { data, error } = await supabase
    .from("user_guilds")
    .select("has_admin_permission")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error || !data?.has_admin_permission)
    throw apiError(403, "No permission for this guild");
  const { data: guild, error: guildError } = await supabase
    .from("guilds")
    .select("id, guild_id")
    .eq("id", guildId)
    .single();
  if (guildError || !guild) throw apiError(404, "Guild not found");
  return guild;
}

export function requireBotSecret(req: Request) {
  const expected = process.env.BOT_SECRET_KEY;
  const supplied = req.headers.get("x-bot-secret");
  if (!safeEqual(supplied, expected)) throw apiError(401, "Unauthorized");
}

export async function requireGuildChannel(
  botToken: string,
  discordGuildId: string,
  channelId: string,
) {
  if (!/^\d{16,22}$/.test(channelId)) throw apiError(400, "Invalid channel ID");
  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}`,
    {
      headers: { Authorization: `Bot ${botToken}` },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok)
    throw apiError(
      response.status === 404 ? 404 : 502,
      "Unable to verify Discord channel",
    );
  const channel = await response.json();
  if (channel.guild_id !== discordGuildId)
    throw apiError(403, "Channel does not belong to this guild");
}

/**
 * Constant-time string comparison for shared secrets (bot secret, API keys).
 * Works in Node, Workers and Deno without depending on node:crypto.
 */
export function safeEqual(
  supplied: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (typeof supplied !== "string" || typeof expected !== "string")
    return false;
  if (!supplied || !expected) return false;
  const enc = new TextEncoder();
  const a = enc.encode(supplied);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++)
    diff |= (a[i % a.length] ?? 0) ^ (b[i % b.length] ?? 0);
  return diff === 0;
}
