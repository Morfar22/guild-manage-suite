// @ts-nocheck
// Migrated from Supabase Edge Function `discord-roles` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

// Simple decryption using XOR with a key
function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAuthed = createClient(
      __env("SUPABASE_URL")!,
      __env("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await supabaseAuthed.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("getClaims failed", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      __env("SUPABASE_URL")!,
      __env("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get guild_id from query params
    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");

    if (!guildId) {
      return new Response(JSON.stringify({ error: "Missing guildId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is a global admin/staff (bypass guild access check)
    const { data: isGlobalAdmin } = await supabaseAdmin.rpc("has_admin_or_staff_role", { _user_id: userId });

    if (!isGlobalAdmin) {
      // Verify user has access to this guild
      const { data: userGuild, error: userGuildError } = await supabaseAdmin
        .from("user_guilds")
        .select("guild_id, has_admin_permission")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .maybeSingle();

      if (userGuildError) throw userGuildError;
      if (!userGuild?.has_admin_permission) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get the Discord guild_id (snowflake) from the guilds table
    const { data: guild, error: guildError } = await supabaseAdmin
      .from("guilds")
      .select("guild_id")
      .eq("id", guildId)
      .single();

    if (guildError) throw guildError;
    if (!guild) {
      return new Response(JSON.stringify({ error: "Guild not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this guild has a custom bot configured
    const { data: customBotSettings } = await supabaseAdmin
      .from("guild_bot_settings")
      .select("bot_token_encrypted, is_custom_bot, is_active")
      .eq("guild_id", guildId)
      .eq("is_custom_bot", true)
      .maybeSingle();

    const encryptionKey = __env("BOT_SECRET_KEY") || "default-encryption-key";
    let botToken: string | null = null;

    // Use custom bot token if available and active, otherwise fall back to global bot
    if (customBotSettings?.bot_token_encrypted && customBotSettings.is_custom_bot) {
      botToken = simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
      console.log(`Using custom bot token for guild ${guild.guild_id}`);
    } else {
      botToken = __env("DISCORD_BOT_TOKEN") || null;
      console.log(`Using global bot token for guild ${guild.guild_id}`);
    }

    if (!botToken) {
      return new Response(JSON.stringify({ error: "No bot token available for this guild" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${guild.guild_id}/roles`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error("Discord API error", discordRes.status, errorText);
      
      // Provide more helpful error message
      if (discordRes.status === 404) {
        return new Response(JSON.stringify({ 
          error: "Bot is not a member of this Discord server. Please invite the bot first.",
          details: "Unknown Guild (404)"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`Discord API error (${discordRes.status})`);
    }

    const roles: DiscordRole[] = await discordRes.json();

    // Filter out @everyone role and managed roles (bot roles), sort by position
    const filteredRoles = roles
      .filter((role) => role.name !== "@everyone" && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
      }));

    console.log(`Fetched ${filteredRoles.length} roles for guild ${guild.guild_id}`);

    return new Response(JSON.stringify({ roles: filteredRoles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("discord-roles error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/discord-roles')({
  server: {
    handlers: {
      GET: __call,
      POST: __call,
      PUT: __call,
      PATCH: __call,
      DELETE: __call,
      OPTIONS: __call,
    },
  },
})
