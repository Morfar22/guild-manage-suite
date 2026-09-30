// @ts-nocheck
// Migrated from Supabase Edge Function `bot-tickets` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


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

  // Check if whitelist has any entries
  const { count, error: countError } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error checking whitelist count:", countError);
    return { allowed: false, ip: clientIp };
  }

  // If whitelist is empty, allow all
  if ((count ?? 0) === 0) {
    return { allowed: true, ip: clientIp };
  }

  // Check if IP is in whitelist
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

async function getBotTokenForGuild(supabase: any, guildId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("guild_bot_settings")
    .select("bot_token_encrypted")
    .eq("guild_id", guildId)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  const key = __env("BOT_SECRET_KEY") || "default-encryption-key";
  if (settings?.bot_token_encrypted) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, key);
    } catch (error) {
      console.error("Failed to decrypt custom bot token:", error);
    }
  }

  const token = __env("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN secret");
  return token;
}

async function discordApi(path: string, init: RequestInit, token: string) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bot ${token}`,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Discord API error", res.status, text);
    throw new Error(`Discord API error (${res.status})`);
  }

  return text ? JSON.parse(text) : null;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify bot secret
  const botSecret = req.headers.get("x-bot-secret");
  if (botSecret !== __env("BOT_SECRET_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    __env("SUPABASE_URL")!,
    __env("SUPABASE_SERVICE_ROLE_KEY")!
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
      case "getCategories": {
        const { guildId } = data;
        // Look up internal guild UUID from Discord guild ID
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .maybeSingle();

        if (!guild) {
          return new Response(JSON.stringify({ categories: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: categories, error } = await supabase
          .from("ticket_categories")
          .select("*")
          .eq("guild_id", guild.id)
          .eq("enabled", true)
          .order("name");

        if (error) throw error;
        return new Response(JSON.stringify({ categories: categories || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "getCategory": {
        const { categoryId } = data;
        const { data: category, error } = await supabase
          .from("ticket_categories")
          .select("*, guilds!inner(id, guild_id)")
          .eq("id", categoryId)
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ category }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getSettings": {
        const { guildId, panelId } = data;
        const { data: settings } = await supabase
          .from("ticket_settings")
          .select("*")
          .eq("guild_id", guildId)
          .maybeSingle();

        let panel: any = null;
        if (panelId) {
          const { data: p } = await supabase
            .from("ticket_panels")
            .select("*")
            .eq("id", panelId)
            .maybeSingle();
          panel = p;
        }

        // Panel operating_hours (if set) override the global settings hours
        const merged = settings ? { ...settings } : {};
        if (panel?.operating_hours && panel.operating_hours.enabled) {
          (merged as any).operating_hours = panel.operating_hours;
        }

        return new Response(JSON.stringify({ settings: merged, panel }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "createTicket": {
        const { guildId, categoryId, channelId, creatorId, creatorName, ticketType, answers, applicationType, subject } = data;
        const { data: ticket, error } = await supabase
          .from("tickets")
          .insert({
            guild_id: guildId,
            category_id: categoryId,
            channel_id: channelId,
            creator_id: creatorId,
            creator_name: creatorName,
            subject: subject || null,
            ticket_type: ticketType,
            status: "open",
          })
          .select()
          .single();
        
        if (error) throw error;

        // If this is an application-type ticket, also insert into applications table
        if (ticketType === "application") {
          const { error: appError } = await supabase
            .from("applications")
            .insert({
              guild_id: guildId,
              ticket_id: ticket.id,
              discord_user_id: creatorId,
              discord_username: creatorName,
              application_type: applicationType || "whitelist",
              status: "pending",
              answers: answers || [],
            });
          
          if (appError) {
            console.error("Failed to create application record:", appError);
          }
        }

        return new Response(JSON.stringify({ ticket }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getOpenTicketForUser": {
        const { guildId, categoryId, creatorId } = data;
        const { data: ticket, error } = await supabase
          .from("tickets")
          .select("id, channel_id, status, subject, created_at")
          .eq("guild_id", guildId)
          .eq("category_id", categoryId)
          .eq("creator_id", creatorId)
          .in("status", ["open", "claimed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return new Response(JSON.stringify({ ticket: ticket || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "claimTicket": {
        const { channelId, claimedById, claimedByName } = data;

        const { data: current, error: currentError } = await supabase
          .from("tickets")
          .select("id, status, claimed_by_id, claimed_by_name")
          .eq("channel_id", channelId)
          .maybeSingle();

        if (currentError) throw currentError;
        if (!current) {
          return new Response(JSON.stringify({ error: "Ticket not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (current.status === "closed") {
          return new Response(JSON.stringify({ error: "Ticket is closed" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (current.claimed_by_id && current.claimed_by_id !== claimedById) {
          return new Response(JSON.stringify({
            error: `Ticket is already claimed by ${current.claimed_by_name || current.claimed_by_id}`,
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("tickets")
          .update({
            claimed_by_id: claimedById,
            claimed_by_name: claimedByName,
            status: "claimed",
          })
          .eq("channel_id", channelId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unclaimTicket": {
        const { channelId } = data;
        const { error } = await supabase
          .from("tickets")
          .update({
            claimed_by_id: null,
            claimed_by_name: null,
            status: "open",
          })
          .eq("channel_id", channelId)
          .neq("status", "closed");

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "saveMessage": {
        const { ticketChannelId, authorId, authorName, authorAvatar, content, attachments } = data;
        // Find ticket by channel_id
        const { data: msgTicket, error: msgTicketErr } = await supabase
          .from("tickets")
          .select("id")
          .eq("channel_id", ticketChannelId)
          .maybeSingle();
        
        if (msgTicketErr || !msgTicket) {
          return new Response(JSON.stringify({ success: false, error: "Ticket not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: msgErr } = await supabase
          .from("ticket_messages")
          .insert({
            ticket_id: msgTicket.id,
            author_id: authorId,
            author_name: authorName,
            author_avatar: authorAvatar || null,
            content: content || "",
            attachments: attachments || null,
          });

        if (msgErr) throw msgErr;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "closeTicket": {
        const { channelId, closedById, closedByName } = data;
        
        // First get the ticket and its messages for transcript
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .select("*, ticket_messages(*)")
          .eq("channel_id", channelId)
          .single();
        
        if (ticketError) throw ticketError;

        if (ticket.status === "closed") {
          return new Response(JSON.stringify({ success: true, ticket_id: ticket.id, already_closed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update ticket status
        const { error } = await supabase
          .from("tickets")
          .update({
            closed_by_id: closedById,
            closed_by_name: closedByName,
            closed_at: new Date().toISOString(),
            status: "closed",
          })
          .eq("channel_id", channelId);
        
        if (error) throw error;

        // Check if transcript channel is configured
        const { data: settings } = await supabase
          .from("ticket_settings")
          .select("transcript_channel_id, enable_transcripts")
          .eq("guild_id", ticket.guild_id)
          .maybeSingle();

        if (settings?.transcript_channel_id && settings.enable_transcripts !== false) {
          try {
            const botToken = await getBotTokenForGuild(supabase, ticket.guild_id);
            const messages = ticket.ticket_messages || [];
            const messageCount = messages.length;
            const createdAt = new Date(ticket.created_at);
            const closedAt = new Date();
            const duration = Math.round((closedAt.getTime() - createdAt.getTime()) / (1000 * 60)); // minutes

            // Build transcript preview (last 10 messages)
            const recentMessages = messages
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .slice(-10)
              .map((m: any) => `**${m.author_name || m.author_id}:** ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`)
              .join('\n');

            const embed = {
              title: `📝 Ticket Transcript`,
              description: `Ticket from **${ticket.creator_name || ticket.creator_id}** has been closed.`,
              color: 0x5865F2,
              fields: [
                { name: "Type", value: ticket.ticket_type === "application" ? "Application" : "Support", inline: true },
                { name: "Messages", value: String(messageCount), inline: true },
                { name: "Duration", value: `${duration} min`, inline: true },
                { name: "Created", value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`, inline: true },
                { name: "Closed by", value: closedByName || closedById, inline: true },
                ...(recentMessages ? [{ name: "Recent messages", value: recentMessages.slice(0, 1024), inline: false }] : []),
              ],
              timestamp: closedAt.toISOString(),
            };

            await discordApi(`/channels/${settings.transcript_channel_id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ embeds: [embed] }),
            }, botToken);

            console.log(`Transcript sent to channel ${settings.transcript_channel_id}`);
          } catch (transcriptError) {
            console.error("Failed to send transcript:", transcriptError);
          }
        }

        return new Response(JSON.stringify({ success: true, ticket_id: ticket.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getTicket": {
        const { channelId } = data;
        const { data: ticket, error: ticketErr } = await supabase
          .from("tickets")
          .select("id, channel_id, creator_id, creator_name, status, ticket_type, category_id, claimed_by_id, claimed_by_name, ticket_categories(staff_role_id, name)")
          .eq("channel_id", channelId)
          .maybeSingle();

        if (ticketErr) throw ticketErr;
        // Map creator_id to creator_discord_id for the bot handler
        const mapped = ticket ? { ...ticket, creator_discord_id: ticket.creator_id } : null;
        return new Response(JSON.stringify({ ticket: mapped }), {
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


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/bot-tickets')({
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
