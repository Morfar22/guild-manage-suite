import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip",
};

function simpleDecrypt(encoded: string, key: string): string {
  try {
    const text = atob(encoded);
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
    }
    return result;
  } catch (e) {
    console.error("Failed to decrypt bot token:", e);
    return "";
  }
}

async function getBotToken(supabase: any, guildId: string): Promise<string> {
  const encryptionKey = Deno.env.get("BOT_SECRET_KEY") || "";
  
  const { data: guild } = await supabase
    .from("guilds")
    .select("guild_id")
    .eq("id", guildId)
    .single();
  
  if (guild) {
    const { data: customBotSettings } = await supabase
      .from("guild_bot_settings")
      .select("bot_token_encrypted, is_custom_bot, is_active")
      .eq("guild_id", guildId)
      .eq("is_custom_bot", true)
      .eq("is_active", true)
      .maybeSingle();
    
    if (customBotSettings?.bot_token_encrypted && encryptionKey) {
      const decryptedToken = simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
      if (decryptedToken) {
        console.log(`Using custom bot token for guild ${guildId}`);
        return decryptedToken;
      }
    }
  }
  
  console.log(`Using default bot token for guild ${guildId}`);
  return Deno.env.get("DISCORD_BOT_TOKEN") || "";
}

async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { count } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) === 0) return { allowed: true, ip: clientIp };

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

// Build welcome embed from settings
function buildWelcomeEmbed(settings: any, username: string, userId: string, avatarUrl: string, memberCount: number | string, guildName: string, serverIconUrl?: string, isTest = false, inviterInfo?: { username: string | null; discord_id: string | null; total: number } | null) {
  const formatMsg = (msg: string) => msg
    .replace(/{user}/g, isTest ? `@${username}` : `<@${userId}>`)
    .replace(/{username}/g, username)
    .replace(/{server}/g, guildName)
    .replace(/{membercount}/g, String(memberCount || '?'))
    .replace(/{inviter}/g, inviterInfo?.discord_id ? `<@${inviterInfo.discord_id}>` : (inviterInfo?.username || 'Ukendt'))
    .replace(/{invitercount}/g, String(inviterInfo?.total ?? 0));

  const message = formatMsg(settings.welcome_message || 'Welcome!');
  const title = formatMsg(settings.embed_title || '🎉 A new member has arrived!');
  const footerText = settings.embed_footer 
    ? formatMsg(settings.embed_footer) 
    : `${guildName} • We're glad to have you here!`;

  const fields: any[] = [
    {
      name: "👤 User",
      value: isTest ? `@${username}` : `<@${userId}>`,
      inline: true,
    },
    {
      name: "📊 Member #",
      value: `${memberCount || '?'}`,
      inline: true,
    },
    {
      name: "📅 Joined",
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true,
    },
  ];

  // Add inviter field if available
  if (inviterInfo) {
    const inviterDisplay = inviterInfo.discord_id
      ? (isTest ? `@${inviterInfo.username || 'Inviter'}` : `<@${inviterInfo.discord_id}>`)
      : (inviterInfo.username || 'Ukendt');
    fields.push({
      name: "🎟️ Inviteret af",
      value: `${inviterDisplay}\n*(${inviterInfo.total} ${inviterInfo.total === 1 ? 'invite' : 'invites'} total)*`,
      inline: false,
    });
  }

  const embed: any = {
    author: {
      name: `Welcome, ${username}!`,
      icon_url: avatarUrl,
    },
    title: isTest ? `🧪 TEST - ${title}` : title,
    description: message,
    color: parseInt(settings.embed_color?.replace('#', '') || '5865F2', 16),
    thumbnail: settings.thumbnail_type === 'server_icon' && serverIconUrl
      ? { url: serverIconUrl }
      : (avatarUrl ? { url: avatarUrl } : undefined),
    fields,
    footer: {
      text: isTest ? `${footerText} • 🧪 TEST` : footerText,
    },
    timestamp: new Date().toISOString(),
  };

  // Add banner image if configured
  if (settings.embed_image_url) {
    embed.image = { url: settings.embed_image_url };
  }

  return embed;
}

