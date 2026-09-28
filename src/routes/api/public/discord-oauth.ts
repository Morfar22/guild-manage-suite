// @ts-nocheck
// Migrated from Supabase Edge Function `discord-oauth` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface DiscordUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
}

__serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const DISCORD_CLIENT_ID = __env("DISCORD_CLIENT_ID")?.trim();
  const DISCORD_CLIENT_SECRET = __env("DISCORD_CLIENT_SECRET")?.trim();
  const SUPABASE_URL = __env("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = __env("SUPABASE_SERVICE_ROLE_KEY");

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    console.error("Discord credentials not configured");
    return new Response(
      JSON.stringify({ error: "Discord OAuth not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Action: Get authorization URL
    if (action === "authorize") {
      const { redirectUri } = await req.json();
      
      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify email guilds",
      });

      const authUrl = `https://discord.com/api/oauth2/authorize?${params}`;
      
      console.log("Generated Discord auth URL");
      return new Response(
        JSON.stringify({ url: authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Exchange code for tokens and fetch user data
    if (action === "callback") {
      const { code, redirectUri } = await req.json();

      if (!code) {
        return new Response(
          JSON.stringify({ error: "No authorization code provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Exchanging code for token...");

      // Exchange code for access token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      console.log("Token obtained, fetching user data...");

      // Fetch Discord user info
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userResponse.ok) {
        console.error("Failed to fetch Discord user");
        return new Response(
          JSON.stringify({ error: "Failed to fetch Discord user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const discordUser: DiscordUser = await userResponse.json();
      console.log("Discord user fetched:", discordUser.username);

      // Fetch user's guilds
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!guildsResponse.ok) {
        console.error("Failed to fetch Discord guilds");
        return new Response(
          JSON.stringify({ error: "Failed to fetch Discord guilds" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const discordGuilds: DiscordGuild[] = await guildsResponse.json();
      console.log(`Fetched ${discordGuilds.length} guilds`);

      // Filter guilds where user has MANAGE_GUILD or ADMINISTRATOR permissions
      // Permission bit 0x8 = ADMINISTRATOR. Owners always pass.
      // Strict: only true server admins (or owners) get access — not just MANAGE_GUILD.
      const adminGuilds = discordGuilds.filter((guild) => {
        if (guild.owner) return true;
        const perms = BigInt(guild.permissions);
        return (perms & BigInt(0x8)) !== BigInt(0);
      });

      console.log(`User has admin access to ${adminGuilds.length} guilds`);

      // Create Supabase admin client
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      // Check if user exists or create new user
      const email = discordUser.email || `${discordUser.id}@discord.user`;
      
      // Try to sign in or create user
      let userId: string;
      
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        userId = existingUser.id;
        console.log("Existing user found:", userId);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            discord_id: discordUser.id,
            discord_username: discordUser.username,
            avatar: discordUser.avatar,
          },
        });

        if (createError) {
          console.error("Failed to create user:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create user account" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.user.id;
        console.log("New user created:", userId);
      }

      // Check if this email is in pending_admin_emails and promote to admin
      const { data: pendingAdmin } = await supabase
        .from("pending_admin_emails")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("processed", false)
        .maybeSingle();

      if (pendingAdmin) {
        console.log("Found pending admin email, promoting user to admin role");
        
        // Add admin role
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            { user_id: userId, role: "admin" },
            { onConflict: "user_id,role" }
          );

        if (!roleError) {
          // Mark as processed
          await supabase
            .from("pending_admin_emails")
            .update({ processed: true })
            .eq("id", pendingAdmin.id);
          
          console.log("User promoted to admin successfully");
        } else {
          console.error("Failed to assign admin role:", roleError);
        }
      }

      // Clear old links so users lose access to guilds where they're no longer admin
      const adminGuildDiscordIds = adminGuilds.map((g) => g.id);
      const { data: currentGuildRows } = await supabase
        .from("guilds")
        .select("id, guild_id")
        .in("guild_id", adminGuildDiscordIds.length > 0 ? adminGuildDiscordIds : ["__none__"]);
      const keepInternalIds = new Set((currentGuildRows || []).map((g) => g.id));

      const { data: existingLinks } = await supabase
        .from("user_guilds")
        .select("guild_id")
        .eq("user_id", userId);
      const toRemove = (existingLinks || [])
        .map((l) => l.guild_id)
        .filter((gid) => !keepInternalIds.has(gid));
      if (toRemove.length > 0) {
        await supabase
          .from("user_guilds")
          .delete()
          .eq("user_id", userId)
          .in("guild_id", toRemove);
        console.log(`Removed ${toRemove.length} stale guild links for user`);
      }

      // Sync guilds to database
      for (const guild of adminGuilds) {
        // Upsert guild
        const { data: guildData, error: guildError } = await supabase
          .from("guilds")
          .upsert(
            {
              guild_id: guild.id,
              guild_name: guild.name,
              guild_icon: guild.icon,
              owner_id: guild.owner ? discordUser.id : guild.id,
            },
            { onConflict: "guild_id" }
          )
          .select()
          .single();

        if (guildError) {
          console.error("Failed to upsert guild:", guildError);
          continue;
        }

        // Link user to guild
        const { error: linkError } = await supabase
          .from("user_guilds")
          .upsert(
            {
              user_id: userId,
              guild_id: guildData.id,
              discord_user_id: discordUser.id,
              has_admin_permission: true,
            },
            { onConflict: "user_id,guild_id" }
          );

        if (linkError) {
          console.error("Failed to link user to guild:", linkError);
        }

        // Initialize default modules if not exist
        const modules = ["moderation", "music", "leveling", "utility", "fun"];
        for (const module of modules) {
          await supabase
            .from("guild_modules")
            .upsert(
              {
                guild_id: guildData.id,
                module_type: module,
                enabled: true,
              },
              { onConflict: "guild_id,module_type" }
            );
        }
      }

      // Generate a magic link for the user to sign in
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (sessionError) {
        console.error("Failed to generate session:", sessionError);
        return new Response(
          JSON.stringify({ error: `Failed to create session: ${sessionError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("OAuth flow complete, returning session data");

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: userId,
            email,
            discord_id: discordUser.id,
            discord_username: discordUser.username,
            avatar: discordUser.avatar,
          },
          guilds: adminGuilds.length,
          token_hash: sessionData.properties?.hashed_token,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Discord OAuth error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/discord-oauth')({
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
