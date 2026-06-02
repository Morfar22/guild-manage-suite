import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") || 
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
    req.headers.get("x-real-ip") || 
    "unknown";

  const { count, error: countError } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error checking whitelist count:", countError);
    return { allowed: false, ip: clientIp };
  }

  if ((count ?? 0) === 0) {
    return { allowed: true, ip: clientIp };
  }

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify bot secret
  const botSecret = req.headers.get("x-bot-secret");
  if (botSecret !== Deno.env.get("BOT_SECRET_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check IP whitelist
  const ipCheck = await checkIPWhitelist(req, supabase);
  if (!ipCheck.allowed) {
    console.error(`IP not whitelisted: ${ipCheck.ip}`);
    return new Response(
      JSON.stringify({ error: "Forbidden - IP not whitelisted", ip: ipCheck.ip }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case "create": {
        const { guildId, discordUserId, discordUsername, name, age, background, faction, occupation, appearance } = data;

        // Get internal guild ID
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deactivate other characters for this user
        await supabase
          .from("characters")
          .update({ is_active: false })
          .eq("guild_id", guild.id)
          .eq("discord_user_id", discordUserId);

        // Create new character
        const { data: character, error } = await supabase
          .from("characters")
          .insert({
            guild_id: guild.id,
            discord_user_id: discordUserId,
            discord_username: discordUsername,
            name,
            age: age ? parseInt(age) : null,
            background,
            faction,
            occupation,
            appearance,
            status: "alive",
            is_active: true,
          })
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ character }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get": {
        const { guildId, discordUserId } = data;

        // Get internal guild ID
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ character: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: character } = await supabase
          .from("characters")
          .select("*")
          .eq("guild_id", guild.id)
          .eq("discord_user_id", discordUserId)
          .eq("is_active", true)
          .maybeSingle();
        
        return new Response(JSON.stringify({ character }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const { guildId, discordUserId } = data;

        // Get internal guild ID
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ characters: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: characters } = await supabase
          .from("characters")
          .select("*")
          .eq("guild_id", guild.id)
          .eq("discord_user_id", discordUserId)
          .order("created_at", { ascending: false });
        
        return new Response(JSON.stringify({ characters: characters || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { characterId, updates } = data;

        const { data: character, error } = await supabase
          .from("characters")
          .update(updates)
          .eq("id", characterId)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ character }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kill": {
        const { characterId } = data;

        const { data: character, error } = await supabase
          .from("characters")
          .update({ status: "dead", is_active: false })
          .eq("id", characterId)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ character }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "retire": {
        const { characterId } = data;

        const { data: character, error } = await supabase
          .from("characters")
          .update({ status: "retired", is_active: false })
          .eq("id", characterId)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ character }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
