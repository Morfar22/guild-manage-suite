// @ts-nocheck
// Migrated from Supabase Edge Function `create-demo-guild` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

__serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseServiceKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Creating demo guild for user:", user.id);

    // Create guild with service role (bypasses RLS)
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .insert({
        guild_id: body.guild_id || `demo_${Date.now()}`,
        guild_name: body.guild_name || "Demo Server",
        guild_icon: body.guild_icon || null,
        owner_id: user.id,
        command_prefix: body.command_prefix || "!",
        log_channel_id: body.log_channel_id || null,
        auto_moderation_enabled: body.auto_moderation_enabled || false,
      })
      .select()
      .single();

    if (guildError) {
      console.error("Failed to create guild:", guildError);
      return new Response(JSON.stringify({ error: "Failed to create guild", details: guildError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Guild created:", guild.id);

    // Link user to guild
    const { error: linkError } = await supabase
      .from("user_guilds")
      .insert({
        user_id: user.id,
        guild_id: guild.id,
        discord_user_id: user.id,
        has_admin_permission: true,
      });

    if (linkError) {
      console.error("Failed to link user to guild:", linkError);
      // Clean up the guild if we couldn't link
      await supabase.from("guilds").delete().eq("id", guild.id);
      return new Response(JSON.stringify({ error: "Failed to link user to guild", details: linkError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User linked to guild");

    // Add default modules
    const modules = ["moderation", "music", "leveling", "utility", "fun"];
    for (const module of modules) {
      await supabase
        .from("guild_modules")
        .insert({
          guild_id: guild.id,
          module_type: module,
          enabled: true,
        });
    }

    console.log("Default modules added");

    return new Response(
      JSON.stringify({ success: true, guild }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/create-demo-guild')({
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
