import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotToken(supabaseAdmin: any, guildId: string): Promise<string> {
  const { data: customBotSettings } = await supabaseAdmin
    .from("guild_bot_settings")
    .select("bot_token_encrypted, is_custom_bot, is_active")
    .eq("guild_id", guildId)
    .eq("is_custom_bot", true)
    .maybeSingle();

  const encryptionKey = Deno.env.get("BOT_SECRET_KEY") || "default-encryption-key";

  if (customBotSettings?.bot_token_encrypted && customBotSettings.is_custom_bot) {
    return simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
  }
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("No bot token available");
  return token;
}

async function verifyAccess(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuthed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error } = await supabaseAuthed.auth.getClaims(token);
  if (error || !claimsData?.claims?.sub) throw new Error("Unauthorized");

  const userId = claimsData.claims.sub;
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  return { userId, supabaseAdmin };
}

async function verifyGuildAccess(supabaseAdmin: any, guildId: string, userId: string) {
  // Check if user is a global admin/staff (bypass guild access check)
  const { data: isGlobalAdmin } = await supabaseAdmin.rpc("has_admin_or_staff_role", { _user_id: userId });

  if (!isGlobalAdmin) {
    const { data: userGuild, error } = await supabaseAdmin
      .from("user_guilds")
      .select("guild_id, has_admin_permission")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!userGuild?.has_admin_permission) throw new Error("Forbidden");
  }

  const { data: guild, error: guildError } = await supabaseAdmin
    .from("guilds")
    .select("guild_id")
    .eq("id", guildId)
    .single();

  if (guildError || !guild) throw new Error("Guild not found");
  return guild.guild_id; // Discord snowflake
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, supabaseAdmin } = await verifyAccess(req);
    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");
    if (!guildId) throw new Error("Missing guildId");

    const discordGuildId = await verifyGuildAccess(supabaseAdmin, guildId, userId);
    const botToken = await getBotToken(supabaseAdmin, guildId);

    const discordHeaders = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    };

    // --- GET: list members ---
    if (req.method === "GET") {
      const limit = url.searchParams.get("limit") || "100";
      const after = url.searchParams.get("after") || "0";

      const discordRes = await fetch(
        `https://discord.com/api/v10/guilds/${discordGuildId}/members?limit=${limit}&after=${after}`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        console.error("Discord members error:", discordRes.status, errText);
        throw new Error(`Discord API error (${discordRes.status})`);
      }

      const members = await discordRes.json();

      // Also fetch roles for display
      const rolesRes = await fetch(
        `https://discord.com/api/v10/guilds/${discordGuildId}/roles`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      const roles = rolesRes.ok ? await rolesRes.json() : [];

      return new Response(JSON.stringify({ members, roles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- POST: add or remove role ---
    if (req.method === "POST") {
      const body = await req.json();
      const { memberId, roleId, action } = body;

      if (!memberId || !roleId || !["add", "remove"].includes(action)) {
        return new Response(JSON.stringify({ error: "Invalid parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const method = action === "add" ? "PUT" : "DELETE";
      const url = `https://discord.com/api/v10/guilds/${discordGuildId}/members/${memberId}/roles/${roleId}`;

      let res = await fetch(url, { method, headers: discordHeaders });

      // Retry on rate limit (max 3 attempts)
      for (let attempt = 0; attempt < 3 && res.status === 429; attempt++) {
        const retryData = await res.json().catch(() => ({}));
        const retryAfter = (retryData.retry_after || 2) * 1000;
        console.log(`Rate limited, waiting ${retryAfter}ms before retry ${attempt + 1}`);
        await new Promise((r) => setTimeout(r, retryAfter));
        res = await fetch(url, { method, headers: discordHeaders });
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Role ${action} failed:`, res.status, errText);
        return new Response(JSON.stringify({ error: `Failed to ${action} role (${res.status})` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await res.text().catch(() => "");

      return new Response(JSON.stringify({ success: true, action, memberId, roleId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    console.error("discord-members error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
