// @ts-nocheck
// Migrated from Supabase Edge Function `discord-roles` to a TanStack server route.
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

    // Discord operations are performed by the VPS. Cloudflare never holds bot tokens.
    const roles: DiscordRole[] = await vpsDiscordRequest(guild.guild_id, '/roles');
    const botMember = await vpsDiscordRequest(guild.guild_id, '/bot-member').catch((error) => {
      console.warn('Could not resolve bot member roles:', error);
      return null;
    });

    const botRoleIds = new Set<string>([
      guild.guild_id,
      ...((botMember?.roles || []) as string[]),
    ]);
    const botRoles = roles.filter((role) => botRoleIds.has(role.id));
    const highestBotRolePosition = botRoles.reduce(
      (max, role) => Math.max(max, role.position || 0),
      0,
    );
    const permissionBits = botRoles.reduce(
      (bits, role: any) => bits | BigInt(role.permissions || "0"),
      0n,
    );
    const hasAdministrator = (permissionBits & 8n) === 8n;
    const hasManageRoles = hasAdministrator || (permissionBits & 268435456n) === 268435456n;

    const filteredRoles = roles
      .filter((role) => role.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((role) => {
        let assignable = true;
        let reason: string | null = null;

        if (role.managed) {
          assignable = false;
          reason = "Discord-administreret rolle";
        } else if (!hasManageRoles) {
          assignable = false;
          reason = 'Botten mangler "Manage Roles"';
        } else if ((role.position || 0) >= highestBotRolePosition) {
          assignable = false;
          reason = "Rollen ligger over eller på niveau med bottens højeste rolle";
        }

        return {
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          managed: role.managed,
          assignable,
          reason,
        };
      });

    console.log(
      `Fetched ${filteredRoles.length} roles for guild ${guild.guild_id}; ` +
      `${filteredRoles.filter((r) => r.assignable).length} assignable`
    );

    return new Response(JSON.stringify({
      roles: filteredRoles,
      bot_permissions: {
        manage_roles: hasManageRoles,
        administrator: hasAdministrator,
        highest_role_position: highestBotRolePosition,
      },
    }), {
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
