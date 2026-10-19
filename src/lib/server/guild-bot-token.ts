import type { Untyped } from "@/types/untyped";
import { decryptBotToken } from "@/lib/server/bot-token-crypto";

/** Resolve by Discord snowflake. Configuration errors must never select another bot. */
export async function resolveGuildBotToken(
  db: Untyped,
  discordGuildId: string,
  defaultToken = process.env.DISCORD_BOT_TOKEN,
): Promise<string> {
  if (!/^\d{16,22}$/.test(discordGuildId || ""))
    throw new Error("Invalid Discord guild ID");
  const { data: guild, error: guildError } = await db
    .from("guilds")
    .select("id")
    .eq("guild_id", discordGuildId)
    .maybeSingle();
  if (guildError) throw new Error("Unable to resolve guild bot");
  if (guild) {
    const { data: settings, error } = await db
      .from("guild_bot_settings")
      .select("bot_token_encrypted, is_custom_bot, is_active")
      .eq("guild_id", guild.id)
      .maybeSingle();
    if (error) throw new Error("Unable to resolve guild bot");
    if (settings?.is_custom_bot) {
      if (!settings.is_active || !settings.bot_token_encrypted) {
        throw new Error("Custom bot is inactive or missing its token");
      }
      const token = decryptBotToken(
        settings.bot_token_encrypted,
        process.env.BOT_SECRET_KEY || "",
      );
      if (!token.trim()) throw new Error("Custom bot token is empty");
      return token;
    }
  }
  const token = defaultToken;
  if (!token) throw new Error("Default bot token is not configured");
  return token;
}