// Build leave embed
function buildLeaveEmbed(settings: any, username: string, guildName: string, isTest = false) {
  const formatMsg = (msg: string) => msg
    .replace(/{user}/g, username)
    .replace(/{username}/g, username)
    .replace(/{server}/g, guildName);

  const message = formatMsg(settings.leave_message || '{user} has left the server.');

  return {
    title: "👋 Et medlem har forladt os",
    description: message,
    color: 0xED4245,
    footer: { text: guildName },
    timestamp: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, data } = await req.json();

    const dashboardActions = ["testWelcome", "testLeave"];
    
    if (dashboardActions.includes(action)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authError } = await supabase.auth.getUser(token);
      if (authError || !claims?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const botSecret = req.headers.get("x-bot-secret");
      if (botSecret !== Deno.env.get("BOT_SECRET_KEY")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ipCheck = await checkIPWhitelist(req, supabase);
      if (!ipCheck.allowed) {
        console.error(`IP not whitelisted: ${ipCheck.ip}`);
        return new Response(JSON.stringify({ error: "Forbidden - IP not whitelisted", ip: ipCheck.ip }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {
      case "getSettings": {
        const { guildId } = data;
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ settings: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabase
          .from("welcome_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();
        
        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sendWelcome": {
        const { guildId, userId, username, avatarUrl, memberCount, serverIconUrl } = data;

        const { data: guild } = await supabase
          .from("guilds")
          .select("id, guild_name")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabase
          .from("welcome_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (!settings) {
          return new Response(JSON.stringify({ success: false, reason: "no_settings" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const welcomeMessageEnabled = settings.enabled === true;

        // Look up inviter info from latest invite_uses for this joined user
        let inviterInfo: { username: string | null; discord_id: string | null; total: number } | null = null;
        try {
          const { data: latestUse } = await supabase
            .from("invite_uses")
            .select("inviter_discord_id, inviter_username")
            .eq("guild_id", guild.id)
            .eq("joined_user_id", userId)
            .order("joined_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestUse?.inviter_discord_id) {
            const { data: allInvites } = await supabase
              .from("invite_uses")
              .select("id", { count: "exact", head: false })
              .eq("guild_id", guild.id)
              .eq("inviter_discord_id", latestUse.inviter_discord_id)
              .eq("has_left", false)
              .eq("is_fake", false);
            inviterInfo = {
              discord_id: latestUse.inviter_discord_id,
              username: latestUse.inviter_username,
              total: allInvites?.length ?? 0,
            };
          } else if (latestUse) {
            inviterInfo = { discord_id: null, username: latestUse.inviter_username || 'Ukendt', total: 0 };
          }
        } catch (e) {
          console.error("Inviter lookup failed:", e);
        }

        const formatMessage = (msg: string) => msg
          .replace(/{user}/g, `<@${userId}>`)
          .replace(/{username}/g, username)
          .replace(/{server}/g, guild.guild_name)
          .replace(/{membercount}/g, memberCount?.toString() || "?")
          .replace(/{inviter}/g, inviterInfo?.discord_id ? `<@${inviterInfo.discord_id}>` : (inviterInfo?.username || 'Ukendt'))
          .replace(/{invitercount}/g, String(inviterInfo?.total ?? 0));

        const botToken = await getBotToken(supabase, guild.id);

        // Send welcome message to channel
        if (welcomeMessageEnabled && settings.welcome_channel_id) {
          const payload: any = settings.embed_enabled
            ? { embeds: [buildWelcomeEmbed(settings, username, userId, avatarUrl, memberCount, guild.guild_name, serverIconUrl, false, inviterInfo)] }
            : { content: formatMessage(settings.welcome_message) };

          const res = await fetch(
            `https://discord.com/api/v10/channels/${settings.welcome_channel_id}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );
          
          if (!res.ok) {
            const errorText = await res.text();
            console.error("Discord API error (welcome):", res.status, errorText);
          } else {
            console.log(`✅ Welcome message sent for ${username} in guild ${guildId}`);
          }
        }

        // Send DM if enabled
        if (welcomeMessageEnabled && settings.dm_enabled && settings.dm_message) {
          try {
            const dmChannelRes = await fetch(
              `https://discord.com/api/v10/users/@me/channels`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ recipient_id: userId }),
              }
            );
            const dmChannel = await dmChannelRes.json();

            if (dmChannel.id) {
              const dmMessage = formatMessage(settings.dm_message);
              await fetch(
                `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bot ${botToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ content: dmMessage }),
                }
              );
            }
          } catch (e) {
            console.error("Failed to send DM:", e);
          }
        }

        // Assign auto roles if enabled
        if (settings.auto_role_enabled) {
          const roleIds: string[] = [];
          if (settings.auto_role_ids && Array.isArray(settings.auto_role_ids) && settings.auto_role_ids.length > 0) {
            roleIds.push(...settings.auto_role_ids);
          } else if (settings.auto_role_id) {
            roleIds.push(settings.auto_role_id);
          }

          console.log(`[AutoRole] Assigning ${roleIds.length} role(s) to ${userId} in guild ${guildId}: ${JSON.stringify(roleIds)}`);

          for (const roleId of roleIds) {
            if (!roleId) continue;
            try {
              const roleRes = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bot ${botToken}`,
                    "Content-Length": "0",
                    "X-Audit-Log-Reason": "Auto-role on welcome",
                  },
                }
              );
              if (!roleRes.ok) {
                const errText = await roleRes.text();
                console.error(`[AutoRole] Failed role ${roleId} for ${userId}: ${roleRes.status} ${errText}`);
              } else {
                console.log(`[AutoRole] ✅ Assigned role ${roleId} to ${userId}`);
              }
            } catch (e) {
              console.error(`[AutoRole] Exception assigning role ${roleId}:`, e);
            }
          }
        } else {
          console.log(`[AutoRole] auto_role_enabled=false for guild ${guildId}, skipping`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "testWelcome": {
        const { guildId, username, avatarUrl } = data;

        const { data: guild } = await supabase
          .from("guilds")
          .select("id, guild_id, guild_name")
          .eq("id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabase
          .from("welcome_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (!settings) {
          return new Response(JSON.stringify({ error: "Welcome settings not configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!settings.welcome_channel_id) {
          return new Response(JSON.stringify({ error: "No welcome channel configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const botToken = await getBotToken(supabase, guild.id);
        const testUsername = username || "TestUser";
        const testAvatar = avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";

        const testInviter = { discord_id: '987654321', username: 'TestInviter', total: 7 };
        const payload: any = settings.embed_enabled
          ? { embeds: [buildWelcomeEmbed(settings, testUsername, "123456789", testAvatar, 42, guild.guild_name, undefined, true, testInviter)] }
          : { content: `🧪 **TEST** - ${(settings.welcome_message || "Welcome!").replace(/{user}/g, `@${testUsername}`).replace(/{username}/g, testUsername).replace(/{server}/g, guild.guild_name).replace(/{membercount}/g, "42").replace(/{inviter}/g, `@${testInviter.username}`).replace(/{invitercount}/g, String(testInviter.total))}` };

        const res = await fetch(
          `https://discord.com/api/v10/channels/${settings.welcome_channel_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Discord API error (test welcome):", res.status, errorText);
          return new Response(JSON.stringify({ error: `Discord API error: ${errorText}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`🧪 Test welcome message sent in guild ${guildId}`);
        
        return new Response(JSON.stringify({ success: true, message: "Test message sent!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "testLeave": {
        const { guildId, username } = data;

        const { data: guild } = await supabase
          .from("guilds")
          .select("id, guild_id, guild_name")
          .eq("id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabase
          .from("welcome_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (!settings) {
          return new Response(JSON.stringify({ error: "Welcome settings not configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const channelId = settings.leave_channel_id || settings.welcome_channel_id;
        if (!channelId) {
          return new Response(JSON.stringify({ error: "No leave channel configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const botToken = await getBotToken(supabase, guild.id);
        const testUsername = username || "TestUser";

        const payload: any = settings.leave_embed_enabled
          ? { embeds: [buildLeaveEmbed(settings, testUsername, guild.guild_name, true)] }
          : { content: `🧪 **TEST** - ${(settings.leave_message || "{user} has left the server.").replace(/{user}/g, testUsername).replace(/{username}/g, testUsername).replace(/{server}/g, guild.guild_name)}` };

        const res = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Discord API error (test leave):", res.status, errorText);
          return new Response(JSON.stringify({ error: `Discord API error: ${errorText}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`🧪 Test leave message sent in guild ${guildId}`);
        
        return new Response(JSON.stringify({ success: true, message: "Test leave message sent!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sendLeave": {
        const { guildId, userId, username } = data;

        const { data: guild } = await supabase
          .from("guilds")
          .select("id, guild_name")
          .eq("guild_id", guildId)
          .single();
        
        if (!guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: settings } = await supabase
          .from("welcome_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (!settings || !settings.leave_enabled) {
          return new Response(JSON.stringify({ success: false, reason: "disabled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const channelId = settings.leave_channel_id || settings.welcome_channel_id;
        if (!channelId) {
          return new Response(JSON.stringify({ success: false, reason: "no_channel" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const botToken = await getBotToken(supabase, guild.id);

        const payload: any = settings.leave_embed_enabled
          ? { embeds: [buildLeaveEmbed(settings, username, guild.guild_name)] }
          : { content: (settings.leave_message || "{user} has left the server.").replace(/{user}/g, username).replace(/{username}/g, username).replace(/{server}/g, guild.guild_name) };

        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
