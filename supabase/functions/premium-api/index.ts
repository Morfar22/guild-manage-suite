import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate with dedicated hosting API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("HOSTING_API_KEY");

    if (!expectedKey) {
      console.error("HOSTING_API_KEY not configured");
      return json({ error: "Server misconfigured" }, 500);
    }

    if (!apiKey || apiKey !== expectedKey) {
      return json({ error: "Unauthorized – invalid or missing x-api-key" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    if (req.method === "GET") {
      return handleGet(supabase, url);
    }

    if (req.method === "POST") {
      const body = await req.json();
      return handlePost(supabase, body);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("Premium API error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── GET handlers ───────────────────────────────────────────

async function handleGet(supabase: ReturnType<typeof createClient>, url: URL) {
  const action = url.searchParams.get("action") || "guild_features";
  const guildId = url.searchParams.get("guild_id");

  // GET ?action=guild_features&guild_id=X  → features for one guild
  if (action === "guild_features") {
    if (!guildId) return json({ error: "guild_id required" }, 400);

    const { data, error } = await supabase
      .from("guild_premium_features")
      .select("*")
      .eq("guild_id", guildId);
    if (error) throw error;

    return json({ guild_id: guildId, features: data || [] });
  }

  // GET ?action=all_guilds  → all guilds with their premium features
  if (action === "all_guilds") {
    const { data, error } = await supabase
      .from("guild_premium_features")
      .select("*")
      .order("enabled_at", { ascending: false });
    if (error) throw error;

    // Group by guild
    const grouped: Record<string, unknown[]> = {};
    for (const row of data || []) {
      if (!grouped[row.guild_id]) grouped[row.guild_id] = [];
      grouped[row.guild_id].push(row);
    }

    return json({ guilds: grouped });
  }

  // GET ?action=user_features&user_id=X  → premium features for a user
  if (action === "user_features") {
    const userId = url.searchParams.get("user_id");
    if (!userId) return json({ error: "user_id required" }, 400);

    const { data, error } = await supabase
      .from("user_premium_features")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;

    return json({ user_id: userId, features: data || [] });
  }

  // GET ?action=available_features  → list of all feature keys
  if (action === "available_features") {
    const features = [
      "ai_chat", "fivem", "custom_bot", "server_clone",
      "twitch", "global_ban", "jtc", "starboard", "applications", "tiktok",
    ];
    return json({ features });
  }

  return json({ error: "Unknown action. Use: guild_features, all_guilds, user_features, available_features" }, 400);
}

// ─── POST handlers ──────────────────────────────────────────

async function handlePost(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const action = body.action as string;

  // Toggle a single guild feature
  if (action === "toggle_guild_feature") {
    const { guild_id, feature, enabled, expires_at, notes } = body as {
      guild_id: string; feature: string; enabled: boolean;
      expires_at?: string | null; notes?: string | null;
    };

    if (!guild_id || !feature || typeof enabled !== "boolean") {
      return json({ error: "guild_id, feature, and enabled (bool) are required" }, 400);
    }

    if (enabled) {
      const { error } = await supabase
        .from("guild_premium_features")
        .upsert({
          guild_id,
          feature,
          enabled: true,
          enabled_by: null,
          enabled_at: new Date().toISOString(),
          expires_at: expires_at || null,
          notes: notes || null,
        }, { onConflict: "guild_id,feature" });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("guild_premium_features")
        .update({ enabled: false })
        .eq("guild_id", guild_id)
        .eq("feature", feature);
      if (error) throw error;
    }

    return json({ success: true, guild_id, feature, enabled });
  }

  // Bulk toggle multiple features for a guild
  if (action === "bulk_toggle_guild_features") {
    const { guild_id, features } = body as {
      guild_id: string;
      features: Array<{ feature: string; enabled: boolean; expires_at?: string | null; notes?: string | null }>;
    };

    if (!guild_id || !Array.isArray(features)) {
      return json({ error: "guild_id and features[] are required" }, 400);
    }

    const results: Array<{ feature: string; enabled: boolean; success: boolean; error?: string }> = [];

    for (const f of features) {
      try {
        if (f.enabled) {
          const { error } = await supabase
            .from("guild_premium_features")
            .upsert({
              guild_id,
              feature: f.feature,
              enabled: true,
              enabled_by: null,
              enabled_at: new Date().toISOString(),
              expires_at: f.expires_at || null,
              notes: f.notes || null,
            }, { onConflict: "guild_id,feature" });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("guild_premium_features")
            .update({ enabled: false })
            .eq("guild_id", guild_id)
            .eq("feature", f.feature);
          if (error) throw error;
        }
        results.push({ feature: f.feature, enabled: f.enabled, success: true });
      } catch (err) {
        results.push({ feature: f.feature, enabled: f.enabled, success: false, error: err.message });
      }
    }

    return json({ success: true, guild_id, results });
  }

  // Toggle a user premium feature
  if (action === "toggle_user_feature") {
    const { user_id, feature, enabled, expires_at, notes } = body as {
      user_id: string; feature: string; enabled: boolean;
      expires_at?: string | null; notes?: string | null;
    };

    if (!user_id || !feature || typeof enabled !== "boolean") {
      return json({ error: "user_id, feature, and enabled (bool) are required" }, 400);
    }

    if (enabled) {
      const { error } = await supabase
        .from("user_premium_features")
        .upsert({
          user_id,
          feature,
          enabled: true,
          enabled_by: null,
          enabled_at: new Date().toISOString(),
          expires_at: expires_at || null,
          notes: notes || null,
        }, { onConflict: "user_id,feature" });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_premium_features")
        .update({ enabled: false })
        .eq("user_id", user_id)
        .eq("feature", feature);
      if (error) throw error;
    }

    return json({ success: true, user_id, feature, enabled });
  }

  // Lookup guild by Discord guild ID
  if (action === "lookup_guild") {
    const { discord_guild_id } = body as { discord_guild_id: string };
    if (!discord_guild_id) return json({ error: "discord_guild_id required" }, 400);

    const { data, error } = await supabase
      .from("guilds")
      .select("id, guild_id, name")
      .eq("guild_id", discord_guild_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Guild not found" }, 404);

    return json({ guild: data });
  }

  return json({ error: "Unknown action. Use: toggle_guild_feature, bulk_toggle_guild_features, toggle_user_feature, lookup_guild" }, 400);
}
