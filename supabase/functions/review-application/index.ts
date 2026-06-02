import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ReviewStatus = "approved" | "denied";

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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await supabaseAuthed.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("getClaims failed", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewerUserId = claimsData.claims.sub;
    const reviewerDisplay =
      (claimsData.claims.email as string | undefined) ??
      (claimsData.claims.user_metadata?.full_name as string | undefined) ??
      "Staff";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body.applicationId || "").trim();
    const status = String(body.status || "").trim() as ReviewStatus;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const sendDm = body.sendDm === true;
    const closeTicket = body.closeTicket !== false; // default true
    const roleId = typeof body.roleId === "string" ? body.roleId.trim() : null; // Per-application role override

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status !== "approved" && status !== "denied") {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch application
    const { data: application, error: appError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();
    if (appError) throw appError;
    if (!application) throw new Error("Application not found");

    // Verify reviewer can manage this guild
    const { data: reviewerGuild, error: reviewerGuildError } = await supabaseAdmin
      .from("user_guilds")
      .select("discord_user_id, has_admin_permission")
      .eq("guild_id", application.guild_id)
      .eq("user_id", reviewerUserId)
      .maybeSingle();

    if (reviewerGuildError) throw reviewerGuildError;
    if (!reviewerGuild?.has_admin_permission) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewerDiscordId = reviewerGuild.discord_user_id ?? null;

    // Update application (we'll add granted_role_id after we know it)
    const reviewedAt = new Date().toISOString();

    // Determine the effective role first so we can store it
    let effectiveRoleId: string | null = null;
    if (status === "approved") {
      const { data: guild } = await supabaseAdmin
        .from("guilds")
        .select("guild_id, whitelist_role_id")
        .eq("id", application.guild_id)
        .maybeSingle();
      effectiveRoleId = roleId || guild?.whitelist_role_id || null;
    }

    const { data: updatedApplication, error: updateError } = await supabaseAdmin
      .from("applications")
      .update({
        status,
        reviewer_notes: notes || null,
        reviewed_at: reviewedAt,
        reviewer_name: reviewerDisplay,
        reviewer_discord_id: reviewerDiscordId,
        granted_role_id: status === "approved" ? effectiveRoleId : null,
      })
      .eq("id", applicationId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    // Get ticket channel_id for posting status message
    let ticketChannelId: string | null = null;
    if (application.ticket_id) {
      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from("tickets")
        .select("channel_id")
        .eq("id", application.ticket_id)
        .maybeSingle();
      if (ticketError) {
        console.error("Failed to fetch ticket", ticketError);
      } else {
        ticketChannelId = ticket?.channel_id ?? null;
      }
    }

    // Close ticket (so it becomes obvious in ticket view)
    if (closeTicket && application.ticket_id) {
      const { error: closeErr } = await supabaseAdmin
        .from("tickets")
        .update({
          status: "closed",
          closed_at: reviewedAt,
          closed_by_id: reviewerDiscordId,
          closed_by_name: reviewerDisplay,
        })
        .eq("id", application.ticket_id);
      if (closeErr) console.error("Failed to close ticket", closeErr);
    }

    const effects: Record<string, unknown> = {};

    // On approve: give role (use per-application roleId if provided, else fallback to guild default)
    if (status === "approved") {
      const { data: guild, error: guildError } = await supabaseAdmin
        .from("guilds")
        .select("guild_id")
        .eq("id", application.guild_id)
        .maybeSingle();

      if (guildError) {
        console.error("Failed to load guild", guildError);
      } else if (guild?.guild_id && effectiveRoleId) {
        await discordApi(
          `/guilds/${guild.guild_id}/members/${application.discord_user_id}/roles/${effectiveRoleId}`,
          { method: "PUT" },
        );
        effects.roleGranted = true;
        effects.roleId = effectiveRoleId;
      } else {
        effects.roleGranted = false;
        effects.roleGrantReason = "No role selected or configured";
      }
    }

    // On deny: optionally send DM
    if (status === "denied" && sendDm) {
      try {
        const dm = await discordApi(`/users/@me/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_id: application.discord_user_id }),
        });

        const content =
          notes && notes.length > 0
            ? `Your application has been denied.\n\nReason:\n${notes}`
            : `Your application has been denied.`;

        await discordApi(`/channels/${dm.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        effects.dmSent = true;
      } catch (e) {
        console.error("Failed to send denial DM", e);
        effects.dmSent = false;
        effects.dmError = e instanceof Error ? e.message : "Unknown error";
      }
    }

    // Send status message to ticket channel
    if (ticketChannelId) {
      try {
        const statusEmoji = status === "approved" ? "✅" : "❌";
        const statusText = status === "approved" ? "APPROVED" : "DENIED";
        const roleInfo = status === "approved" && effects.roleGranted && effects.roleId 
          ? `\n🎭 Role assigned: <@&${effects.roleId}>` 
          : "";
        
        const embed = {
          title: `${statusEmoji} Application ${statusText}`,
          description: `<@${application.discord_user_id}>'s application has been reviewed.`,
          color: status === "approved" ? 0x22c55e : 0xef4444,
          fields: [
            {
              name: "Status",
              value: statusText,
              inline: true,
            },
            {
              name: "Reviewed by",
              value: reviewerDiscordId ? `<@${reviewerDiscordId}>` : reviewerDisplay,
              inline: true,
            },
            ...(notes ? [{
              name: "Note",
              value: notes,
              inline: false,
            }] : []),
            ...(roleInfo ? [{
              name: "Role",
              value: effects.roleId ? `<@&${effects.roleId}>` : "None",
              inline: true,
            }] : []),
          ],
          timestamp: reviewedAt,
        };

        await discordApi(`/channels/${ticketChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        });

        effects.ticketMessageSent = true;
      } catch (e) {
        console.error("Failed to send ticket status message", e);
        effects.ticketMessageSent = false;
        effects.ticketMessageError = e instanceof Error ? e.message : "Unknown error";
      }
    }

    return new Response(
      JSON.stringify({ application: updatedApplication, effects }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("review-application error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
