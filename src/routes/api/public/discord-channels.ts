// @ts-nocheck
// Migrated from Supabase Edge Function `discord-channels` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


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
      __env("SUPABASE_URL")!,
      __env("SUPABASE_SERVICE_ROLE_KEY")!
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

    // Channel requests go through the authenticated VPS bridge. Discord tokens never leave the VPS.
    const bridgeUrl = __env("GUILDOS_BRIDGE_URL");
    const bridgeSecret = __env("GUILDOS_BRIDGE_SECRET");
    if (!bridgeUrl || !bridgeSecret) {
      return new Response(JSON.stringify({ error: "GuildOS VPS bridge is not configured (GUILDOS_BRIDGE_URL / GUILDOS_BRIDGE_SECRET)" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let target: URL;
    try {
      target = new URL(bridgeUrl);
      if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) throw new Error("Invalid bridge URL");
      target.pathname = target.pathname.replace(/\\/$/, "") + "/v1/guilds/" + encodeURIComponent(guild.guild_id) + "/channels";
    } catch {
      return new Response(JSON.stringify({ error: "GUILDOS_BRIDGE_URL must be an HTTPS base URL" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bridgeResponse: Response;
    try {
      bridgeResponse = await fetch(target.toString(), {
        method: "GET",
        headers: { Authorization: "Bearer " + bridgeSecret },
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      console.error("VPS bridge unreachable:", error);
      return new Response(JSON.stringify({ error: "GuildOS VPS bridge is unreachable. Verify HTTPS tunnel and bot bridge service." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await bridgeResponse.json().catch(() => null);
    if (!bridgeResponse.ok) {
      console.error("VPS bridge returned status", bridgeResponse.status, payload?.code);
      const safeMessage = bridgeResponse.status === 404 ? "GuildOS bot is not in the selected Discord server" :
        bridgeResponse.status === 401 ? "VPS bridge authentication failed. Check matching GUILDOS_BRIDGE_SECRET values" :
        bridgeResponse.status === 429 ? "Discord rate limited channel requests" :
        "VPS bridge failed to fetch channels (" + bridgeResponse.status + ")";
      return new Response(JSON.stringify({ error: safeMessage }), {
        status: bridgeResponse.status === 401 ? 502 : bridgeResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!payload || !Array.isArray(payload.channels) || !Array.isArray(payload.categories)) {
      return new Response(JSON.stringify({ error: "VPS bridge returned invalid channel data" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ channels: payload.channels, categories: payload.categories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/discord-channels')({
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
