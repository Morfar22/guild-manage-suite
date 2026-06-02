import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const discordBotToken = Deno.env.get("DISCORD_BOT_TOKEN");

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

    const { guild_id, command, data } = await req.json();

    if (!guild_id || !command) {
      return new Response(JSON.stringify({ error: "guild_id and command are required" }), {
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

    // Get guild info
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .select("guild_id")
      .eq("id", guild_id)
      .single();

    if (guildError || !guild) {
      return new Response(JSON.stringify({ error: "Guild not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moderatorName = data.moderatorName || "Dashboard";
    const moderatorDiscordId = data.moderatorDiscordId || "dashboard";

    // Queue the command for the FiveM server to pick up (return inserted row id)
    const { data: queuedRow, error: queueError } = await supabase
      .from("fivem_command_queue")
      .insert({
        guild_id,
        command_name: command,
        command_data: data,
        target_player_id: data.targetPlayerId || null,
        target_discord_id: data.targetDiscordId || null,
        target_name: data.targetName || null,
        moderator_discord_id: moderatorDiscordId,
        moderator_name: moderatorName,
        status: "pending",
      })
      .select("id")
      .single();

    if (queueError || !queuedRow?.id) {
      console.error("Error queuing command:", queueError);
      return new Response(JSON.stringify({ error: "Failed to queue command" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also log the action for history
    await supabase.from("fivem_action_logs").insert({
      guild_id,
      action_type: command,
      target_discord_id: data.targetDiscordId || null,
      target_name: data.targetName || null,
      moderator_discord_id: moderatorDiscordId,
      moderator_name: moderatorName,
      reason: data.reason || null,
      duration_seconds: data.duration ? parseDuration(String(data.duration)) : null,
      metadata: data,
    });

    // Get FiveM settings for optional Discord notification
    const { data: settings } = await supabase
      .from("fivem_settings")
      .select("log_channel_id, staff_chat_channel_id, announcement_channel_id")
      .eq("guild_id", guild_id)
      .single();

    // Send Discord notification for certain commands
    if (discordBotToken && settings?.log_channel_id) {
      const logChannel = settings.log_channel_id;
      const actionColors: Record<string, number> = {
        kick: 0xFFA500,
        ban: 0xFF0000,
        kill: 0xFF4444,
        revive: 0x00FF00,
        announcement: 0x5865F2,
        weather: 0x00BFFF,
        time: 0x00BFFF,
      };

      if (["kick", "ban", "kill", "revive"].includes(command)) {
        await fetch(`https://discord.com/api/v10/channels/${logChannel}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [{
              title: `🎮 FiveM ${command.charAt(0).toUpperCase() + command.slice(1)} (Queued)`,
              description: `**Target:** ${data.targetName || data.targetDiscordId || 'Player #' + data.targetPlayerId}\n**Moderator:** ${moderatorName}${data.reason ? '\n**Reason:** ' + data.reason : ''}\n\n*Awaiting execution on FiveM server...*`,
              color: actionColors[command] || 0x5865F2,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        command,
        commandId: queuedRow.id,
        message: `Command '${command}' queued for execution`,
        status: "queued"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  
  return value * (multipliers[unit] || 0);
}
