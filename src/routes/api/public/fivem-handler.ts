// @ts-nocheck
// Migrated from Supabase Edge Function `fivem-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret, x-fivem-key, x-gms-version, x-gms-framework",
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// IP whitelist check function
async function checkIPWhitelist(req: Request, supabaseClient: any): Promise<{ allowed: boolean; ip: string }> {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  
  const { data: whitelist, error } = await supabaseClient
    .from("admin_ip_whitelist")
    .select("ip_address");
  
  if (error) {
    console.error("Error fetching IP whitelist:", error);
    return { allowed: true, ip };
  }
  
  if (!whitelist || whitelist.length === 0) {
    return { allowed: true, ip };
  }
  
  const isWhitelisted = whitelist.some((entry: { ip_address: string }) => entry.ip_address === ip);
  return { allowed: isWhitelisted, ip };
}

function simpleDecrypt(encoded: string, key: string): string {
  const decoded = atob(encoded);
  let output = "";
  for (let i = 0; i < decoded.length; i++) {
    output += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return output;
}

async function getDiscordBotToken(supabase: any, internalGuildId: string, encryptionKey?: string) {
  if (encryptionKey) {
    const { data: custom } = await supabase
      .from("guild_bot_settings")
      .select("bot_token_encrypted, is_active, is_custom_bot")
      .eq("guild_id", internalGuildId)
      .eq("is_active", true)
      .eq("is_custom_bot", true)
      .maybeSingle();

    if (custom?.bot_token_encrypted) {
      try {
        return simpleDecrypt(custom.bot_token_encrypted, encryptionKey);
      } catch (error) {
        console.warn("Could not decrypt custom bot token for FiveM role sync");
      }
    }
  }

  return __env("DEFAULT_BOT_TOKEN") || __env("DISCORD_BOT_TOKEN") || null;
}

async function getDiscordMemberRoles(
  supabase: any,
  internalGuildId: string,
  discordGuildId: string,
  discordUserId: string,
  encryptionKey?: string,
): Promise<string[] | null> {
  const token = await getDiscordBotToken(supabase, internalGuildId, encryptionKey);
  if (!token) return null;

  const response = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!response.ok) return null;
  const member = await response.json();
  return Array.isArray(member.roles) ? member.roles : [];
}

async function syncDiscordWhitelistRole(
  supabase: any,
  internalGuildId: string,
  discordGuildId: string,
  discordUserId: string,
  roleId: string | null | undefined,
  shouldHaveRole: boolean,
  encryptionKey?: string,
) {
  if (!roleId || !discordUserId) return;

  const token = await getDiscordBotToken(supabase, internalGuildId, encryptionKey);
  if (!token) return;

  const url = `https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUserId}/roles/${roleId}`;
  await fetch(url, {
    method: shouldHaveRole ? "PUT" : "DELETE",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {});
}

// Helper to log actions
async function logAction(supabase: any, guildId: string, actionType: string, data: any) {
  await supabase.from("fivem_action_logs").insert({
    guild_id: guildId,
    action_type: actionType,
    target_discord_id: data.targetDiscordId,
    target_name: data.targetName,
    moderator_discord_id: data.moderatorDiscordId,
    moderator_name: data.moderatorName,
    reason: data.reason,
    duration_seconds: data.durationSeconds,
    metadata: data.metadata || {},
  });
}

// Format uptime to human readable (txAdmin style: "3 hrs, 27 mins")
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);
  return parts.join(', ');
}

// Format time until next restart
function formatTimeUntil(targetTime: Date): string {
  const now = new Date();
  const diffMs = targetTime.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Nu';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'time' : 'timer'}, ${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  }
  return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
}

// Calculate next restart from schedule (array of HH:MM times)
function getNextRestartTime(schedule: string[], nextRestartAt?: string): { time: string; timestamp: Date | null } {
  // If explicit next_restart_at is set, use that
  if (nextRestartAt) {
    const restartTime = new Date(nextRestartAt);
    if (restartTime > new Date()) {
      return { 
        time: formatTimeUntil(restartTime), 
        timestamp: restartTime 
      };
    }
  }
  
  // Otherwise calculate from schedule
  if (!schedule || schedule.length === 0) {
    return { time: 'Ikke planlagt', timestamp: null };
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Parse schedule times and find next one
  const scheduledTimes = schedule.map(timeStr => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduled = new Date(today);
    scheduled.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
    return scheduled;
  }).sort((a, b) => a.getTime() - b.getTime());
  
  if (scheduledTimes.length > 0) {
    return { 
      time: formatTimeUntil(scheduledTimes[0]), 
      timestamp: scheduledTimes[0] 
    };
  }
  
  return { time: 'Ikke planlagt', timestamp: null };
}

