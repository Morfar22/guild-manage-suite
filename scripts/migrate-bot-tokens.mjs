import { createClient } from "@supabase/supabase-js";
import {
  decryptBotToken,
  encryptBotToken,
} from "../src/lib/server/bot-token-crypto.ts";

const apply = process.argv.includes("--apply");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOT_SECRET_KEY } = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !BOT_SECRET_KEY ||
  BOT_SECRET_KEY === "default-encryption-key"
) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a non-default BOT_SECRET_KEY are required",
  );
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let legacy = 0;
let migrated = 0;
for (let offset = 0; ; offset += 500) {
  const { data, error } = await supabase
    .from("guild_bot_settings")
    .select("id, bot_token_encrypted")
    .order("id")
    .range(offset, offset + 499);
  if (error) throw new Error("Unable to read bot settings; migration stopped");
  for (const row of data || []) {
    const encoded = row.bot_token_encrypted;
    if (!encoded || encoded.startsWith("v1.")) continue;
    const token = decryptBotToken(encoded, BOT_SECRET_KEY);
    // Legacy XOR has no integrity tag: verify the key/token with Discord before persisting it.
    const identity = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!identity.ok)
      throw new Error(
        "A legacy token could not be verified; migration stopped without printing credentials",
      );
    legacy++;
    if (!apply) continue;
    const { data: updated, error: updateError } = await supabase
      .from("guild_bot_settings")
      .update({ bot_token_encrypted: encryptBotToken(token, BOT_SECRET_KEY) })
      .eq("id", row.id)
      .eq("bot_token_encrypted", encoded)
      .select("id");
    if (updateError || updated?.length !== 1)
      throw new Error(
        "Bot settings changed or update failed; migration stopped",
      );
    migrated++;
  }
  if (!data || data.length < 500) break;
}
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    legacyTokensVerified: legacy,
    migrated,
  }),
);
