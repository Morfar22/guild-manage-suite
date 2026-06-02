import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotTokenForGuild(supabase: any, guildId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("guild_bot_settings")
    .select("is_custom_bot, is_active, bot_token_encrypted")
    .eq("guild_id", guildId)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  const encryptionKey = Deno.env.get("BOT_SECRET_KEY") || "default-encryption-key";

  if (settings?.bot_token_encrypted) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
    } catch (e) {
      console.error("Failed to decrypt custom bot token, falling back to global:", e instanceof Error ? e.message : String(e));
    }
  }

  const globalToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!globalToken) throw new Error("Discord bot token not configured");
  return globalToken;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { guild_id } = await req.json();

    if (!guild_id) {
      return new Response(JSON.stringify({ error: "guild_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has admin permission for this guild
    const { data: userGuild, error: permError } = await supabase
      .from("user_guilds")
      .select("has_admin_permission")
      .eq("user_id", user.id)
      .eq("guild_id", guild_id)
      .single();

    if (permError || !userGuild?.has_admin_permission) {
      return new Response(JSON.stringify({ error: "No permission for this guild" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket settings
    const { data: settings, error: settingsError } = await supabase
      .from("ticket_settings")
      .select("*")
      .eq("guild_id", guild_id)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Ticket settings not found. Please save settings first." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.panel_channel_id) {
      return new Response(JSON.stringify({ error: "Panel channel not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket categories for this guild
    const { data: categories, error: catError } = await supabase
      .from("ticket_categories")
      .select("*")
      .eq("guild_id", guild_id)
      .order("name");

    if (catError) {
      console.error("Failed to fetch categories:", catError);
    }

    // Get guild info for the embed
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .select("guild_name, guild_icon, guild_id")
      .eq("id", guild_id)
      .single();

    if (guildError || !guild) {
      return new Response(JSON.stringify({ error: "Guild not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = await getBotTokenForGuild(supabase, guild_id);

    // Build the Discord embed
    const embed = {
      title: "🎫 Support Tickets",
      description: "Select a category from the dropdown menu below to create a ticket.\n\nChoose the category that best fits your inquiry.",
      color: 0x5865F2, // Discord blurple
      footer: {
        text: guild.guild_name,
        icon_url: guild.guild_icon 
          ? `https://cdn.discordapp.com/icons/${guild.guild_id}/${guild.guild_icon}.png`
          : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // Build select menu from categories
    const components: any[] = [];
    const cats = categories || [];
    
    if (cats.length === 0) {
      // Default button if no categories
      components.push({
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 1, // Primary
            label: "Create Ticket",
            emoji: { name: "🎫" },
            custom_id: "ticket_create_default",
          },
        ],
      });
    } else {
      // Create select menu with categories as options (max 25 options)
      const selectOptions = cats.slice(0, 25).map((cat: any) => ({
        label: cat.name.substring(0, 100),
        description: cat.description ? cat.description.substring(0, 100) : undefined,
        value: cat.id,
        emoji: cat.emoji ? { name: cat.emoji } : undefined,
      }));

      components.push({
        type: 1, // Action Row
        components: [
          {
            type: 3, // Select Menu
            custom_id: "ticket_category_select",
            placeholder: "🎫 Select a ticket category...",
            min_values: 1,
            max_values: 1,
            options: selectOptions,
          },
        ],
      });
    }

    const messagePayload = {
      embeds: [embed],
      components,
    };

    console.log("Sending panel to channel:", settings.panel_channel_id);
    console.log("Message payload:", JSON.stringify(messagePayload, null, 2));

    let discordResponse: Response;
    let messageId: string | null = null;

    // Check if we should edit existing message or create new
    if (settings.panel_message_id) {
      // Try to edit existing message
      discordResponse = await fetch(
        `https://discord.com/api/v10/channels/${settings.panel_channel_id}/messages/${settings.panel_message_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      );

      if (discordResponse.ok) {
        const data = await discordResponse.json();
        messageId = data.id;
        console.log("Successfully edited existing panel message:", messageId);
      } else {
        console.log("Failed to edit existing message, will create new one");
        // Message might be deleted, create a new one
        settings.panel_message_id = null;
      }
    }

    // Create new message if no existing or edit failed
    if (!settings.panel_message_id) {
      discordResponse = await fetch(
        `https://discord.com/api/v10/channels/${settings.panel_channel_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      );

      if (!discordResponse.ok) {
        const errorText = await discordResponse.text();
        console.error("Discord API error:", discordResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: "Failed to send message to Discord", 
            details: errorText,
            status: discordResponse.status 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await discordResponse.json();
      messageId = data.id;
      console.log("Successfully created new panel message:", messageId);
    }

    // Update the panel_message_id in database
    if (messageId) {
      const { error: updateError } = await supabase
        .from("ticket_settings")
        .update({ panel_message_id: messageId })
        .eq("guild_id", guild_id);

      if (updateError) {
        console.error("Failed to update panel_message_id:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Panel sent to Discord successfully",
        message_id: messageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
