// @ts-nocheck
// Migrated from Supabase Edge Function `discord-members` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { vpsDiscordRequest } from '@/lib/vps-discord-bridge'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


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

  const encryptionKey = __env("BOT_SECRET_KEY") || "default-encryption-key";

  if (customBotSettings?.bot_token_encrypted && customBotSettings.is_custom_bot) {
    return simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
  }
  const token = __env("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("No bot token available");
  return token;
}

async function verifyAccess(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuthed = createClient(
    __env("SUPABASE_URL")!,
    __env("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error } = await supabaseAuthed.auth.getClaims(token);
  if (error || !claimsData?.claims?.sub) throw new Error("Unauthorized");

  const userId = claimsData.claims.sub;
  const supabaseAdmin = createClient(
    __env("SUPABASE_URL")!,
    __env("SUPABASE_SERVICE_ROLE_KEY")!,
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

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, supabaseAdmin } = await verifyAccess(req);
    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");
    if (!guildId) throw new Error("Missing guildId");

    const discordGuildId = await verifyGuildAccess(supabaseAdmin, guildId, userId);
    if (req.method === 'GET') {
      const requestedLimit = Number(url.searchParams.get('limit') || 100);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, Math.floor(requestedLimit))) : 100;
      const after = url.searchParams.get('after') || '0';
      if (!/^\d{1,22}$/.test(after)) {
        return new Response(JSON.stringify({ error: 'Invalid pagination cursor' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const members = await vpsDiscordRequest(discordGuildId, '/members?limit=' + limit + '&after=' + after);
      const roles = await vpsDiscordRequest(discordGuildId, '/roles');
      return new Response(JSON.stringify({ members, roles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { memberId, roleId, action } = body || {};
      if (!/^\d{16,22}$/.test(String(memberId)) || !/^\d{16,22}$/.test(String(roleId)) ||
          !['add', 'remove'].includes(action)) {
        return new Response(JSON.stringify({ error: 'Invalid role action parameters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await vpsDiscordRequest(discordGuildId, '/members/' + memberId + '/roles/' + roleId, action === 'add' ? 'PUT' : 'DELETE');
      return new Response(JSON.stringify({ success: true, action, memberId, roleId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/discord-members')({
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
