// @ts-nocheck
// Migrated from Supabase Edge Function `giveaway-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip",
};

// Helper function to check if IP is whitelisted
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

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotTokenForGuild(supabase: any, guildId: string, fallbackToken?: string | null): Promise<string> {
  const { data: settings } = await supabase
    .from("guild_bot_settings")
    .select("is_custom_bot, is_active, bot_token_encrypted")
    .eq("guild_id", guildId)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  const encryptionKey = __env("BOT_SECRET_KEY") || "default-encryption-key";

  if (settings?.bot_token_encrypted) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
    } catch (e) {
      console.error("Failed to decrypt custom bot token, falling back to global:", e instanceof Error ? e.message : String(e));
    }
  }

  if (!fallbackToken) {
    throw new Error("Bot token not configured");
  }

  return fallbackToken;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const botSecretKey = __env("BOT_SECRET_KEY");
    let discordBotToken = __env("DISCORD_BOT_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { action, guildId, giveawayId, userId, username, messageId, giveawayData } = body;

    console.log(`Giveaway handler: action=${action}, guildId=${guildId}, giveawayId=${giveawayId}`);

    // Helper to get guild by ID (internal UUID) or Discord guild ID
    async function getGuildInternal(guildIdParam: string) {
      let { data: guild, error } = await supabase
        .from("guilds")
        .select("id, guild_id")
        .eq("id", guildIdParam)
        .maybeSingle();

      if (!guild) {
        const result = await supabase
          .from("guilds")
          .select("id, guild_id")
          .eq("guild_id", guildIdParam)
          .maybeSingle();
        guild = result.data;
        error = result.error;
      }

      return { guild, error };
    }

    // Dashboard actions support either user JWT or trusted bot secret
    const dashboardActions = new Set(["sendEmbed", "create", "end", "delete", "reroll"]);
    const authHeader = req.headers.get("Authorization");
    const botAuthHeader = req.headers.get("x-bot-secret");
    const isBotRequest = !!botAuthHeader && botAuthHeader === botSecretKey;

    if (dashboardActions.has(action) && !isBotRequest) {
      if (!authHeader) {
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
      if (!isBotRequest) {
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

    const requestedGuildId = giveawayData?.guild_id || guildId || null;
    if (requestedGuildId) {
      const { guild } = await getGuildInternal(requestedGuildId);
      if (guild) {
        discordBotToken = await getBotTokenForGuild(supabase, guild.id, discordBotToken);
      }
    }

    // Helper to call Discord API
    async function discordApi(endpoint: string, options: RequestInit = {}) {
      const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`Discord API error: ${response.status} - ${text}`);
        throw new Error(`Discord API error: ${response.status}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    // Format duration for display
    function formatDuration(endsAt: string): string {
      const end = new Date(endsAt);
      const now = new Date();
      const diffMs = end.getTime() - now.getTime();
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      
      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    function getEntries(entries: unknown): string[] {
      return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === "string") : [];
    }

    function getWinners(winners: unknown): string[] {
      return Array.isArray(winners) ? winners.filter((winner): winner is string => typeof winner === "string") : [];
    }

    function buildGiveawayEmbed(giveaway: any) {
      const entries = getEntries(giveaway.entries);
      const winners = getWinners(giveaway.winners);
      const hasEnded = giveaway.ended || new Date(giveaway.ends_at) <= new Date();
      const endsAtUnix = Math.floor(new Date(giveaway.ends_at).getTime() / 1000);

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: hasEnded ? "⏱️ Sluttede" : "⏱️ Slutter",
          value: `<t:${endsAtUnix}:${hasEnded ? "f" : "R"}>`,
          inline: true,
        },
        {
          name: "🏆 Vindere",
          value: String(giveaway.winners_count),
          inline: true,
        },
        {
          name: "🎫 Deltagere",
          value: String(entries.length),
          inline: true,
        },
      ];

      if (giveaway.required_role_id) {
        fields.push({
          name: "🔒 Krævet rolle",
          value: `<@&${giveaway.required_role_id}>`,
          inline: false,
        });
      }

      if (hasEnded) {
        fields.push({
          name: "🎊 Resultat",
          value: winners.length > 0
            ? winners.map((winnerId) => `<@${winnerId}>`).join(", ")
            : "Ingen gyldige deltagere.",
          inline: false,
        });
      }

      return {
        title: hasEnded ? "🎉 Giveaway afsluttet" : "🎉 Giveaway!",
        description: `**${giveaway.prize}**${giveaway.description ? `\n\n${giveaway.description}` : ""}`,
        color: hasEnded ? 0x57F287 : 0x5865F2,
        fields,
        footer: {
          text: `Giveaway ID: ${giveaway.id}`,
        },
        timestamp: new Date(giveaway.ends_at).toISOString(),
      };
    }

    function buildGiveawayComponents(giveaway: any) {
      const entries = getEntries(giveaway.entries);
      const hasEnded = giveaway.ended || new Date(giveaway.ends_at) <= new Date();

      return [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: hasEnded ? 2 : 3,
              custom_id: `giveaway_enter_${giveaway.id}`,
              label: hasEnded ? "Giveaway afsluttet" : `Deltag (${entries.length})`,
              emoji: { name: "🎉" },
              disabled: hasEnded,
            },
          ],
        },
      ];
    }

    function buildGiveawayMessagePayload(giveaway: any) {
      const hasEnded = giveaway.ended || new Date(giveaway.ends_at) <= new Date();

      return {
        content: hasEnded
          ? "🎉 Giveawayen er afsluttet."
          : "Klik på knappen nedenfor for at deltage!",
        embeds: [buildGiveawayEmbed(giveaway)],
        components: buildGiveawayComponents(giveaway),
      };
    }

    async function syncGiveawayMessage(giveaway: any) {
      if (!giveaway?.channel_id || !giveaway?.message_id) return;

      try {
        await discordApi(`/channels/${giveaway.channel_id}/messages/${giveaway.message_id}`, {
          method: "PATCH",
          body: JSON.stringify(buildGiveawayMessagePayload(giveaway)),
        });
      } catch (error) {
        console.error("Failed to sync giveaway message:", error);
      }
    }

    switch (action) {
      case "create": {
        // Create giveaway from dashboard and send embed to Discord
        if (!giveawayData) {
          return new Response(JSON.stringify({ error: "Missing giveaway data" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { guild, error: guildError } = await getGuildInternal(giveawayData.guild_id);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create the giveaway in database
        const { data: newGiveaway, error: insertError } = await supabase
          .from("giveaways")
          .insert({
            guild_id: guild.id,
            channel_id: giveawayData.channel_id,
            prize: giveawayData.prize,
            description: giveawayData.description || null,
            winners_count: giveawayData.winners_count || 1,
            ends_at: giveawayData.ends_at,
            required_role_id: giveawayData.required_role_id || null,
            host_user_id: giveawayData.host_user_id || "dashboard",
            host_username: giveawayData.host_username || "Dashboard",
            entries: [],
            ended: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const payload = buildGiveawayMessagePayload(newGiveaway);
          const message = await discordApi(`/channels/${newGiveaway.channel_id}/messages`, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          // Update the giveaway with the message ID
          await supabase
            .from("giveaways")
            .update({ message_id: message.id })
            .eq("id", newGiveaway.id);

          console.log(`Giveaway created and embed sent: ${newGiveaway.id}, message: ${message.id}`);

          return new Response(JSON.stringify({ 
            success: true, 
            giveaway: { ...newGiveaway, message_id: message.id }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (discordError) {
          console.error("Failed to send Discord embed:", discordError);
          // Giveaway was created but embed failed - return partial success
          return new Response(JSON.stringify({ 
            success: true, 
            giveaway: newGiveaway,
            warning: "Giveaway created, but could not send to Discord. Check bot permissions."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "sendEmbed": {
        // Send/resend embed for existing giveaway (dashboard action)
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: giveaway, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (error || !giveaway) {
          return new Response(JSON.stringify({ error: "Giveaway not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const message = await discordApi(`/channels/${giveaway.channel_id}/messages`, {
          method: "POST",
          body: JSON.stringify(buildGiveawayMessagePayload(giveaway)),
        });

        // Update message_id
        await supabase
          .from("giveaways")
          .update({ message_id: message.id })
          .eq("id", giveawayId);

        return new Response(JSON.stringify({ success: true, messageId: message.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "enter": {
        // Get guild internal ID
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // User wants to enter a giveaway
        const { data: giveaway, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (error || !giveaway) {
          return new Response(JSON.stringify({ error: "Giveaway not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (giveaway.ended) {
          return new Response(JSON.stringify({ error: "Giveaway has ended" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (new Date(giveaway.ends_at) < new Date()) {
          return new Response(JSON.stringify({ error: "Giveaway has expired" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if user already entered
        const entries = getEntries(giveaway.entries);
        if (entries.includes(userId)) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Already entered",
            requiresRole: giveaway.required_role_id 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Add user to entries
        const updatedEntries = Array.from(new Set([...entries, userId]));
        await supabase
          .from("giveaways")
          .update({ entries: updatedEntries })
          .eq("id", giveawayId);

        await syncGiveawayMessage({ ...giveaway, entries: updatedEntries });

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Entry added",
          entriesCount: updatedEntries.length,
          requiresRole: giveaway.required_role_id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "leave": {
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // User wants to leave a giveaway
        const { data: giveaway, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (error || !giveaway) {
          return new Response(JSON.stringify({ error: "Giveaway not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const entries = getEntries(giveaway.entries);
        const updatedEntries = entries.filter(id => id !== userId);

        await supabase
          .from("giveaways")
          .update({ entries: updatedEntries })
          .eq("id", giveawayId);

        await syncGiveawayMessage({ ...giveaway, entries: updatedEntries });

        return new Response(JSON.stringify({ 
          success: true, 
          entriesCount: updatedEntries.length 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "end": {
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // End giveaway and pick winners
        const { data: giveaway, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (error || !giveaway) {
          return new Response(JSON.stringify({ error: "Giveaway not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (giveaway.ended) {
          return new Response(JSON.stringify({ error: "Giveaway already ended" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const entries = getEntries(giveaway.entries);
        const winnersCount = Math.min(giveaway.winners_count, entries.length);
        
        // Pick random winners
        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, winnersCount);

        // Update giveaway
        await supabase
          .from("giveaways")
          .update({ 
            ended: true, 
            winners: winners 
          })
          .eq("id", giveawayId);

        await syncGiveawayMessage({ ...giveaway, ended: true, winners });

        // Send winner announcement to Discord
        if (giveaway.channel_id && winners.length > 0) {
          const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
          const embed = {
            title: "🎉 Giveaway Ended!",
            description: `**Prize:** ${giveaway.prize}`,
            color: 0x57F287,
            fields: [
              {
                name: "🏆 Winners",
                value: winnerMentions,
                inline: false
              },
              {
                name: "📊 Entries",
                value: String(entries.length),
                inline: true
              }
            ],
            timestamp: new Date().toISOString()
          };

          try {
            await discordApi(`/channels/${giveaway.channel_id}/messages`, {
              method: "POST",
              body: JSON.stringify({
                content: `🎊 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
                embeds: [embed]
              })
            });
          } catch (e) {
            console.error("Failed to send winner announcement:", e);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          winners,
          entriesCount: entries.length 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reroll": {
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: giveaway, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        if (error || !giveaway) {
          return new Response(JSON.stringify({ error: "Giveaway not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Auto-end if expired but not formally ended
        const isExpired = new Date(giveaway.ends_at) <= new Date();
        if (!giveaway.ended && !isExpired) {
          return new Response(JSON.stringify({ error: "Giveaway is still active" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const entries = getEntries(giveaway.entries);
        if (entries.length === 0) {
          return new Response(JSON.stringify({ error: "No entries to reroll from" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Pick fresh random winners (replacing old ones)
        const winnersCount = Math.min(giveaway.winners_count, entries.length);
        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        const newWinners = shuffled.slice(0, winnersCount);

        await supabase
          .from("giveaways")
          .update({ winners: newWinners, ended: true })
          .eq("id", giveawayId);

        await syncGiveawayMessage({ ...giveaway, ended: true, winners: newWinners });

        // Announce reroll
        if (giveaway.channel_id) {
          const winnerMentions = newWinners.map(id => `<@${id}>`).join(", ");
          try {
            await discordApi(`/channels/${giveaway.channel_id}/messages`, {
              method: "POST",
              body: JSON.stringify({
                content: `🎲 Reroll! Nye vindere af **${giveaway.prize}**: ${winnerMentions}!`
              })
            });
          } catch (e) {
            console.error("Failed to send reroll announcement:", e);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          winners: newWinners
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get giveaway to check if it has a message to delete
        const { data: giveaway } = await supabase
          .from("giveaways")
          .select("message_id, channel_id")
          .eq("id", giveawayId)
          .eq("guild_id", guild.id)
          .maybeSingle();

        // Try to delete the Discord message if it exists
        if (giveaway?.message_id && giveaway?.channel_id) {
          try {
            await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages/${giveaway.message_id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bot ${discordBotToken}`,
              },
            });
          } catch (e) {
            console.error("Failed to delete giveaway message from Discord:", e);
          }
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from("giveaways")
          .delete()
          .eq("id", giveawayId)
          .eq("guild_id", guild.id);

        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "updateMessageId": {
        // Update the Discord message ID for a giveaway
        await supabase
          .from("giveaways")
          .update({ message_id: messageId })
          .eq("id", giveawayId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getActive": {
        const { guild, error: guildError } = await getGuildInternal(guildId);
        if (guildError || !guild) {
          return new Response(JSON.stringify({ error: "Guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get all active giveaways for a guild
        const { data: giveaways, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("guild_id", guild.id)
          .eq("ended", false)
          .gt("ends_at", new Date().toISOString());

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ giveaways }), {
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
    console.error("Giveaway handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/giveaway-handler')({
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
