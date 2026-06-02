import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-forwarded-for, cf-connecting-ip",
};

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

    // Get user from token
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser(token);
    if (userError || !userData.user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Create admin client for checking roles
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is admin or staff using the database function (handles enum properly)
    const { data: hasRole, error: roleError } = await supabaseAdmin
      .rpc('has_admin_or_staff_role', { _user_id: userId });

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(JSON.stringify({ error: "Failed to check role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden - Not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the client's IP address from headers
    // Try multiple headers as different proxies use different headers
    const clientIp = 
      req.headers.get("cf-connecting-ip") || // Cloudflare
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || // Standard proxy
      req.headers.get("x-real-ip") || // Nginx
      "unknown";

    console.log("Client IP:", clientIp);

    // Check if IP is in whitelist
    const { data: whitelistData, error: whitelistError } = await supabaseAdmin
      .from("admin_ip_whitelist")
      .select("ip_address")
      .eq("ip_address", clientIp)
      .maybeSingle();

    if (whitelistError) {
      console.error("Whitelist check error:", whitelistError);
      return new Response(JSON.stringify({ error: "Failed to check whitelist" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check if whitelist is empty (allow all if no IPs configured)
    const { count, error: countError } = await supabaseAdmin
      .from("admin_ip_whitelist")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Count error:", countError);
    }

    const whitelistEmpty = (count ?? 0) === 0;
    const isWhitelisted = whitelistEmpty || !!whitelistData;

    return new Response(
      JSON.stringify({
        allowed: isWhitelisted,
        ip: clientIp,
        whitelistEmpty,
        message: isWhitelisted 
          ? "Access granted" 
          : "Your IP is not whitelisted for admin access",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-check-ip error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