// Send or update Discord status embed via webhook (txAdmin style)
async function sendDiscordStatusEmbed(
  webhookUrl: string, 
  status: any, 
  isOnline: boolean,
  existingMessageId?: string | null,
  settings?: any
): Promise<string | null> {
  // Build the embed in txAdmin style
  const serverName = settings?.server_name || status.server_name || 'FiveM Server';
  
  // Build connect command using cfx_code or server_ip
  let connectCommand = 'N/A';
  if (settings?.cfx_code) {
    connectCommand = `connect ${settings.cfx_code}`;
  } else if (settings?.server_ip) {
    connectCommand = `connect ${settings.server_ip}`;
  }
  
  // Calculate next restart
  const nextRestart = getNextRestartTime(
    status.restart_schedule || [], 
    status.next_restart_at
  );
  
  const fields = [
    {
      name: 'STATUS',
      value: isOnline ? '🟢 Online' : '🔴 Offline',
      inline: true,
    },
    {
      name: 'PLAYERS',
      value: isOnline ? `${status.player_count || 0}/${status.max_players || 64}` : '0/0',
      inline: true,
    },
    {
      name: '\u200B', // Empty field for spacing
      value: '\u200B',
      inline: true,
    },
    {
      name: 'UPTIME',
      value: isOnline ? formatUptime(status.uptime_seconds || 0) : '0 mins',
      inline: true,
    },
    {
      name: 'NEXT RESTART',
      value: isOnline ? nextRestart.time : 'N/A',
      inline: true,
    },
    {
      name: '\u200B', // Empty field for spacing
      value: '\u200B',
      inline: true,
    },
    {
      name: 'F8 CONNECT COMMAND',
      value: `\`${connectCommand}\``,
      inline: false,
    },
  ];
  
  const embed = {
    color: isOnline ? 0x57F287 : 0xED4245, // Green when online, red when offline
    author: {
      name: serverName,
    },
    description: 'Server status information.',
    fields: fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Sidst opdateret',
    },
  };

  try {
    const bodyPayload = JSON.stringify({ embeds: [embed] });
    const headers = { 'Content-Type': 'application/json' };

    // Helper to handle Discord rate limits
    const fetchWithRetry = async (url: string, opts: RequestInit): Promise<Response> => {
      let res = await fetch(url, opts);
      if (res.status === 429) {
        const retryData = await res.json().catch(() => ({}));
        const retryAfter = ((retryData as any).retry_after || 2) * 1000;
        console.log(`Discord rate limited, retrying after ${retryAfter}ms`);
        await new Promise((r) => setTimeout(r, retryAfter));
        res = await fetch(url, opts);
      }
      return res;
    };

    // If we have an existing message ID, try to edit it
    if (existingMessageId) {
      const editUrl = `${webhookUrl}/messages/${existingMessageId}`;
      const editResponse = await fetchWithRetry(editUrl, {
        method: 'PATCH',
        headers,
        body: bodyPayload,
      });

      if (editResponse.ok) {
        return existingMessageId;
      }

      const editErr = await editResponse.text().catch(() => 'unknown');
      console.log(`Failed to edit message ${existingMessageId} (${editResponse.status}): ${editErr}`);

      // Only create a NEW message if the original is gone (404 Unknown Message
      // or 403 Cannot edit). Otherwise (rate-limit, transient 5xx, etc.) keep
      // the existing message ID so we don't spam the channel with duplicates.
      if (editResponse.status !== 404 && editResponse.status !== 403) {
        return existingMessageId;
      }
      console.log('Original status message gone — creating a fresh one.');
    }
    
    // Create new message and return the message ID
    const response = await fetchWithRetry(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers,
      body: bodyPayload,
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Created new Discord status message:', data.id);
      return data.id || null;
    }
    const errText = await response.text().catch(() => 'unknown');
    console.error(`Failed to create status message (${response.status}): ${errText}`);
    return null;
  } catch (error) {
    console.error('Error sending Discord status embed:', error);
    return null;
  }
}

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseServiceKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const botSecret = __env("BOT_SECRET_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, guildId, data = {} } = await req.json();
    if (!action || !guildId) {
      return new Response(
        JSON.stringify({ error: "action and guildId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the Discord guild first. A per-guild bridge key can then be verified
    // without ever exposing the platform-wide BOT_SECRET_KEY to FiveM customers.
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .select("id, guild_id")
      .eq("guild_id", guildId)
      .single();

    if (guildError || !guild) {
      return new Response(
        JSON.stringify({ error: "Guild not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalGuildId = guild.id;
    const requestBridgeKey = req.headers.get("x-fivem-key");
    const requestBotSecret = req.headers.get("x-bot-secret");

    let authenticatedWithBridgeKey = false;
    let authenticatedLegacy = false;

    if (requestBridgeKey) {
      const { data: bridgeSettings } = await supabase
        .from("fivem_settings")
        .select("bridge_token_hash")
        .eq("guild_id", internalGuildId)
        .maybeSingle();

      if (bridgeSettings?.bridge_token_hash) {
        const suppliedHash = await sha256Hex(requestBridgeKey);
        authenticatedWithBridgeKey = suppliedHash === bridgeSettings.bridge_token_hash;
      }
    }

    // Backwards compatibility for trusted internal callers only. Never accept an
    // empty/missing platform secret, which the old comparison could accidentally do.
    if (!authenticatedWithBridgeKey && botSecret && requestBotSecret) {
      authenticatedLegacy = requestBotSecret === botSecret;
    }

    if (!authenticatedWithBridgeKey && !authenticatedLegacy) {
      return new Response(
        JSON.stringify({ error: "Unauthorized FiveM bridge" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy callers keep the old IP whitelist behaviour. Per-guild bridge keys are
    // independently revocable and intentionally support dynamic hosting IPs.
    if (authenticatedLegacy) {
      const ipCheck = await checkIPWhitelist(req, supabase);
      if (!ipCheck.allowed) {
        console.log(`IP ${ipCheck.ip} not whitelisted for FiveM handler`);
        return new Response(
          JSON.stringify({ error: "Forbidden - IP not whitelisted", ip: ipCheck.ip }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!["getPendingCommands", "syncOnlinePlayers", "getSettings"].includes(action)) {
      console.log(`FiveM handler: action=${action}, guildId=${guildId}, auth=${authenticatedWithBridgeKey ? "bridge" : "legacy"}`);
    }

    switch (action) {
      // ==================== WHITELIST ACTIONS ====================
      case "checkWhitelist": {
        const { discordId, steamHex, license } = data;

        // Ban enforcement is always active, even when whitelist itself is disabled.
        const { data: activeBans } = await supabase
          .from("fivem_bans")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("is_active", true);

        const matchingBan = (activeBans || []).find((ban: any) =>
          (discordId && ban.discord_user_id === discordId) ||
          (steamHex && ban.steam_hex === steamHex) ||
          (license && ban.license === license)
        );

        if (matchingBan) {
          const expired = matchingBan.expires_at && new Date(matchingBan.expires_at) < new Date();
          if (!expired) {
            return new Response(
              JSON.stringify({
                whitelisted: false,
                banned: true,
                banReason: matchingBan.reason,
                banExpires: matchingBan.expires_at,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await supabase
            .from("fivem_bans")
            .update({ is_active: false })
            .eq("id", matchingBan.id);
        }

        const { data: settings } = await supabase
          .from("fivem_settings")
          .select("whitelist_enabled, auto_whitelist_role_id, whitelisted_role_id, sync_discord_roles")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (settings?.whitelist_enabled === false) {
          return new Response(
            JSON.stringify({ whitelisted: true, banned: false, whitelistDisabled: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let query = supabase
          .from("fivem_whitelist")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("is_whitelisted", true);

        if (discordId) query = query.eq("discord_user_id", discordId);
        else if (steamHex) query = query.eq("steam_hex", steamHex);
        else if (license) query = query.eq("license", license);
        else {
          return new Response(
            JSON.stringify({ whitelisted: false, banned: false, reason: "No supported identifier" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: whitelistEntry, error } = await query.maybeSingle();
        if (error) {
          console.error("Error checking whitelist:", error);
          return new Response(JSON.stringify({ error: "Database error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (whitelistEntry) {
          if (settings?.sync_discord_roles && settings?.whitelisted_role_id && discordId) {
            await syncDiscordWhitelistRole(
              supabase,
              internalGuildId,
              guild.guild_id,
              discordId,
              settings.whitelisted_role_id,
              true,
              botSecret,
            );
          }

          return new Response(
            JSON.stringify({
              whitelisted: true,
              banned: false,
              player: whitelistEntry,
              priority: whitelistEntry.priority_level || 0,
              source: "database",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Optional Discord role based auto-whitelist. This uses the guild's custom
        // bot when configured, otherwise the default bot.
        if (discordId && settings?.auto_whitelist_role_id) {
          const roles = await getDiscordMemberRoles(
            supabase,
            internalGuildId,
            guild.guild_id,
            discordId,
            botSecret,
          );

          if (roles?.includes(settings.auto_whitelist_role_id)) {
            const { data: existing } = await supabase
              .from("fivem_whitelist")
              .select("id")
              .eq("guild_id", internalGuildId)
              .eq("discord_user_id", discordId)
              .maybeSingle();

            const payload = {
              is_whitelisted: true,
              whitelist_reason: "Discord auto-whitelist role",
              whitelisted_by: "discord-role-sync",
              whitelisted_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase.from("fivem_whitelist").update(payload).eq("id", existing.id);
            } else {
              await supabase.from("fivem_whitelist").insert({
                guild_id: internalGuildId,
                discord_user_id: discordId,
                discord_id: discordId,
                ...payload,
              });
            }

            if (settings?.sync_discord_roles && settings?.whitelisted_role_id) {
              await syncDiscordWhitelistRole(
                supabase,
                internalGuildId,
                guild.guild_id,
                discordId,
                settings.whitelisted_role_id,
                true,
                botSecret,
              );
            }

            return new Response(
              JSON.stringify({
                whitelisted: true,
                banned: false,
                priority: 0,
                source: "discord-role",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ whitelisted: false, banned: false, player: null, priority: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "registerPlayer": {
        const { discordId, discordUsername, steamHex, license, fivemId, ip } = data;

        const { data: existing } = await supabase
          .from("fivem_whitelist")
          .select("id")
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("fivem_whitelist")
            .update({
              discord_username: discordUsername,
              steam_hex: steamHex,
              license: license,
              fivem_id: fivemId,
              ip_address: ip,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (error) {
            console.error("Error updating player:", error);
            return new Response(
              JSON.stringify({ error: "Failed to update player" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const { error } = await supabase
            .from("fivem_whitelist")
            .insert({
              guild_id: internalGuildId,
              discord_user_id: discordId,
              discord_username: discordUsername,
              steam_hex: steamHex,
              license: license,
              fivem_id: fivemId,
              ip_address: ip,
              is_whitelisted: false,
              last_seen_at: new Date().toISOString(),
            });

          if (error) {
            console.error("Error registering player:", error);
            return new Response(
              JSON.stringify({ error: "Failed to register player" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "setWhitelistEntry": {
        const discordId = String(data.discordId || "").trim();
        if (!/^\d{15,22}$/.test(discordId)) {
          return new Response(JSON.stringify({ error: "Invalid Discord ID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existing } = await supabase
          .from("fivem_whitelist")
          .select("id")
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId)
          .maybeSingle();

        const payload = {
          discord_user_id: discordId,
          discord_id: discordId,
          is_whitelisted: data.whitelisted !== false,
          whitelist_reason: data.reason || "FiveM command",
          whitelisted_by: data.moderatorDiscordId || "system",
          whitelisted_at: data.whitelisted === false ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const query = existing
          ? supabase.from("fivem_whitelist").update(payload).eq("id", existing.id)
          : supabase.from("fivem_whitelist").insert({ guild_id: internalGuildId, ...payload });

        const { error } = await query;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: syncSettings } = await supabase
          .from("fivem_settings")
          .select("sync_discord_roles, whitelisted_role_id")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (syncSettings?.sync_discord_roles && syncSettings?.whitelisted_role_id) {
          await syncDiscordWhitelistRole(
            supabase,
            internalGuildId,
            guild.guild_id,
            discordId,
            syncSettings.whitelisted_role_id,
            data.whitelisted !== false,
            botSecret,
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "removeWhitelistEntry": {
        const discordId = String(data.discordId || "").trim();
        await supabase
          .from("fivem_whitelist")
          .delete()
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId);

        const { data: syncSettings } = await supabase
          .from("fivem_settings")
          .select("sync_discord_roles, whitelisted_role_id")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (syncSettings?.sync_discord_roles && syncSettings?.whitelisted_role_id) {
          await syncDiscordWhitelistRole(
            supabase,
            internalGuildId,
            guild.guild_id,
            discordId,
            syncSettings.whitelisted_role_id,
            false,
            botSecret,
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getWhitelistEntry": {
        const discordId = String(data.discordId || "").trim();
        const { data: entry } = await supabase
          .from("fivem_whitelist")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId)
          .maybeSingle();

        return new Response(JSON.stringify({ entry: entry || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggleWhitelist": {
        const { data: current } = await supabase
          .from("fivem_settings")
          .select("whitelist_enabled")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        const nextValue = !(current?.whitelist_enabled ?? true);
        const { error } = await supabase
          .from("fivem_settings")
          .upsert({
            guild_id: internalGuildId,
            whitelist_enabled: nextValue,
            updated_at: new Date().toISOString(),
          }, { onConflict: "guild_id" });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, whitelistEnabled: nextValue }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==================== SESSION & PLAYTIME ====================
      case "updatePlaytime": {
        const { discordId, minutes } = data;

        const { error } = await supabase
          .from("fivem_whitelist")
          .update({
            playtime_minutes: minutes,
            last_seen_at: new Date().toISOString(),
          })
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId);

        if (error) {
          console.error("Error updating playtime:", error);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sessionStart": {
        const { discordId, serverId } = data;

        const { data: whitelistEntry } = await supabase
          .from("fivem_whitelist")
          .select("id")
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId)
          .maybeSingle();

        await supabase.from("fivem_sessions").insert({
          guild_id: internalGuildId,
          whitelist_id: whitelistEntry?.id || null,
          server_id: serverId,
          session_start: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sessionEnd": {
        const { discordId } = data;
        const serverId = String(data.serverId || "main");

        const { data: whitelistEntry } = await supabase
          .from("fivem_whitelist")
          .select("id, playtime_minutes")
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", discordId)
          .maybeSingle();

        let addedMinutes = 0;

        if (whitelistEntry) {
          const { data: session } = await supabase
            .from("fivem_sessions")
            .select("id, session_start")
            .eq("whitelist_id", whitelistEntry.id)
            .eq("server_id", serverId)
            .is("session_end", null)
            .order("session_start", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (session) {
            const endedAt = new Date();
            const startedAt = new Date(session.session_start);
            addedMinutes = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000));

            await supabase
              .from("fivem_sessions")
              .update({ session_end: endedAt.toISOString() })
              .eq("id", session.id);

            if (addedMinutes > 0) {
              await supabase
                .from("fivem_whitelist")
                .update({
                  playtime_minutes: (whitelistEntry.playtime_minutes || 0) + addedMinutes,
                  last_seen_at: endedAt.toISOString(),
                })
                .eq("id", whitelistEntry.id);
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, addedMinutes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== ONLINE PLAYERS ====================
      case "updateOnlinePlayer": {
        const { playerId, serverId, discordId, discordUsername, steamHex, license, characterName, ping, coords } = data;

        const payload = {
          guild_id: internalGuildId,
          server_id: serverId,
          player_id: playerId,
          discord_user_id: discordId,
          discord_username: discordUsername,
          steam_hex: steamHex,
          license: license,
          character_name: characterName,
          ping: ping,
          coords: coords,
          last_update: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("fivem_online_players")
          .upsert(payload, { onConflict: "guild_id,server_id,player_id" });

        if (error) {
          console.error("Error upserting online player:", { error, payload });
          return new Response(
            JSON.stringify({ success: false, error: "Failed to update online player" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "removeOnlinePlayer": {
        const { playerId, serverId } = data;

        await supabase
          .from("fivem_online_players")
          .delete()
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId)
          .eq("player_id", playerId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "syncOnlinePlayers": {
        const serverId = String(data.serverId || "main");
        const players = Array.isArray(data.players) ? data.players.slice(0, 512) : [];
        const now = new Date().toISOString();

        const rows = players
          .filter((player: any) => Number.isFinite(Number(player.playerId)))
          .map((player: any) => ({
            guild_id: internalGuildId,
            server_id: serverId,
            player_id: Number(player.playerId),
            discord_user_id: player.discordId || null,
            discord_username: player.discordUsername || null,
            steam_hex: player.steamHex || null,
            license: player.license || null,
            character_name: player.characterName || null,
            ping: Number.isFinite(Number(player.ping)) ? Number(player.ping) : null,
            coords: player.coords || null,
            last_update: now,
          }));

        if (rows.length > 0) {
          const { error: upsertError } = await supabase
            .from("fivem_online_players")
            .upsert(rows, { onConflict: "guild_id,server_id,player_id" });

          if (upsertError) {
            console.error("Error syncing online players:", upsertError);
            return new Response(JSON.stringify({ error: "Failed to sync online players" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const ids = rows.map((row: any) => row.player_id);
          await supabase
            .from("fivem_online_players")
            .delete()
            .eq("guild_id", internalGuildId)
            .eq("server_id", serverId)
            .not("player_id", "in", `(${ids.join(",")})`);
        } else {
          await supabase
            .from("fivem_online_players")
            .delete()
            .eq("guild_id", internalGuildId)
            .eq("server_id", serverId);
        }

        return new Response(
          JSON.stringify({ success: true, count: rows.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getOnlinePlayers": {
        const { data: players, error } = await supabase
          .from("fivem_online_players")
          .select("*")
          .eq("guild_id", internalGuildId);

        if (error) {
          console.error("Error fetching online players:", error);
        }

        return new Response(
          JSON.stringify({ players: players || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== MODERATION ACTIONS ====================
      case "kick": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName, reason } = data;

        await logAction(supabase, internalGuildId, "kick", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName, reason
        });

        return new Response(
          JSON.stringify({ success: true, action: "kick" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "ban": {
        const { targetDiscordId, targetName, steamHex, license, ipAddress, moderatorDiscordId, moderatorName, reason, durationSeconds } = data;

        const expiresAt = durationSeconds 
          ? new Date(Date.now() + durationSeconds * 1000).toISOString()
          : null;

        await supabase.from("fivem_bans").insert({
          guild_id: internalGuildId,
          discord_user_id: targetDiscordId,
          discord_username: targetName,
          steam_hex: steamHex,
          license: license,
          ip_address: ipAddress,
          reason: reason,
          banned_by_discord_id: moderatorDiscordId,
          banned_by_name: moderatorName,
          expires_at: expiresAt,
        });

        await logAction(supabase, internalGuildId, "ban", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName, reason, durationSeconds
        });

        return new Response(
          JSON.stringify({ success: true, action: "ban", expiresAt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unban": {
        const { targetDiscordId, moderatorDiscordId, moderatorName } = data;

        await supabase
          .from("fivem_bans")
          .update({
            is_active: false,
            unbanned_at: new Date().toISOString(),
            unbanned_by: moderatorName,
          })
          .eq("guild_id", internalGuildId)
          .eq("discord_user_id", targetDiscordId)
          .eq("is_active", true);

        await logAction(supabase, internalGuildId, "unban", {
          targetDiscordId, moderatorDiscordId, moderatorName
        });

        return new Response(
          JSON.stringify({ success: true, action: "unban" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "checkBan": {
        const { discordId, steamHex, license, ipAddress } = data;

        let query = supabase
          .from("fivem_bans")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("is_active", true);

        // Check by any identifier
        const { data: bans } = await query;
        
        const matchingBan = bans?.find(ban => 
          ban.discord_user_id === discordId ||
          (steamHex && ban.steam_hex === steamHex) ||
          (license && ban.license === license) ||
          (ipAddress && ban.ip_address === ipAddress)
        );

        if (matchingBan) {
          const isExpired = matchingBan.expires_at && new Date(matchingBan.expires_at) < new Date();
          return new Response(
            JSON.stringify({ 
              banned: !isExpired, 
              ban: isExpired ? null : matchingBan 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ banned: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "kill": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName, reason } = data;

        await logAction(supabase, internalGuildId, "kill", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName, reason
        });

        return new Response(
          JSON.stringify({ success: true, action: "kill" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "revive": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName } = data;

        await logAction(supabase, internalGuildId, "revive", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName
        });

        return new Response(
          JSON.stringify({ success: true, action: "revive" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "teleport": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName, coords } = data;

        await logAction(supabase, internalGuildId, "teleport", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName,
          metadata: { coords }
        });

        return new Response(
          JSON.stringify({ success: true, action: "teleport" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "message": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName, message } = data;

        await logAction(supabase, internalGuildId, "message", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName,
          metadata: { message }
        });

        return new Response(
          JSON.stringify({ success: true, action: "message" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "announcement": {
        const { moderatorDiscordId, moderatorName, message } = data;

        await logAction(supabase, internalGuildId, "announcement", {
          moderatorDiscordId, moderatorName,
          metadata: { message }
        });

        return new Response(
          JSON.stringify({ success: true, action: "announcement" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sendEmbed": {
        const { channelId, type, json: jsonData, message: embedMessage, title, image, thumbnail, footer, color } = data;
        
        // Log embed action
        await logAction(supabase, internalGuildId, "embed", {
          metadata: { channelId, type, title, message: embedMessage }
        });

        return new Response(
          JSON.stringify({ success: true, action: "embed", channelId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "screenshot": {
        const { targetDiscordId, targetName, moderatorDiscordId, moderatorName, imageData } = data;

        await logAction(supabase, internalGuildId, "screenshot", {
          targetDiscordId, targetName, moderatorDiscordId, moderatorName,
          metadata: { hasImage: !!imageData }
        });

        return new Response(
          JSON.stringify({ success: true, action: "screenshot" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "screenshotResult": {
        const {
          targetDiscordId,
          targetName,
          targetPlayerId,
          imageBase64,
          moderatorDiscordId,
          moderatorName,
        } = data;

        if (!imageBase64 || typeof imageBase64 !== "string") {
          return new Response(JSON.stringify({ error: "Screenshot data missing" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: screenshotSettings } = await supabase
          .from("fivem_settings")
          .select("log_webhook_url")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (!screenshotSettings?.log_webhook_url) {
          return new Response(JSON.stringify({
            error: "Konfigurér FiveM log webhook i dashboardet for at modtage screenshots."
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const match = imageBase64.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/s);
        if (!match) {
          return new Response(JSON.stringify({ error: "Invalid screenshot format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
        const raw = atob(match[2]);
        if (raw.length > 8 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Screenshot is too large" }), {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

        const extension = mime === "image/png" ? "png" : "jpg";
        const form = new FormData();
        form.append("payload_json", JSON.stringify({
          embeds: [{
            title: "📸 FiveM Screenshot",
            description: `**Spiller:** ${targetName || targetDiscordId || "Player #" + targetPlayerId}\n**Moderator:** ${moderatorName || moderatorDiscordId || "Dashboard"}`,
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
            image: { url: `attachment://screenshot.${extension}` },
          }],
        }));
        form.append("files[0]", new Blob([bytes], { type: mime }), `screenshot.${extension}`);

        const webhookUrl = screenshotSettings.log_webhook_url + (screenshotSettings.log_webhook_url.includes("?") ? "&wait=true" : "?wait=true");
        const upload = await fetch(webhookUrl, { method: "POST", body: form });
        if (!upload.ok) {
          const text = await upload.text();
          console.error("Screenshot webhook upload failed:", upload.status, text);
          return new Response(JSON.stringify({ error: "Screenshot webhook upload failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webhookMessage = await upload.json().catch(() => null);
        const attachmentUrl = webhookMessage?.attachments?.[0]?.url || null;

        await logAction(supabase, internalGuildId, "screenshot", {
          targetDiscordId,
          targetName,
          moderatorDiscordId,
          moderatorName,
          metadata: {
            targetPlayerId,
            attachmentUrl,
          },
        });

        return new Response(
          JSON.stringify({ success: true, action: "screenshotResult", url: attachmentUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "updateSettings": {
        const { whitelistEnabled, whitelistRoles } = data;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (whitelistEnabled !== undefined) updateData.whitelist_enabled = whitelistEnabled;
        if (whitelistRoles !== undefined) updateData.auto_whitelist_role_id = whitelistRoles?.[0] || null;

        await supabase
          .from("fivem_settings")
          .update(updateData)
          .eq("guild_id", internalGuildId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== ROLE & PERMISSIONS ====================
      case "getRolePermissions": {
        const { discordRoles } = data;

        const { data: permissions } = await supabase
          .from("fivem_role_permissions")
          .select("*")
          .eq("guild_id", internalGuildId)
          .in("discord_role_id", discordRoles || []);

        // Find highest permission level
        const levels = ["user", "mod", "admin", "god"];
        let highestLevel = "user";
        let acePermissions: string[] = [];

        permissions?.forEach(perm => {
          if (levels.indexOf(perm.permission_level) > levels.indexOf(highestLevel)) {
            highestLevel = perm.permission_level;
          }
          if (perm.ace_permissions) {
            acePermissions = [...acePermissions, ...perm.ace_permissions];
          }
        });

        return new Response(
          JSON.stringify({ 
            permissionLevel: highestLevel,
            acePermissions: [...new Set(acePermissions)]
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "setRolePermission": {
        const { discordRoleId, discordRoleName, permissionLevel, acePermissions } = data;

        await supabase
          .from("fivem_role_permissions")
          .upsert({
            guild_id: internalGuildId,
            discord_role_id: discordRoleId,
            discord_role_name: discordRoleName,
            permission_level: permissionLevel,
            ace_permissions: acePermissions,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'guild_id,discord_role_id' });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // ==================== SETTINGS & DATA ====================

      case "getWhitelist": {
        const { data: whitelist, error } = await supabase
          .from("fivem_whitelist")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("is_whitelisted", true);

        if (error) {
          console.error("Error fetching whitelist:", error);
        }

        return new Response(
          JSON.stringify({ whitelist }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getBans": {
        const { data: bans, error } = await supabase
          .from("fivem_bans")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("is_active", true)
          .order("banned_at", { ascending: false });

        if (error) {
          console.error("Error fetching bans:", error);
        }

        return new Response(
          JSON.stringify({ bans }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getActionLogs": {
        const { limit = 50 } = data || {};

        const { data: logs, error } = await supabase
          .from("fivem_action_logs")
          .select("*")
          .eq("guild_id", internalGuildId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          console.error("Error fetching action logs:", error);
        }

        return new Response(
          JSON.stringify({ logs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "log": {
        // Generic logging for external scripts
        const { event, message, color, metadata } = data;

        await supabase.from("fivem_action_logs").insert({
          guild_id: internalGuildId,
          action_type: event || "log",
          moderator_discord_id: "system",
          reason: message,
          metadata: { color, ...metadata },
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== COMMAND QUEUE (Dashboard -> FiveM) ====================
      case "getPendingCommands": {
        const serverId = String(data.serverId || "main");

        // Never auto-replay a claimed command. Some actions (money add,
        // inventory give, bans, etc.) are not idempotent and could be executed twice
        // if the bridge completed the action but lost the result response.
        const staleClaim = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        await supabase
          .from("fivem_command_queue")
          .update({
            status: "failed",
            result: "Bridge mistede forbindelsen efter command blev claimet. Ikke genkørt automatisk af sikkerhedshensyn.",
            executed_at: new Date().toISOString(),
          })
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId)
          .eq("status", "processing")
          .lt("executed_at", staleClaim);

        const { data: commands, error } = await supabase
          .from("fivem_command_queue")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(10);

        if (error) {
          console.error("Error fetching pending commands:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch commands" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ commands: commands || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "claimCommand": {
        const { commandId } = data;
        const serverId = String(data.serverId || "main");
        if (!commandId) {
          return new Response(JSON.stringify({ error: "commandId is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: claimed, error } = await supabase
          .from("fivem_command_queue")
          .update({
            status: "processing",
            executed_at: new Date().toISOString(),
          })
          .eq("id", commandId)
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to claim command" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ claimed: Boolean(claimed) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "markCommandExecuted": {
        const { commandId, result, success } = data;
        const serverId = String(data.serverId || "main");

        const { error } = await supabase
          .from("fivem_command_queue")
          .update({
            status: success ? "executed" : "failed",
            executed_at: new Date().toISOString(),
            result: result || null,
          })
          .eq("id", commandId)
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId);

        if (error) {
          console.error("Error marking command as executed:", error);
          return new Response(
            JSON.stringify({ error: "Failed to update command status" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== SERVER STATUS (txAdmin-like) ====================
      case "updateServerStatus": {
        if (authenticatedWithBridgeKey) {
          await supabase
            .from("fivem_settings")
            .update({
              bridge_last_seen_at: new Date().toISOString(),
              bridge_version: req.headers.get("x-gms-version") || null,
              bridge_framework: req.headers.get("x-gms-framework") || null,
              updated_at: new Date().toISOString(),
            })
            .eq("guild_id", internalGuildId);
        }

        const { 
          serverId, 
          serverName, 
          maxPlayers, 
          playerCount, 
          uptimeSeconds, 
          serverStartedAt,
          gameType,
          mapName,
          resourcesCount,
          txadminVersion,
          fxserverVersion,
          serverIp,
          serverPort,
          nextRestartAt,
          restartSchedule,
          metadata 
        } = data;

        const statusPayload = {
          guild_id: internalGuildId,
          server_id: serverId || 'main',
          server_name: serverName,
          max_players: maxPlayers || 64,
          player_count: playerCount || 0,
          uptime_seconds: uptimeSeconds || 0,
          server_started_at: serverStartedAt,
          game_type: gameType || 'fivem',
          map_name: mapName,
          resources_count: resourcesCount || 0,
          txadmin_version: txadminVersion,
          fxserver_version: fxserverVersion,
          server_ip: serverIp,
          server_port: serverPort || 30120,
          next_restart_at: nextRestartAt || null,
          restart_schedule: restartSchedule || [],
          is_online: true,
          last_heartbeat: new Date().toISOString(),
          metadata: metadata || {},
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("fivem_server_status")
          .upsert(statusPayload, { onConflict: 'guild_id,server_id' });

        if (error) {
          console.error("Error updating server status:", error);
          return new Response(
            JSON.stringify({ error: "Failed to update server status" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Send Discord status embed if configured
        const { data: settings, error: settingsError } = await supabase
          .from("fivem_settings")
          .select("status_webhook_url, status_message_id, server_name, server_ip, cfx_code")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        console.log(`Status webhook check: guild=${internalGuildId}, hasSettings=${!!settings}, webhookUrl=${settings?.status_webhook_url ? 'SET' : 'EMPTY'}, msgId=${settings?.status_message_id || 'none'}, settingsError=${settingsError?.message || 'none'}`);

        if (settings?.status_webhook_url) {
          const messageId = await sendDiscordStatusEmbed(
            settings.status_webhook_url,
            statusPayload,
            true,
            settings.status_message_id,
            settings
          );
          
          console.log(`Status embed result: messageId=${messageId}`);
          
          // Save message ID if it's new or changed
          if (messageId && messageId !== settings.status_message_id) {
            await supabase
              .from("fivem_settings")
              .update({ status_message_id: messageId })
              .eq("guild_id", internalGuildId);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "getServerStatus": {
        const requestedServerId = data.serverId ? String(data.serverId) : null;
        let query = supabase
          .from("fivem_server_status")
          .select("*")
          .eq("guild_id", internalGuildId)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (requestedServerId) query = query.eq("server_id", requestedServerId);

        const { data: status, error } = await query.maybeSingle();

        if (error) {
          console.error("Error fetching server status:", error);
        }

        return new Response(
          JSON.stringify({ status: status || null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "serverOffline": {
        const serverId = String(data.serverId || "main");

        // Mark only the resource instance that is shutting down as offline.
        const { data: existingStatus } = await supabase
          .from("fivem_server_status")
          .select("*")
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId)
          .maybeSingle();

        await supabase
          .from("fivem_server_status")
          .update({
            is_online: false,
            updated_at: new Date().toISOString(),
          })
          .eq("guild_id", internalGuildId)
          .eq("server_id", serverId);

        // Send offline embed if configured
        const { data: settings } = await supabase
          .from("fivem_settings")
          .select("status_webhook_url, status_message_id, server_name, server_ip, cfx_code")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (settings?.status_webhook_url && existingStatus) {
          const messageId = await sendDiscordStatusEmbed(
            settings.status_webhook_url,
            { ...existingStatus, is_online: false },
            false,
            settings.status_message_id,
            settings
          );
          
          // Save message ID if it's new or changed
          if (messageId && messageId !== settings.status_message_id) {
            await supabase
              .from("fivem_settings")
              .update({ status_message_id: messageId })
              .eq("guild_id", internalGuildId);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ==================== GET SETTINGS ====================
      case "getSettings": {
        const { data: settings, error } = await supabase
          .from("fivem_settings")
          .select("enabled, server_name, server_ip, cfx_code, whitelist_enabled, auto_whitelist_role_id, whitelisted_role_id, sync_discord_roles, sync_playtime, staff_role_ids, mod_role_ids, admin_role_ids, god_role_ids")
          .eq("guild_id", internalGuildId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching FiveM settings:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch settings" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            settings: settings || { whitelist_enabled: true, enabled: false },
            whitelistEnabled: settings?.whitelist_enabled ?? true,
            enabled: settings?.enabled ?? false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("FiveM handler error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/fivem-handler')({
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
