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

async function discordApi(path: string, init: RequestInit) {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN secret");

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
        const { guildId } = data;
        const { data: settings } = await supabase
          .from("ticket_settings")
          .select("*")
          .eq("guild_id", guildId)
          .maybeSingle();
        
        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "createTicket": {
        const { guildId, categoryId, channelId, creatorId, creatorName, ticketType, answers, applicationType } = data;
        const { data: ticket, error } = await supabase
          .from("tickets")
          .insert({
            guild_id: guildId,
            category_id: categoryId,
            channel_id: channelId,
            creator_id: creatorId,
            creator_name: creatorName,
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

      case "claimTicket": {
        const { channelId, claimedById, claimedByName } = data;
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
          .select("transcript_channel_id")
          .eq("guild_id", ticket.guild_id)
          .maybeSingle();

        if (settings?.transcript_channel_id) {
          try {
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
            });

            console.log(`Transcript sent to channel ${settings.transcript_channel_id}`);
          } catch (transcriptError) {
            console.error("Failed to send transcript:", transcriptError);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getTicket": {
        const { channelId } = data;
        const { data: ticket, error: ticketErr } = await supabase
          .from("tickets")
          .select("id, channel_id, creator_id, creator_name, status, ticket_type")
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
