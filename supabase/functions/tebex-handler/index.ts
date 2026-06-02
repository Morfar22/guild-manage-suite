import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const guildId = url.searchParams.get("guild_id");
    if (!guildId) {
      return jsonResponse({ error: "guild_id required" }, 400);
    }

    if (req.method === "GET") {
      return handleGet(supabase, url, guildId);
    }

    if (req.method === "POST") {
      return handlePost(supabase, req, guildId);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("Tebex handler error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGet(supabase: ReturnType<typeof createClient>, url: URL, guildId: string) {
  const action = url.searchParams.get("action");

  if (action === "settings") {
    const { data, error } = await supabase
      .from("tebex_settings")
      .select("id, guild_id, enabled, notification_channel_id, created_at, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle();
    if (error) throw error;
    return jsonResponse({ settings: data });
  }

  if (action === "lookup_payment") {
    const txnId = url.searchParams.get("txn_id");
    if (!txnId) return jsonResponse({ error: "txn_id required" }, 400);
    const secret = await getTebexSecret(supabase, guildId);
    if (!secret) return jsonResponse({ error: "Tebex er ikke konfigureret for denne server" }, 400);

    const tebexRes = await fetch(`https://plugin.tebex.io/payments/${encodeURIComponent(txnId)}`, {
      headers: { "X-Tebex-Secret": secret },
    });
    if (!tebexRes.ok) {
      const errText = await tebexRes.text();
      return jsonResponse({ error: `Tebex API fejl: ${tebexRes.status}`, details: errText }, tebexRes.status);
    }
    return jsonResponse({ payment: await tebexRes.json() });
  }

  if (action === "lookup_player") {
    const playerId = url.searchParams.get("player_id");
    if (!playerId) return jsonResponse({ error: "player_id required" }, 400);
    const secret = await getTebexSecret(supabase, guildId);
    if (!secret) return jsonResponse({ error: "Tebex er ikke konfigureret for denne server" }, 400);

    const tebexRes = await fetch(`https://plugin.tebex.io/user/${encodeURIComponent(playerId)}`, {
      headers: { "X-Tebex-Secret": secret },
    });
    if (!tebexRes.ok) {
      const errText = await tebexRes.text();
      return jsonResponse({ error: `Tebex API fejl: ${tebexRes.status}`, details: errText }, tebexRes.status);
    }
    const player = await tebexRes.json();

    const pkgRes = await fetch(`https://plugin.tebex.io/player/${encodeURIComponent(playerId)}/packages`, {
      headers: { "X-Tebex-Secret": secret },
    });
    const packages = pkgRes.ok ? await pkgRes.json() : [];
    return jsonResponse({ player, packages });
  }

  if (action === "recent_payments") {
    const secret = await getTebexSecret(supabase, guildId);
    if (!secret) return jsonResponse({ error: "Tebex er ikke konfigureret" }, 400);

    const tebexRes = await fetch("https://plugin.tebex.io/payments?limit=25", {
      headers: { "X-Tebex-Secret": secret },
    });
    if (!tebexRes.ok) return jsonResponse({ error: `Tebex API fejl: ${tebexRes.status}` }, tebexRes.status);
    return jsonResponse({ payments: await tebexRes.json() });
  }

  if (action === "packages") {
    const secret = await getTebexSecret(supabase, guildId);
    if (!secret) return jsonResponse({ error: "Tebex er ikke konfigureret" }, 400);

    const tebexRes = await fetch("https://plugin.tebex.io/listing", {
      headers: { "X-Tebex-Secret": secret },
    });
    if (!tebexRes.ok) return jsonResponse({ error: `Tebex API fejl: ${tebexRes.status}` }, tebexRes.status);
    return jsonResponse({ listing: await tebexRes.json() });
  }

  if (action === "stats") {
    // Get stored purchase stats from our database
    const { data: purchases, error } = await supabase
      .from("tebex_purchases")
      .select("amount, currency, event_type, packages, created_at")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Calculate stats
    const totalRevenue = (purchases || [])
      .filter(p => p.event_type === "payment.completed")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const refunds = (purchases || [])
      .filter(p => p.event_type === "payment.refunded" || p.event_type === "payment.chargeback")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalOrders = (purchases || []).filter(p => p.event_type === "payment.completed").length;

    // Daily revenue for chart (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyRevenue: Record<string, number> = {};
    (purchases || [])
      .filter(p => p.event_type === "payment.completed" && new Date(p.created_at) >= thirtyDaysAgo)
      .forEach(p => {
        const day = new Date(p.created_at).toISOString().split("T")[0];
        dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(p.amount || 0);
      });

    // Top packages
    const packageCounts: Record<string, { name: string; count: number; revenue: number }> = {};
    (purchases || [])
      .filter(p => p.event_type === "payment.completed")
      .forEach(p => {
        const pkgs = (p.packages as Array<Record<string, unknown>>) || [];
        pkgs.forEach(pkg => {
          const name = String(pkg.name || "Ukendt");
          if (!packageCounts[name]) packageCounts[name] = { name, count: 0, revenue: 0 };
          packageCounts[name].count += 1;
          packageCounts[name].revenue += Number(p.amount || 0);
        });
      });

    const topPackages = Object.values(packageCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return jsonResponse({
      stats: {
        totalRevenue,
        refunds,
        netRevenue: totalRevenue - refunds,
        totalOrders,
        dailyRevenue,
        topPackages,
        currency: purchases?.[0]?.currency || "DKK",
      },
    });
  }

  if (action === "role_mappings") {
    const { data, error } = await supabase
      .from("tebex_role_mappings")
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return jsonResponse({ mappings: data || [] });
  }

  if (action === "purchase_history") {
    const { data, error } = await supabase
      .from("tebex_purchases")
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return jsonResponse({ purchases: data || [] });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
}

async function handlePost(supabase: ReturnType<typeof createClient>, req: Request, guildId: string) {
  const body = await req.json();
  const { action } = body;

  if (action === "save_settings") {
    const { enabled, tebex_secret, notification_channel_id } = body;

    const updateData: Record<string, unknown> = { enabled };
    if (tebex_secret !== undefined && tebex_secret !== "") {
      updateData.tebex_secret_encrypted = tebex_secret;
    }
    if (notification_channel_id !== undefined) {
      updateData.notification_channel_id = notification_channel_id;
    }

    const { data: existing } = await supabase
      .from("tebex_settings")
      .select("id")
      .eq("guild_id", guildId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("tebex_settings").update(updateData).eq("guild_id", guildId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("tebex_settings").insert({ guild_id: guildId, ...updateData });
      if (error) throw error;
    }

    return jsonResponse({ success: true });
  }

  if (action === "save_role_mapping") {
    const { tebex_package_id, tebex_package_name, discord_role_id, discord_role_name } = body;
    
    const { error } = await supabase.from("tebex_role_mappings").upsert(
      {
        guild_id: guildId,
        tebex_package_id,
        tebex_package_name,
        discord_role_id,
        discord_role_name,
      },
      { onConflict: "guild_id,tebex_package_id" }
    );
    if (error) throw error;
    return jsonResponse({ success: true });
  }

  if (action === "delete_role_mapping") {
    const { id } = body;
    const { error } = await supabase
      .from("tebex_role_mappings")
      .delete()
      .eq("id", id)
      .eq("guild_id", guildId);
    if (error) throw error;
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
}

async function getTebexSecret(supabase: ReturnType<typeof createClient>, guildId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("tebex_settings")
    .select("tebex_secret_encrypted, enabled")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error || !data || !data.enabled || !data.tebex_secret_encrypted) return null;
  return data.tebex_secret_encrypted;
}
