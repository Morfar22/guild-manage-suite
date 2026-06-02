import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip",
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
      const token = simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
      if (token?.length > 20) {
        console.log(`JTC using custom bot token for guild ${guildId}`);
        return token;
      }
    } catch (e) {
      console.error("JTC failed to decrypt custom bot token, falling back to default:", e instanceof Error ? e.message : String(e));
    }
  }

  const globalToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!globalToken) throw new Error("Discord bot token not configured");
  return globalToken;
}

// Helper function to check if IP is whitelisted
async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { count } = await supabase.from("admin_ip_whitelist").select("*", { count: "exact", head: true });

  if ((count ?? 0) === 0) return { allowed: true, ip: clientIp };

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botSecretKey = Deno.env.get("BOT_SECRET_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify bot secret for bot-initiated requests
    const requestBotSecret = req.headers.get("x-bot-secret");
    const isBotRequest = requestBotSecret === botSecretKey;

    // Check IP whitelist for bot requests
    if (isBotRequest) {
      const ipCheck = await checkIPWhitelist(req, supabase);
      if (!ipCheck.allowed) {
        console.error(`IP not whitelisted: ${ipCheck.ip}`);
        return new Response(JSON.stringify({ error: "Forbidden - IP not whitelisted", ip: ipCheck.ip }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { action, guildId, discordGuildId, channelId, userId, userName, userRoles, triggerId } = await req.json();

    console.log(`JTC Handler - Action: ${action}, Guild: ${guildId || discordGuildId}`);

    // Get internal guild ID from discord guild ID if needed
    let internalGuildId = guildId;
    let discordGuildIdResolved = discordGuildId;
    if (discordGuildId && !guildId) {
      const { data: guild } = await supabase
        .from("guilds")
        .select("id, guild_id")
        .eq("guild_id", discordGuildId)
        .single();

      if (!guild) {
        return new Response(JSON.stringify({ error: "Guild not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      internalGuildId = guild.id;
      discordGuildIdResolved = guild.guild_id;
    }

    switch (action) {
      case "get_settings": {
        // Legacy support for jtc_settings
        const { data: settings } = await supabase
          .from("jtc_settings")
          .select("*")
          .eq("guild_id", internalGuildId)
          .single();

        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_triggers": {
        // Get all JTC triggers for a guild
        const { data: triggers } = await supabase
          .from("jtc_triggers")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("enabled", true)
          .order("created_at", { ascending: true });

        return new Response(JSON.stringify({ triggers: triggers || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_trigger": {
        // Bot calls this when user joins a voice channel
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check global JTC enabled status
        const { data: settings } = await supabase
          .from("jtc_settings")
          .select("enabled")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (settings && !settings.enabled) {
          return new Response(JSON.stringify({ shouldCreate: false, reason: "JTC disabled globally" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if this channel is a trigger in jtc_triggers
        const { data: trigger } = await supabase
          .from("jtc_triggers")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("trigger_channel_id", channelId)
          .eq("enabled", true)
          .maybeSingle();

        if (!trigger) {
          // Fallback: check legacy jtc_settings
          const { data: legacySettings } = await supabase
            .from("jtc_settings")
            .select("*")
            .eq("guild_id", internalGuildId)
            .single();

          if (!legacySettings || !legacySettings.enabled || legacySettings.trigger_channel_id !== channelId) {
            return new Response(JSON.stringify({ shouldCreate: false }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Legacy trigger matched
          return new Response(
            JSON.stringify({
              shouldCreate: true,
              trigger: {
                id: "legacy",
                trigger_channel_id: legacySettings.trigger_channel_id,
                category_id: legacySettings.category_id,
                channel_name_template: legacySettings.channel_name_template,
                default_user_limit: legacySettings.default_user_limit,
                required_role_id: null,
                required_role_name: null,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Check role requirement if set
        if (trigger.required_role_id) {
          const userRolesList = userRoles || [];
          console.log(
            `Role check - User: ${userId}, Required: ${trigger.required_role_id}, User roles: ${JSON.stringify(userRolesList)}, Has role: ${userRolesList.includes(trigger.required_role_id)}`,
          );

          // Ensure we're comparing strings to strings
          const requiredRoleStr = String(trigger.required_role_id);
          const hasRole = userRolesList.some((role: string | number) => String(role) === requiredRoleStr);

          if (!hasRole) {
            console.log(
              `User ${userId} doesn't have required role ${trigger.required_role_id} for trigger ${trigger.name}`,
            );
            return new Response(
              JSON.stringify({
                shouldCreate: false,
                reason: "missing_role",
                requiredRoleName: trigger.required_role_name,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        return new Response(
          JSON.stringify({
            shouldCreate: true,
            trigger,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "create_channel": {
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let triggerConfig = null;

        if (triggerId && triggerId !== "legacy") {
          const { data: trigger } = await supabase.from("jtc_triggers").select("*").eq("id", triggerId).single();

          triggerConfig = trigger;
        } else {
          const { data: trigger } = await supabase
            .from("jtc_triggers")
            .select("*")
            .eq("guild_id", internalGuildId)
            .eq("trigger_channel_id", channelId)
            .eq("enabled", true)
            .maybeSingle();

          if (trigger) {
            triggerConfig = trigger;
          } else {
            const { data: settings } = await supabase
              .from("jtc_settings")
              .select("*")
              .eq("guild_id", internalGuildId)
              .single();

            if (settings) {
              triggerConfig = {
                id: "legacy",
                category_id: settings.category_id,
                channel_name_template: settings.channel_name_template,
                default_user_limit: settings.default_user_limit,
              };
            }
          }
        }

        if (!triggerConfig) {
          return new Response(JSON.stringify({ error: "JTC trigger not found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const channelName = (triggerConfig.channel_name_template || "{username}s kanal").replace(
          "{username}",
          userName || "Bruger",
        );

        const { data: guildData } = await supabase.from("guilds").select("guild_id").eq("id", internalGuildId).single();
        const discordBotToken = await getBotTokenForGuild(supabase, internalGuildId);

        // Owner: manage channel + voice control
        // Owner perms incl. STREAM (0x200) so ejeren kan skærmdele
        const OWNER_ALLOW = "62931472";
        // Deny management perms for @everyone so normale brugere ikke kan kicke/mute/move/manage
        // MANAGE_CHANNELS(0x10) + PRIORITY_SPEAKER(0x100) + MUTE_MEMBERS(0x400000) +
        // DEAFEN_MEMBERS(0x800000) + MOVE_MEMBERS(0x1000000) + MANAGE_ROLES(0x10000000)
        const EVERYONE_DENY_MGMT = "297405200";

        const permissionOverwrites: Array<Record<string, unknown>> = [
          {
            id: userId,
            type: 1,
            allow: OWNER_ALLOW,
          },
        ];

        if (triggerConfig.required_role_id) {
          // Role-locked: deny VIEW+CONNECT + management perms for @everyone
          // 1049600 (VIEW+CONNECT) | 297405200 (mgmt) = 298454800
          permissionOverwrites.push({
            id: guildData!.guild_id,
            type: 0,
            deny: "298454800",
          });

          permissionOverwrites.push({
            id: triggerConfig.required_role_id,
            type: 0,
            allow: "3146752", // VIEW_CHANNEL + CONNECT + SPEAK only
          });

          console.log(`Role-locked channel for role ${triggerConfig.required_role_id}`);
        } else {
          // Open channel: alle må joine, men ingen management perms
          permissionOverwrites.push({
            id: guildData!.guild_id,
            type: 0,
            deny: EVERYONE_DENY_MGMT,
          });
        }

        const createPayload: Record<string, unknown> = {
          name: channelName,
          type: 2,
          user_limit: triggerConfig.default_user_limit || 0,
          permission_overwrites: permissionOverwrites,
        };

        if (triggerConfig.category_id) {
          createPayload.parent_id = triggerConfig.category_id;
        }

        console.log("Creating channel payload:", JSON.stringify(createPayload));

        const discordResponse = await fetch(`https://discord.com/api/v10/guilds/${guildData!.guild_id}/channels`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createPayload),
        });

        const discordBody = await discordResponse.text();

        if (!discordResponse.ok) {
          console.error("Discord create channel failed:", {
            status: discordResponse.status,
            body: discordBody,
            payload: createPayload,
          });

          return new Response(
            JSON.stringify({
              error: `Discord API ${discordResponse.status}`,
              details: discordBody,
            }),
            {
              status: discordResponse.status,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }

        const newChannel = JSON.parse(discordBody);

        console.log(`Created channel ${newChannel.id} for ${userId}`);

        await supabase.from("jtc_channels").insert({
          guild_id: internalGuildId,
          channel_id: newChannel.id,
          owner_id: userId,
          owner_name: userName,
          ...(triggerConfig.id !== "legacy" ? { trigger_id: triggerConfig.id } : {}),
        });

        const moveResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guildData!.guild_id}/members/${userId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${discordBotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel_id: newChannel.id,
            }),
          },
        );

        if (!moveResponse.ok) {
          console.error("Failed moving user:", await moveResponse.text());
        }

        // Send control panel message in the voice channel's text chat
        try {
          const cid = newChannel.id;
          const panelPayload = {
            embeds: [
              {
                title: "🎛️ Kanal Kontrolpanel",
                description: `Velkommen <@${userId}>! Du er ejer af denne kanal.\nBrug knapperne nedenfor til at styre din kanal.`,
                color: 0x5865f2,
                fields: [
                  { name: "🔒 Lås", value: "Bloker nye brugere", inline: true },
                  { name: "👁️ Skjul", value: "Skjul kanalen", inline: true },
                  { name: "✏️ Omdøb", value: "Skift navn", inline: true },
                  { name: "👥 Limit", value: "Sæt bruger-grænse", inline: true },
                  { name: "👢 Kick", value: "Smid bruger ud", inline: true },
                  { name: "⛔ Block", value: "Bloker bruger", inline: true },
                ],
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, label: "Lås", emoji: { name: "🔒" }, custom_id: `jtc_lock_${cid}` },
                  { type: 2, style: 2, label: "Skjul", emoji: { name: "👁️" }, custom_id: `jtc_hide_${cid}` },
                  { type: 2, style: 1, label: "Omdøb", emoji: { name: "✏️" }, custom_id: `jtc_rename_${cid}` },
                  { type: 2, style: 1, label: "Limit", emoji: { name: "👥" }, custom_id: `jtc_limit_${cid}` },
                ],
              },
              {
                type: 1,
                components: [
                  { type: 2, style: 4, label: "Kick", emoji: { name: "👢" }, custom_id: `jtc_kick_${cid}` },
                  { type: 2, style: 4, label: "Block", emoji: { name: "⛔" }, custom_id: `jtc_block_${cid}` },
                  { type: 2, style: 3, label: "Allow", emoji: { name: "✅" }, custom_id: `jtc_allow_${cid}` },
                  { type: 2, style: 2, label: "Stream", emoji: { name: "📺" }, custom_id: `jtc_stream_${cid}` },
                ],
              },
            ],
          };

          const panelRes = await fetch(`https://discord.com/api/v10/channels/${cid}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${discordBotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(panelPayload),
          });

          if (!panelRes.ok) {
            console.error("Failed to send JTC control panel:", panelRes.status, await panelRes.text());
          } else {
            console.log(`Sent JTC control panel in channel ${cid}`);
          }
        } catch (panelErr) {
          console.error("JTC control panel error:", panelErr instanceof Error ? panelErr.message : String(panelErr));
        }

        return new Response(
          JSON.stringify({
            success: true,
            channelId: newChannel.id,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      case "check_empty": {
        // Bot calls this when user leaves a voice channel to check if it should be deleted
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: jtcChannel } = await supabase
          .from("jtc_channels")
          .select("*")
          .eq("channel_id", channelId)
          .single();

        if (!jtcChannel) {
          return new Response(JSON.stringify({ shouldDelete: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            shouldDelete: true,
            jtcChannel,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      case "delete_channel": {
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: jtcChannel } = await supabase
          .from("jtc_channels")
          .select("guild_id")
          .eq("channel_id", channelId)
          .maybeSingle();
        const discordBotToken = await getBotTokenForGuild(supabase, jtcChannel?.guild_id || internalGuildId);

        // Delete voice channel from Discord
        await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
          },
        });

        // Remove from database
        await supabase.from("jtc_channels").delete().eq("channel_id", channelId);

        console.log(`Deleted JTC channel: ${channelId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_active_channels": {
        const { data: channels } = await supabase
          .from("jtc_channels")
          .select("*, trigger:trigger_id(name)")
          .eq("guild_id", internalGuildId)
          .order("created_at", { ascending: false });

        if (!channels || channels.length === 0) {
          return new Response(JSON.stringify({ channels: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get guild discord ID for API calls
        const { data: guildData } = await supabase.from("guilds").select("guild_id").eq("id", internalGuildId).single();

        const discordBotToken = await getBotTokenForGuild(supabase, internalGuildId);

        // Fetch channel info from Discord for each active channel
        const enrichedChannels = await Promise.all(
          channels.map(async (channel) => {
            try {
              const channelResponse = await fetch(`https://discord.com/api/v10/channels/${channel.channel_id}`, {
                headers: {
                  Authorization: `Bot ${discordBotToken}`,
                },
              });

              if (channelResponse.ok) {
                const discordChannel = await channelResponse.json();
                return {
                  ...channel,
                  channel_name: discordChannel.name,
                  member_count: discordChannel.member_count || 0,
                  trigger_name: channel.trigger?.name || null,
                };
              }
            } catch (err) {
              console.error(`Failed to fetch channel info for ${channel.channel_id}:`, err);
            }
            return {
              ...channel,
              channel_name: null,
              member_count: 0,
              trigger_name: channel.trigger?.name || null,
            };
          }),
        );

        return new Response(JSON.stringify({ channels: enrichedChannels }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "force_delete_channel": {
        // Dashboard user wants to force delete a channel
        const discordBotToken = await getBotTokenForGuild(supabase, internalGuildId);

        const deleteResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
          },
        });

        // Even if Discord delete fails (channel might already be gone), remove from DB
        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          console.error("Failed to delete channel from Discord:", await deleteResponse.text());
        }

        // Remove from database
        await supabase.from("jtc_channels").delete().eq("channel_id", channelId);

        console.log(`Force deleted JTC channel: ${channelId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("JTC Handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
