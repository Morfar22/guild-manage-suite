import type { SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { randomBytes, timingSafeEqual } from "node:crypto";

export const DISCORD_REDIRECT_URI = "https://bot.nethost-solutions.dk/auth";
const COOKIE = "__Host-discord_oauth_state";
export function createOAuthState() {
  const state = randomBytes(32).toString("hex");
  return {
    state,
    cookie: `${COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  };
}
export function clearOAuthStateCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export function validOAuthState(req: Request, state: unknown) {
  if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state)) return false;
  const expected = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(state));
}

// Supabase's admin list is paginated. Never treat an incomplete/failed lookup as a new user.
export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const normalized = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    if (!data?.users) throw new Error("Unable to look up account");
    const user = data.users.find(
      (candidate: { email?: string }) =>
        candidate.email?.toLowerCase() === normalized,
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}
