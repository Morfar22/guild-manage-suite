import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
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

Deno.serve(async (req) => {
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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");

    if (!guildId) {
      return new Response(JSON.stringify({ error: "Missing guildId" }), {
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

    // Get the guild's Discord guild_id
    const { data: guild, error: guildError } = await supabaseAdmin
      .from("guilds")
      .select("guild_id")
      .eq("id", guildId)
      .single();

    if (guildError || !guild) {
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

    const encryptionKey = Deno.env.get("BOT_SECRET_KEY") || "default-encryption-key";
    let botToken: string | null = null;

    // Use custom bot token if available and active, otherwise fall back to global bot
    if (customBotSettings?.bot_token_encrypted && customBotSettings.is_custom_bot) {
      botToken = simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
      console.log(`Using custom bot token for guild ${guild.guild_id}`);
    } else {
      botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
      console.log(`Using global bot token for guild ${guild.guild_id}`);
    }

    if (!botToken) {
      return new Response(JSON.stringify({ error: "No bot token available for this guild" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch channels from Discord API
    const discordResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guild.guild_id}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord API error:", discordResponse.status, errorText);
      
      // Provide more helpful error message
      if (discordResponse.status === 404) {
        return new Response(JSON.stringify({ 
          error: "Bot is not a member of this Discord server. Please invite the bot first.",
          details: "Unknown Guild (404)"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Failed to fetch channels from Discord" }), {
        status: discordResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allChannels: DiscordChannel[] = await discordResponse.json();
    
    // Channel types: 0 = text, 2 = voice, 4 = category, 5 = announcement, 13 = stage, 15 = forum
    // Return text channels, voice channels, and categories
    const textChannels = allChannels
      .filter((c) => [0, 5, 15].includes(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parent_id: c.parent_id,
      }));

    const voiceChannels = allChannels
      .filter((c) => [2, 13].includes(c.type)) // 2 = voice, 13 = stage
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parent_id: c.parent_id,
      }));

    const categories = allChannels
      .filter((c) => c.type === 4)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));

    // Combine text and voice channels for backwards compatibility
    const channels = [...textChannels, ...voiceChannels];

    console.log(`Fetched ${textChannels.length} text channels, ${voiceChannels.length} voice channels and ${categories.length} categories for guild ${guild.guild_id}`);

    return new Response(
      JSON.stringify({ channels, categories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
