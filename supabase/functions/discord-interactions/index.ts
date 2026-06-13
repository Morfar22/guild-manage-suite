import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Discord interaction types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
};

// Text input styles for modal
const TextInputStyle = {
  SHORT: 1,
  PARAGRAPH: 2,
};

// Verify Discord signature using tweetnacl
async function verifyDiscordSignature(
  request: Request,
  body: string
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");

  if (!signature || !timestamp || !publicKey) {
    // If this triggers, Discord will show "This interaction failed".
    // We log what is missing to diagnose endpoint/proxy/header stripping issues.
    const headerKeys: string[] = [];
    try {
      for (const [k] of request.headers) headerKeys.push(k);
    } catch (_e) {
      // ignore
    }

    const userAgent = request.headers.get("user-agent");
    const contentType = request.headers.get("content-type");
    const bodySnippet = typeof body === "string" ? body.slice(0, 300) : "";

    // NOTE: Use a single JSON string to ensure the object shows up clearly in Edge logs.
    console.error(
      JSON.stringify(
        {
          msg: "Missing signature, timestamp, or public key",
          url: request.url,
          method: request.method,
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          hasPublicKey: !!publicKey,
          publicKeyLen: publicKey ? publicKey.length : 0,
          userAgent,
          contentType,
          headerKeys,
          bodySnippet,
        },
        null,
        2
      )
    );
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(timestamp + body);

    // Convert hex public key to Uint8Array
    const keyBytes = new Uint8Array(
      publicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Convert hex signature to Uint8Array
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Verify the signature
    const isValid = nacl.sign.detached.verify(message, signatureBytes, keyBytes);

    console.log("Signature verification result:", isValid);
    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

function waitUntil(promise: Promise<unknown>) {
  // Supabase Edge Runtime exposes EdgeRuntime.waitUntil for background work.
  // Fallback keeps behavior in local/unknown runtimes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const er = (globalThis as any)?.EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(promise);
    return;
  }
  // last resort
  promise.catch((e) => console.error("Background task failed:", e));
}

function deferredEphemeral(content: string): Response {
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        flags: 64,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

async function sendFollowupEphemeral(interaction: any, content: string) {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  if (!applicationId || !token) {
    console.error("Missing application_id or token for followup");
    return;
  }

  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, flags: 64 }),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Failed to send follow-up:", res.status, t);
  }
}

function simpleDecrypt(encoded: string, key: string): string {
  const decoded = atob(encoded);
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotTokenForGuild(innerSupabase: any, discordGuildId: string): Promise<string> {
  let botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;

  const { data: guildRow } = await innerSupabase
    .from("guilds")
    .select("id")
    .eq("guild_id", discordGuildId)
    .maybeSingle();

  if (!guildRow) return botToken;

  const { data: customBot } = await innerSupabase
    .from("guild_bot_settings")
    .select("bot_token_encrypted, is_custom_bot, is_active")
    .eq("guild_id", guildRow.id)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  if (customBot?.bot_token_encrypted) {
    const encKey = Deno.env.get("BOT_SECRET_KEY") || "default-encryption-key";
    botToken = simpleDecrypt(customBot.bot_token_encrypted, encKey);
  }

  return botToken;
}

function getGiveawayEntries(entries: unknown): string[] {
  return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === "string") : [];
}

function getGiveawayWinners(winners: unknown): string[] {
  return Array.isArray(winners) ? winners.filter((winner): winner is string => typeof winner === "string") : [];
}

function buildGiveawayMessagePayload(giveaway: any) {
  const entries = getGiveawayEntries(giveaway.entries);
  const winners = getGiveawayWinners(giveaway.winners);
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
      value: winners.length > 0 ? winners.map((winnerId) => `<@${winnerId}>`).join(", ") : "Ingen gyldige deltagere.",
      inline: false,
    });
  }

  return {
    content: hasEnded ? "🎉 Giveawayen er afsluttet." : "Klik på knappen nedenfor for at deltage!",
    embeds: [{
      title: hasEnded ? "🎉 Giveaway afsluttet" : "🎉 Giveaway!",
      description: `**${giveaway.prize}**${giveaway.description ? `\n\n${giveaway.description}` : ""}`,
      color: hasEnded ? 0x57F287 : 0x5865F2,
      fields,
      footer: {
        text: `Giveaway ID: ${giveaway.id}`,
      },
      timestamp: new Date(giveaway.ends_at).toISOString(),
    }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: hasEnded ? 2 : 3,
        custom_id: `giveaway_enter_${giveaway.id}`,
        label: hasEnded ? "Giveaway afsluttet" : `Deltag (${entries.length})`,
        emoji: { name: "🎉" },
        disabled: hasEnded,
      }],
    }],
  };
}

// Show modal with questions for any category (support or application)
async function showTicketModal(
  interaction: any,
  categoryId: string,
  category: any
): Promise<Response> {
  const questions = category.questions || [];
  
  // Build modal components (text inputs) from questions
  const components = questions.slice(0, 5).map((q: any, index: number) => ({
    type: 1, // Action row
    components: [
      {
        type: 4, // Text input
        custom_id: `question_${index}`,
        label: (q.label || `Question ${index + 1}`).substring(0, 45),
        style: q.style === "paragraph" ? TextInputStyle.PARAGRAPH : TextInputStyle.SHORT,
        placeholder: q.placeholder?.substring(0, 100) || "",
        required: q.required !== false,
        min_length: q.required !== false ? 1 : 0,
        max_length: q.style === "paragraph" ? 1024 : 256,
      },
    ],
  }));

  // Include channel_id in custom_id so we have it on modal submit
  const channelId = interaction.channel_id;
  
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.MODAL,
      data: {
        custom_id: `ticket_modal_${categoryId}_${channelId}`,
        title: `${category.emoji || '🎫'} ${category.name}`.substring(0, 45),
        components,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Create a ticket thread (work function - do NOT use as direct interaction response)
async function createTicketThreadWork(
  interaction: any,
  categoryId: string,
  applicationAnswers?: { question: string; answer: string }[]
): Promise<{ threadId: string }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName =
    interaction.member?.user?.username || interaction.user?.username;
  
  // Get channel_id from multiple possible locations
  const interactionChannelId = interaction.channel_id || interaction.channel?.id;

  console.log("Creating ticket for user:", userName, "category:", categoryId, "interactionChannelId:", interactionChannelId);

  // Get the category details
  const { data: category, error: catError } = await supabase
    .from("ticket_categories")
    .select("*, guilds!inner(id, guild_id)")
    .eq("id", categoryId)
    .single();

  if (catError || !category) {
    console.error("Category not found:", catError);
    throw new Error("Category not found");
  }

  // Get ticket settings for this guild
  const { data: settings } = await supabase
    .from("ticket_settings")
    .select("*")
    .eq("guild_id", category.guild_id)
    .maybeSingle();

  // Create a private thread in the channel - use settings or fallback to interaction channel
  const channelId = settings?.thread_category_id || interactionChannelId;
  
  if (!channelId) {
    console.error("No channel ID available for thread creation");
    throw new Error("No channel for thread creation");
  }

  // Generate ticket name
  const ticketNumber = Date.now().toString(36).toUpperCase();
  const threadName = `${category.emoji} ${category.name}-${ticketNumber}`;

  try {
    // Create private thread using Discord API
    const threadResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/threads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: threadName.substring(0, 100),
          type: 12, // Private thread
          invitable: false,
        }),
      }
    );

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error("Failed to create thread:", errorText);

      throw new Error(
        "Could not create ticket. Please check that the bot has permission to create threads."
      );
    }

    const thread = await threadResponse.json();
    console.log("Thread created:", thread.id);

    // Add the user to the thread
    await fetch(
      `https://discord.com/api/v10/channels/${thread.id}/thread-members/${userId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    // Build description with application answers if present
    let description = category.welcome_message;
    const isApplication = category.ticket_type === 'application';
    if (applicationAnswers && applicationAnswers.length > 0) {
      description = isApplication ? "**Application received!**\n\n" : "**Ticket Details**\n\n";
      applicationAnswers.forEach((qa) => {
        description += `**${qa.question}**\n${qa.answer}\n\n`;
      });
      description += `---\n${category.welcome_message}`;
    }

    // Build staff role ping content
    let staffPingContent = "";
    if (category.staff_role_id) {
      staffPingContent = `<@&${category.staff_role_id}>`;
    }

    // Send welcome message to the thread
    const welcomeEmbed = {
      title: `${category.emoji} ${category.name}`,
      description,
      color: isApplication ? 0x57F287 : 0x5865f2, // Green for applications
      fields: [
        {
          name: "Created by",
          value: `<@${userId}>`,
          inline: true,
        },
        {
          name: "Status",
          value: "🟢 Open",
          inline: true,
        },
        ...(isApplication ? [{
          name: "Type",
          value: "📝 Application",
          inline: true,
        }] : []),
      ],
      footer: {
        text: `Ticket ID: ${ticketNumber}`,
      },
      timestamp: new Date().toISOString(),
    };

    // Create action buttons for staff - different for applications
    
    const actionRow = {
      type: 1,
      components: isApplication ? [
        {
          type: 2,
          style: 3, // Success (green)
          label: "Approve",
          custom_id: `application_approve_${thread.id}`,
          emoji: { name: "✅" },
        },
        {
          type: 2,
          style: 4, // Danger (red)
          label: "Deny",
          custom_id: `application_deny_${thread.id}`,
          emoji: { name: "❌" },
        },
        {
          type: 2,
          style: 1, // Primary (blue)
          label: "Claim",
          custom_id: `ticket_claim_${thread.id}`,
          emoji: { name: "🙋" },
        },
      ] : [
        {
          type: 2,
          style: 1, // Primary (blue)
          label: "Claim",
          custom_id: `ticket_claim_${thread.id}`,
          emoji: { name: "🙋" },
        },
        {
          type: 2,
          style: 2, // Secondary (gray)
          label: "Close (Archive)",
          custom_id: `ticket_close_${thread.id}`,
          emoji: { name: "📁" },
        },
        {
          type: 2,
          style: 4, // Danger (red)
          label: "Close (Delete)",
          custom_id: `ticket_delete_${thread.id}`,
          emoji: { name: "🗑️" },
        },
      ],
    };
    
    // If this is an application, save it to the applications table
    if (isApplication && applicationAnswers) {
      await supabase
        .from("applications")
        .insert({
          guild_id: category.guild_id,
          discord_user_id: userId,
          discord_username: userName,
          application_type: category.name.toLowerCase().includes('whitelist') ? 'whitelist' : 
                           category.name.toLowerCase().includes('staff') ? 'staff' : 'other',
          status: 'pending',
          answers: applicationAnswers,
        });
      console.log("Application saved to database");
    }

    // Send welcome embed with staff role ping
    await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: staffPingContent || undefined,
        embeds: [welcomeEmbed],
        components: [actionRow],
        allowed_mentions: {
          roles: category.staff_role_id ? [category.staff_role_id] : [],
        },
      }),
    });

    // Save ticket to database
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        guild_id: category.guild_id,
        category_id: categoryId,
        channel_id: thread.id,
        creator_id: userId,
        creator_name: userName,
        ticket_type: category.ticket_type,
        status: "open",
      })
      .select()
      .single();

    if (ticketError) {
      console.error("Failed to save ticket:", ticketError);
    } else {
      console.log("Ticket saved:", ticket.id);
    }

    return { threadId: thread.id };
  } catch (error) {
    console.error("Error creating ticket:", error);

    throw error;
  }
}

function deferAndCreateTicket(
  interaction: any,
  categoryId: string,
  applicationAnswers?: { question: string; answer: string }[]
): Response {
  // Return immediately so Discord doesn't show "Interaction failed"
  waitUntil(
    (async () => {
      try {
        const { threadId } = await createTicketThreadWork(
          interaction,
          categoryId,
          applicationAnswers
        );
        await sendFollowupEphemeral(
          interaction,
          `✅ Your ticket has been created! View it here: <#${threadId}>`
        );
      } catch (e: any) {
        console.error("Background ticket creation failed:", e);
        const msg =
          typeof e?.message === "string" && e.message.length
            ? e.message
            : "An error occurred. Please try again later.";
        await sendFollowupEphemeral(interaction, `❌ ${msg}`);
      }
    })()
  );

  return deferredEphemeral("⏳ Creating your ticket...");
}

// Handle modal submission for all ticket types
async function handleModalSubmit(interaction: any): Promise<Response> {
  const customId = interaction.data?.custom_id || "";
  
  if (!customId.startsWith("ticket_modal_")) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Unknown form.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse categoryId and channelId from custom_id: ticket_modal_{categoryId}_{channelId}
  const parts = customId.replace("ticket_modal_", "").split("_");
  const categoryId = parts[0];
  const originalChannelId = parts[1];
  
  // Inject the channel_id into interaction if missing (modal submits don't always include it)
  if (!interaction.channel_id && originalChannelId) {
    interaction.channel_id = originalChannelId;
  }
  
  console.log("Modal submit - categoryId:", categoryId, "channelId:", interaction.channel_id);
  
  // Get the category to retrieve questions
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: category } = await supabase
    .from("ticket_categories")
    .select("questions")
    .eq("id", categoryId)
    .single();

  const questions = category?.questions || [];
  
  // Extract answers from modal components
  const answers: { question: string; answer: string }[] = [];
  const components = interaction.data?.components || [];
  
  components.forEach((row: any, index: number) => {
    const input = row.components?.[0];
    if (input) {
      const question = questions[index]?.label || `Question ${index + 1}`;
      answers.push({
        question,
        answer: input.value || "(No answer)",
      });
    }
  });

  console.log("Application answers:", answers);

  // Create the ticket with answers
  return deferAndCreateTicket(interaction, categoryId, answers);
}

// Handle claim ticket
async function handleClaimTicket(
  interaction: any,
  threadId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName =
    interaction.member?.user?.username || interaction.user?.username;

  // Update ticket in database
  const { error } = await supabase
    .from("tickets")
    .update({
      claimed_by_id: userId,
      claimed_by_name: userName,
      status: "claimed",
    })
    .eq("channel_id", threadId);

  if (error) {
    console.error("Failed to claim ticket:", error);
  }

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          fields: embed.fields?.map((field: any) =>
            field.name === "Status"
              ? { name: "Status", value: `🟡 Claimed by <@${userId}>`, inline: true }
              : field
          ),
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 2, // Secondary (gray)
                label: `Claimed by ${userName}`,
                custom_id: "ticket_claimed_disabled",
                disabled: true,
                emoji: { name: "🙋" },
              },
              {
                type: 2,
                style: 2,
                label: "Close (Archive)",
                custom_id: `ticket_close_${threadId}`,
                emoji: { name: "📁" },
              },
              {
                type: 2,
                style: 4,
                label: "Close (Delete)",
                custom_id: `ticket_delete_${threadId}`,
                emoji: { name: "🗑️" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle close ticket (archive or delete)
async function handleCloseTicket(
  interaction: any,
  threadId: string,
  deleteThread: boolean = false
): Promise<Response> {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName = interaction.member?.user?.username || interaction.user?.username;

  // Use waitUntil to keep the edge function alive for background work
  waitUntil((async () => {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

      // Get ticket data first (for transcript)
      const { data: ticket } = await supabase
        .from("tickets")
        .select("*, ticket_messages(*)")
        .eq("channel_id", threadId)
        .single();

      // Update ticket in database
      await supabase
        .from("tickets")
        .update({
          closed_by_id: userId,
          closed_by_name: userName,
          closed_at: new Date().toISOString(),
          status: "closed",
        })
        .eq("channel_id", threadId);

      // Send transcript if configured
      if (ticket) {
        const { data: settings } = await supabase
          .from("ticket_settings")
          .select("transcript_channel_id")
          .eq("guild_id", ticket.guild_id)
          .maybeSingle();

        if (settings?.transcript_channel_id) {
          const messages = ticket.ticket_messages || [];
          const messageCount = messages.length;
          const createdAt = new Date(ticket.created_at);
          const closedAt = new Date();
          const durationMin = Math.round((closedAt.getTime() - createdAt.getTime()) / (1000 * 60));

          const recentMessages = messages
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-10)
            .map((m: any) => `**${m.author_name || m.author_id}:** ${(m.content || "").slice(0, 100)}${(m.content || "").length > 100 ? "..." : ""}`)
            .join("\n");

          const transcriptEmbed = {
            title: "📝 Ticket Transcript",
            description: `Ticket from **${ticket.creator_name || ticket.creator_id}** has been closed.`,
            color: 0x5865F2,
            fields: [
              { name: "Type", value: ticket.ticket_type === "application" ? "Application" : "Support", inline: true },
              { name: "Messages", value: String(messageCount), inline: true },
              { name: "Duration", value: `${durationMin} min`, inline: true },
              { name: "Created", value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`, inline: true },
              { name: "Closed by", value: userName || userId, inline: true },
              ...(recentMessages ? [{ name: "Recent messages", value: recentMessages.slice(0, 1024), inline: false }] : []),
            ],
            timestamp: closedAt.toISOString(),
          };

          const transcriptRes = await fetch(`https://discord.com/api/v10/channels/${settings.transcript_channel_id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [transcriptEmbed] }),
          });

          if (!transcriptRes.ok) {
            const errText = await transcriptRes.text();
            console.error("Failed to send transcript:", transcriptRes.status, errText);
          } else {
            await transcriptRes.text();
            console.log(`Transcript sent to channel ${settings.transcript_channel_id}`);
          }
        }
      }

      // Archive or delete the thread
      if (deleteThread) {
        const deleteRes = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (!deleteRes.ok) {
          await deleteRes.text();
          const fallbackRes = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
            method: "PATCH",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true, locked: true }),
          });
          await fallbackRes.text();
        } else {
          await deleteRes.text();
        }
      } else {
        const archiveRes = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true, locked: true }),
        });
        await archiveRes.text();
      }
    } catch (e) {
      console.error("Error in close ticket background work:", e);
    }
  })());

  // Return immediate response to Discord
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          color: 0xed4245,
          fields: embed.fields?.map((field: any) =>
            field.name === "Status"
              ? { name: "Status", value: `🔴 Closed by <@${userId}>`, inline: true }
              : field
          ),
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                label: "Ticket Closed",
                custom_id: "ticket_closed_disabled",
                disabled: true,
                emoji: { name: "🔒" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle approve application
async function handleApproveApplication(
  interaction: any,
  threadId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const reviewerId = interaction.member?.user?.id || interaction.user?.id;
  const reviewerName = interaction.member?.user?.username || interaction.user?.username;
  const guildId = interaction.guild_id;

  // Get the ticket to find the creator
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, ticket_categories(*), guilds(*)")
    .eq("channel_id", threadId)
    .single();

  if (!ticket) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Could not find ticket.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Update application status
  await supabase
    .from("applications")
    .update({
      status: "approved",
      reviewer_discord_id: reviewerId,
      reviewer_name: reviewerName,
      reviewed_at: new Date().toISOString(),
    })
    .eq("discord_user_id", ticket.creator_id)
    .eq("guild_id", ticket.guild_id)
    .eq("status", "pending");

  // Assign whitelist role if configured
  const whitelistRoleId = ticket.guilds?.whitelist_role_id;
  if (whitelistRoleId && ticket.creator_id) {
    try {
      await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${ticket.creator_id}/roles/${whitelistRoleId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );
      console.log("Whitelist role assigned to user:", ticket.creator_id);
    } catch (e) {
      console.error("Failed to assign role:", e);
    }
  }

  // Update ticket status
  await supabase
    .from("tickets")
    .update({
      closed_by_id: reviewerId,
      closed_by_name: reviewerName,
      closed_at: new Date().toISOString(),
      status: "closed",
    })
    .eq("channel_id", threadId);

  // Send approval message
  await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [{
        title: "✅ Application Approved",
        description: `Congratulations <@${ticket.creator_id}>! Your application has been approved by <@${reviewerId}>.${whitelistRoleId ? "\n\nYou have been granted the whitelist role!" : ""}`,
        color: 0x57F287,
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  // Archive thread
  await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ archived: true, locked: true }),
  });

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          color: 0x57F287,
          fields: embed.fields?.map((field: any) =>
            field.name === "Status"
              ? { name: "Status", value: `✅ Approved by <@${reviewerId}>`, inline: true }
              : field
          ),
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "Approved",
                custom_id: "application_approved_disabled",
                disabled: true,
                emoji: { name: "✅" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle deny application
async function handleDenyApplication(
  interaction: any,
  threadId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const reviewerId = interaction.member?.user?.id || interaction.user?.id;
  const reviewerName = interaction.member?.user?.username || interaction.user?.username;

  // Get the ticket to find the creator
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", threadId)
    .single();

  if (!ticket) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Could not find ticket.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Update application status
  await supabase
    .from("applications")
    .update({
      status: "denied",
      reviewer_discord_id: reviewerId,
      reviewer_name: reviewerName,
      reviewed_at: new Date().toISOString(),
    })
    .eq("discord_user_id", ticket.creator_id)
    .eq("guild_id", ticket.guild_id)
    .eq("status", "pending");

  // Update ticket status
  await supabase
    .from("tickets")
    .update({
      closed_by_id: reviewerId,
      closed_by_name: reviewerName,
      closed_at: new Date().toISOString(),
      status: "closed",
    })
    .eq("channel_id", threadId);

  // Send denial message
  await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [{
        title: "❌ Application Denied",
        description: `<@${ticket.creator_id}>, your application has unfortunately been denied by <@${reviewerId}>.\n\nYou are welcome to apply again at a later time.`,
        color: 0xED4245,
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  // Archive thread
  await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ archived: true, locked: true }),
  });

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          color: 0xED4245,
          fields: embed.fields?.map((field: any) =>
            field.name === "Status"
              ? { name: "Status", value: `❌ Denied by <@${reviewerId}>`, inline: true }
              : field
          ),
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4,
                label: "Denied",
                custom_id: "application_denied_disabled",
                disabled: true,
                emoji: { name: "❌" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle modmail claim button
async function handleModmailClaim(interaction: any): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const channelId = interaction.channel_id;
  const claimedById = interaction.member?.user?.id || interaction.user?.id;
  const claimedByName = interaction.member?.user?.username || interaction.user?.username;

  console.log(`[Modmail] Claiming thread in channel ${channelId} by ${claimedByName}`);

  // First get the thread
  const { data: thread, error: threadError } = await supabase
    .from("modmail_threads")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (threadError || !thread) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Kunne ikke finde modmail-tråden.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (thread.claimed_by_id) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ Denne modmail er allerede claimed af ${thread.claimed_by_name}.`,
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Update thread with claim info
  const { error: updateError } = await supabase
    .from("modmail_threads")
    .update({
      claimed_by_id: claimedById,
      claimed_by_name: claimedByName,
    })
    .eq("id", thread.id);

  if (updateError) {
    console.error("[Modmail] Error claiming thread:", updateError);
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Der opstod en fejl ved claim af modmail.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[Modmail] Thread claimed successfully by ${claimedByName}`);

  // Get embeds from interaction message, or create empty array if not present
  const embeds = interaction.message?.embeds || [];

  // Update the message with disabled claim button
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 2, // Secondary (gray)
                label: `Claimed by ${claimedByName}`,
                custom_id: "modmail_claimed_disabled",
                disabled: true,
                emoji: { name: "🙋" },
              },
              {
                type: 2,
                style: 4,
                label: "Close",
                custom_id: "modmail_close",
                emoji: { name: "🔒" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle modmail close button
async function handleModmailClose(interaction: any): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const channelId = interaction.channel_id;

  console.log(`[Modmail] Closing thread in channel ${channelId}`);

  // Get the thread with guild info
  const { data: thread, error: threadError } = await supabase
    .from("modmail_threads")
    .select("*, guilds!inner(id)")
    .eq("channel_id", channelId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (threadError || !thread) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Denne modmail er allerede lukket eller kunne ikke findes.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Get close message from settings
  const { data: settings } = await supabase
    .from("modmail_settings")
    .select("close_message")
    .eq("guild_id", thread.guild_id)
    .limit(1)
    .maybeSingle();

  // Update thread status
  const { error: updateError } = await supabase
    .from("modmail_threads")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", thread.id);

  if (updateError) {
    console.error("[Modmail] Error closing thread:", updateError);
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Der opstod en fejl ved lukning af modmail.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Try to send close message to user via DM
  if (settings?.close_message && thread.user_id) {
    try {
      // Create DM channel
      const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_id: thread.user_id }),
      });

      if (dmResponse.ok) {
        const dm = await dmResponse.json();
        await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [{
              title: "📬 Modmail Closed",
              description: settings.close_message,
              color: 0xED4245,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      }
    } catch (e) {
      console.log("[Modmail] Could not send close message to user:", e);
    }
  }

  // Delete the modmail channel
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  } catch (e) {
    console.error("[Modmail] Could not delete channel:", e);
  }

  // Return ephemeral confirmation (channel might be deleted before this shows)
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ Modmail lukket.",
        flags: 64,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// NEW APPLICATION SYSTEM: Handle submission approve from log channel buttons
async function handleSubmissionApprove(
  interaction: any,
  submissionId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const reviewerId = interaction.member?.user?.id || interaction.user?.id;
  const reviewerName = interaction.member?.user?.username || interaction.user?.username;
  const guildId = interaction.guild_id;

  // Quick check - just verify submission exists and is pending
  const { data: submission, error: submissionError } = await supabase
    .from("application_submissions")
    .select("id, status, discord_user_id, guild_id, form:application_forms(name, emoji, granted_role_id, approval_channel_id)")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Application not found.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (submission.status !== "pending") {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ This application has already been processed.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const form = submission.form as unknown as { name: string; emoji: string | null; granted_role_id: string | null; approval_channel_id: string | null };

  // Do heavy work in background - MUST return response within 3 seconds
  waitUntil(
    (async () => {
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      
      try {
        // Update submission status
        await supabase
          .from("application_submissions")
          .update({
            status: "approved",
            reviewer_discord_id: reviewerId,
            reviewer_name: reviewerName,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        // Grant role if configured
        if (form.granted_role_id && submission.discord_user_id) {
          try {
            const roleRes = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${submission.discord_user_id}/roles/${form.granted_role_id}`,
              {
                method: "PUT",
                headers: { Authorization: `Bot ${botToken}` },
              }
            );
            if (roleRes.ok) {
              console.log("Role granted to user:", submission.discord_user_id);
            } else {
              console.error("Failed to grant role:", await roleRes.text());
            }
          } catch (e) {
            console.error("Failed to grant role:", e);
          }
        }

        // Get settings for DM
        const { data: settings } = await supabase
          .from("application_settings")
          .select("*")
          .eq("guild_id", submission.guild_id)
          .maybeSingle();

        // Send DM to user if enabled
        if (settings?.dm_on_approval) {
          try {
            const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ recipient_id: submission.discord_user_id }),
            });

            if (dmChannelRes.ok) {
              const dmChannel = await dmChannelRes.json();
              let message = settings.approval_message || "Congratulations! Your application has been approved.";
              message = message
                .replace(/{form_name}/g, form.name)
                .replace(/{user}/g, `<@${submission.discord_user_id}>`);

              await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  embeds: [{
                    title: "✅ Application Approved",
                    description: message,
                    color: 0x57F287,
                    timestamp: new Date().toISOString(),
                  }],
                }),
              });
            }
          } catch (e) {
            console.error("Failed to send approval DM:", e);
          }
        }

        // Post to approval channel if configured
        if (form.approval_channel_id) {
          try {
            await fetch(`https://discord.com/api/v10/channels/${form.approval_channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                embeds: [{
                  title: `${form.emoji || "📝"} ${form.name} Approved`,
                  description: `<@${submission.discord_user_id}> has been approved!`,
                  color: 0x57F287,
                  footer: { text: `Approved by ${reviewerName}` },
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
          } catch (e) {
            console.error("Failed to post to approval channel:", e);
          }
        }
      } catch (e) {
        console.error("Background approve work failed:", e);
      }
    })()
  );

  // Return immediate UPDATE_MESSAGE response to satisfy Discord's 3-second limit
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          color: 0x57F287, // Green
          title: embed.title?.replace("📥", "✅") || "✅ Approved",
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: `Approved by ${reviewerName}`,
                custom_id: "submission_approved_disabled",
                disabled: true,
                emoji: { name: "✅" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// NEW APPLICATION SYSTEM: Handle submission deny from log channel buttons
async function handleSubmissionDeny(
  interaction: any,
  submissionId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const reviewerId = interaction.member?.user?.id || interaction.user?.id;
  const reviewerName = interaction.member?.user?.username || interaction.user?.username;

  // Quick check - just verify submission exists and is pending
  const { data: submission, error: submissionError } = await supabase
    .from("application_submissions")
    .select("id, status, discord_user_id, guild_id, form:application_forms(name, emoji, denial_channel_id)")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Application not found.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (submission.status !== "pending") {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ This application has already been processed.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const form = submission.form as unknown as { name: string; emoji: string | null; denial_channel_id: string | null };

  // Do heavy work in background - MUST return response within 3 seconds
  waitUntil(
    (async () => {
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      
      try {
        // Update submission status
        await supabase
          .from("application_submissions")
          .update({
            status: "denied",
            reviewer_discord_id: reviewerId,
            reviewer_name: reviewerName,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        // Get settings for DM
        const { data: settings } = await supabase
          .from("application_settings")
          .select("*")
          .eq("guild_id", submission.guild_id)
          .maybeSingle();

        // Send DM to user if enabled
        if (settings?.dm_on_denial) {
          try {
            const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ recipient_id: submission.discord_user_id }),
            });

            if (dmChannelRes.ok) {
              const dmChannel = await dmChannelRes.json();
              let message = settings.denial_message || "Unfortunately, your application has been denied.";
              message = message
                .replace(/{form_name}/g, form.name)
                .replace(/{user}/g, `<@${submission.discord_user_id}>`);

              await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  embeds: [{
                    title: "❌ Application Denied",
                    description: message,
                    color: 0xED4245,
                    timestamp: new Date().toISOString(),
                  }],
                }),
              });
            }
          } catch (e) {
            console.error("Failed to send denial DM:", e);
          }
        }

        // Post to denial channel if configured
        if (form.denial_channel_id) {
          try {
            await fetch(`https://discord.com/api/v10/channels/${form.denial_channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                embeds: [{
                  title: `${form.emoji || "📝"} ${form.name} Afvist`,
                  description: `<@${submission.discord_user_id}> er blevet afvist.`,
                  color: 0xED4245,
                  footer: { text: `Afvist af ${reviewerName}` },
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
          } catch (e) {
            console.error("Failed to post to denial channel:", e);
          }
        }
      } catch (e) {
        console.error("Background deny work failed:", e);
      }
    })()
  );

  // Return immediate UPDATE_MESSAGE response to satisfy Discord's 3-second limit
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: interaction.message.embeds.map((embed: any) => ({
          ...embed,
          color: 0xED4245, // Red
          title: embed.title?.replace("📥", "❌") || "❌ Denied",
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4,
                label: `Denied by ${reviewerName}`,
                custom_id: "submission_denied_disabled",
                disabled: true,
                emoji: { name: "❌" },
              },
            ],
          },
        ],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}


async function handleApplicationStart(
  interaction: any,
  formId: string
): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const guildId = interaction.guild_id;

  // Get guild internal ID
  const { data: guild } = await supabase
    .from("guilds")
    .select("id")
    .eq("guild_id", guildId)
    .single();

  if (!guild) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Server not configured.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Get form with questions
  const { data: form } = await supabase
    .from("application_forms")
    .select("*")
    .eq("id", formId)
    .eq("guild_id", guild.id)
    .eq("enabled", true)
    .single();

  if (!form) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Application form not found or not active.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const questions = (form.questions || []) as any[];

  // If no questions, just acknowledge
  if (questions.length === 0) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ This application has no questions configured.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Build modal with questions (Discord max 5 text inputs per modal)
  const modalComponents = questions.slice(0, 5).map((q: any, index: number) => ({
    type: 1, // Action row
    components: [
      {
        type: 4, // Text input
        custom_id: String(q.id || `question_${index}`).substring(0, 100),
        label: String(q.label || "Question").substring(0, 45),
        style: q.type === "long" ? TextInputStyle.PARAGRAPH : TextInputStyle.SHORT,
        ...(typeof q.placeholder === "string" && q.placeholder.length > 0
          ? { placeholder: q.placeholder.substring(0, 100) }
          : {}),
        required: q.required !== false,
        min_length: q.required !== false ? 1 : 0,
        max_length: q.type === "long" ? 1024 : 256,
      },
    ],
  }));

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.MODAL,
      data: {
        custom_id: `application_form_${formId}`,
        title: `${form.emoji || "📝"} ${form.name}`.substring(0, 45),
        components: modalComponents,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle application form modal submit
async function handleApplicationFormSubmit(interaction: any): Promise<Response> {
  const customId = interaction.data?.custom_id || "";
  const formId = customId.replace("application_form_", "");

  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName = interaction.member?.user?.username || interaction.user?.username;
  const userAvatar = interaction.member?.user?.avatar || interaction.user?.avatar;
  const avatarUrl = userAvatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png`
    : null;

  if (!formId || !guildId || !userId) {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "❌ Missing application data. Please try again.", flags: 64 },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  waitUntil(
    (async () => {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      try {
        // Get guild internal ID
        const { data: guild } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();

        if (!guild) {
          await sendFollowupEphemeral(interaction, "❌ Server not configured.");
          return;
        }

        // Get form to retrieve question labels
        const { data: form } = await supabase
          .from("application_forms")
          .select("*")
          .eq("id", formId)
          .eq("guild_id", guild.id)
          .single();

        if (!form) {
          await sendFollowupEphemeral(interaction, "❌ Form not found.");
          return;
        }

        const formQuestions = Array.isArray(form.questions) ? form.questions as any[] : [];

        // Extract answers from modal
        const components = interaction.data?.components || [];
        const answers: { question: string; answer: string }[] = [];

        components.forEach((row: any) => {
          const input = row.components?.[0];
          if (!input) return;

          const questionDef = formQuestions.find((q: any) => q.id === input.custom_id);
          answers.push({
            question: questionDef?.label || input.custom_id,
            answer: input.value || "(No answer)",
          });
        });

        // Save submission to database
        const { data: submission, error: submitError } = await supabase
          .from("application_submissions")
          .insert({
            guild_id: guild.id,
            form_id: formId,
            discord_user_id: userId,
            discord_username: userName,
            discord_avatar: avatarUrl,
            answers,
            status: "pending",
          })
          .select()
          .single();

        if (submitError || !submission) {
          console.error("Failed to save application submission:", submitError);
          await sendFollowupEphemeral(interaction, "❌ Could not save your application. Please try again.");
          return;
        }

        // Get application settings for DM
        const { data: settings } = await supabase
          .from("application_settings")
          .select("*")
          .eq("guild_id", guild.id)
          .maybeSingle();

        const botToken = await getBotTokenForGuild(supabase, guildId);

        // Send DM if enabled
        if (settings?.dm_on_submit && botToken) {
          try {
            const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ recipient_id: userId }),
            });

            if (dmChannelRes.ok) {
              const dmChannel = await dmChannelRes.json();
              await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  embeds: [{
                    title: "📝 Application Received",
                    description: `Your application for **${form.name}** has been received and is awaiting review.`,
                    color: 0x5865F2,
                    timestamp: new Date().toISOString(),
                  }],
                }),
              });
            }
          } catch (e) {
            console.error("Failed to send DM:", e);
          }
        }

        // Log to log channel if configured - include Approve/Deny buttons
        if (settings?.log_channel_id && botToken) {
          try {
            const fieldsEmbed = answers.map((a) => ({
              name: a.question,
              value: a.answer.substring(0, 1024),
              inline: false,
            }));

            const actionRow = {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3,
                  label: "Approve",
                  custom_id: `submission_approve_${submission.id}`,
                  emoji: { name: "✅" },
                },
                {
                  type: 2,
                  style: 4,
                  label: "Deny",
                  custom_id: `submission_deny_${submission.id}`,
                  emoji: { name: "❌" },
                },
              ],
            };

            await fetch(`https://discord.com/api/v10/channels/${settings.log_channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                embeds: [{
                  title: `📥 New Application: ${form.name}`,
                  description: `**Applicant:** <@${userId}> (${userName})`,
                  color: 0xFEE75C,
                  fields: fieldsEmbed.slice(0, 25),
                  thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                  footer: { text: `Submission ID: ${submission.id}` },
                  timestamp: new Date().toISOString(),
                }],
                components: [actionRow],
              }),
            });
          } catch (e) {
            console.error("Failed to log application:", e);
          }
        }

        await sendFollowupEphemeral(
          interaction,
          "✅ Your application has been submitted! You will receive a message when it has been reviewed."
        );
      } catch (error) {
        console.error("Application submit background error:", error);
        await sendFollowupEphemeral(interaction, "❌ Could not save your application. Please try again.");
      }
    })()
  );

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// Handle FiveM slash commands - queue for FiveM server execution
// Now supports subcommand structure: /fivem <group> <subcommand> <options>
function handleFiveMSlashCommand(
  interaction: any,
  group: string | null,
  subcommand: string,
  subcommandOptions: any[]
): Response {
  // Defer immediately to avoid Discord's 3-second timeout
  waitUntil(
    (async () => {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const guildId = interaction.guild_id;
        const userId = interaction.member?.user?.id || interaction.user?.id;
        const userName = interaction.member?.user?.username || interaction.user?.username;

        const commandData: Record<string, any> = {
          moderatorDiscordId: userId,
          moderatorName: userName,
          group: group || subcommand,
          subcommand,
        };

        for (const opt of subcommandOptions) {
          commandData[opt.name] = opt.value;
        }

        const effectiveCommand = group
          ? `${group}_${subcommand}`
          : commandData.action
            ? String(commandData.action)
            : subcommand;
        const cmdLabel = group ? `/fivem ${group} ${subcommand}` : `/fivem ${subcommand}`;

        console.log("FiveM command:", cmdLabel, "->", effectiveCommand, "options:", JSON.stringify(subcommandOptions));

        // Get internal guild ID
        const { data: guild, error: guildError } = await supabase
          .from("guilds")
          .select("id")
          .eq("guild_id", guildId)
          .single();

        if (guildError || !guild) {
          await sendFollowupEphemeral(interaction, "❌ Guild not configured.");
          return;
        }

        const internalGuildId = guild.id;

        // Map Discord option 'target' / 'id' to 'targetPlayerId'
        if (commandData.target && !commandData.targetPlayerId) {
          commandData.targetPlayerId = commandData.target;
        }
        if (commandData.id) {
          commandData.targetPlayerId = commandData.id;
          delete commandData.id;
        }
        if (!commandData.reason && commandData.message) {
          commandData.reason = commandData.message;
        }

        if (effectiveCommand === "players") {
          const { data: players, error: playersErr } = await supabase
            .from("fivem_online_players")
            .select("player_id, character_name, discord_username, ping")
            .eq("guild_id", internalGuildId)
            .order("player_id", { ascending: true });

          if (playersErr) {
            await sendFollowupEphemeral(interaction, `❌ Kunne ikke hente spillerliste: ${playersErr.message}`);
            return;
          }

          const count = players?.length || 0;
          if (count === 0) {
            await sendFollowupEphemeral(interaction, "👥 **Spillere online:** 0\n\n*Ingen spillere på serveren lige nu.*");
            return;
          }

          const lines = players.map((p: any) => {
            const name = p.character_name || p.discord_username || `Player #${p.player_id}`;
            return `[${p.player_id}] ${name}${p.ping ? ` (${p.ping}ms)` : ""}`;
          });
          let body = lines.join("\n");
          if (body.length > 1800) body = body.slice(0, 1800) + "\n…";
          await sendFollowupEphemeral(interaction, `👥 **Spillere online:** ${count}\n\`\`\`\n${body}\n\`\`\``);
          return;
        }

        if (effectiveCommand === "status") {
          const { data: status } = await supabase
            .from("fivem_server_status")
            .select("is_online, player_count, max_players, uptime_seconds, server_name")
            .eq("guild_id", internalGuildId)
            .order("last_update", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!status) {
            await sendFollowupEphemeral(interaction, "❌ Ingen serverstatus tilgængelig endnu.");
            return;
          }

          const online = status.is_online ? "🟢 Online" : "🔴 Offline";
          const uptime = `${Math.floor((status.uptime_seconds || 0) / 3600)}t ${Math.floor(((status.uptime_seconds || 0) % 3600) / 60)}m`;
          await sendFollowupEphemeral(
            interaction,
            `**${status.server_name || "FiveM Server"}**\n` +
              `Status: ${online}\n` +
              `Spillere: ${status.player_count || 0}/${status.max_players || 64}\n` +
              `Uptime: ${uptime}`
          );
          return;
        }

        // Queue the command for FiveM server
        const { data: queuedRow, error: queueError } = await supabase.from("fivem_command_queue").insert({
          guild_id: internalGuildId,
          command_name: effectiveCommand,
          command_data: commandData,
          target_player_id: commandData.targetPlayerId || null,
          target_discord_id: null,
          target_name: null,
          moderator_discord_id: userId,
          moderator_name: userName,
          status: "pending",
        }).select("id").single();

        if (queueError || !queuedRow?.id) {
          console.error("Error queuing FiveM command:", queueError);
          await sendFollowupEphemeral(interaction, "❌ Failed to queue command.");
          return;
        }

        // Log the action
        await supabase.from("fivem_action_logs").insert({
          guild_id: internalGuildId,
          action_type: effectiveCommand,
          target_discord_id: commandData.targetDiscordId || null,
          target_name: commandData.targetName || null,
          moderator_discord_id: userId,
          moderator_name: userName,
          reason: commandData.reason || null,
          metadata: commandData,
        });

        let resultRow = null;
        for (let i = 0; i < 24; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const { data: row } = await supabase
            .from("fivem_command_queue")
            .select("status, result")
            .eq("id", queuedRow.id)
            .single();
          if (row && row.status !== "pending") {
            resultRow = row;
            break;
          }
        }

        if (!resultRow) {
          await sendFollowupEphemeral(interaction, `⏳ \`${cmdLabel}\` queued, men FiveM-serveren svarede ikke i tide.`);
          return;
        }

        if (resultRow.status === "failed") {
          await sendFollowupEphemeral(interaction, `❌ \`${cmdLabel}\` fejlede: ${resultRow.result || "Ukendt fejl"}`);
          return;
        }

        let responseMessage = `✅ \`${cmdLabel}\` udført`;
        const rawResult = (resultRow.result || "").trim();
        if (rawResult) responseMessage += `\n\`\`\`\n${rawResult.slice(0, 1800)}\n\`\`\``;
        await sendFollowupEphemeral(interaction, responseMessage);
      } catch (e: any) {
        console.error("Background FiveM command failed:", e);
        await sendFollowupEphemeral(interaction, `❌ ${e?.message || "An error occurred."}`);
      }
    })()
  );

  // Return deferred response immediately (within <3 seconds)
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ===== JTC Control Panel Handlers =====

async function verifyJTCOwner(supabase: any, voiceChannelId: string, userId: string) {
  const { data } = await supabase
    .from('jtc_channels')
    .select('*')
    .eq('channel_id', voiceChannelId)
    .maybeSingle();
  if (!data) return { ok: false, reason: 'Denne kanal er ikke en JTC kanal.' };
  if (data.owner_id !== userId) return { ok: false, reason: 'Kun kanalens ejer kan bruge disse kontroller.' };
  return { ok: true, data };
}

function jtcEphemeral(content: string): Response {
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: 64 },
  }), { headers: { "Content-Type": "application/json" } });
}

async function handleJTCControl(interaction: any, customId: string): Promise<Response> {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  
  // Parse action and voice channel ID from custom_id: jtc_{action}_{voiceChannelId}
  const parts = customId.split('_');
  const action = parts[1]; // lock, rename, limit, hide, kick, block, allow
  const voiceChannelId = parts.slice(2).join('_');

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const guildId = interaction.guild_id;

  switch (action) {
    case 'lock': {
      // Toggle lock: deny CONNECT for @everyone
      const channelRes = await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}`, {
        headers: { 'Authorization': `Bot ${botToken}` },
      });
      if (!channelRes.ok) return jtcEphemeral('❌ Kunne ikke hente kanalinfo.');
      const channelData = await channelRes.json();
      
      const overwrites = channelData.permission_overwrites || [];
      const everyoneOverwrite = overwrites.find((o: any) => o.id === guildId);
      // Check if CONNECT (1048576) is denied
      const connectDenied = everyoneOverwrite && (BigInt(everyoneOverwrite.deny || '0') & BigInt(1048576)) !== BigInt(0);
      
      const newDeny = connectDenied
        ? String(BigInt(everyoneOverwrite?.deny || '0') & ~BigInt(1048576)) // Remove CONNECT deny
        : String(BigInt(everyoneOverwrite?.deny || '0') | BigInt(1048576)); // Add CONNECT deny

      await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}/permissions/${guildId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guildId,
          type: 0,
          allow: everyoneOverwrite?.allow || '0',
          deny: newDeny,
        }),
      });

      const isNowLocked = !connectDenied;
      return jtcEphemeral(isNowLocked ? '🔒 Kanalen er nu **låst**. Ingen kan joine.' : '🔓 Kanalen er nu **åben**. Alle kan joine igen.');
    }

    case 'hide': {
      const channelRes = await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}`, {
        headers: { 'Authorization': `Bot ${botToken}` },
      });
      if (!channelRes.ok) return jtcEphemeral('❌ Kunne ikke hente kanalinfo.');
      const channelData = await channelRes.json();
      
      const overwrites = channelData.permission_overwrites || [];
      const everyoneOverwrite = overwrites.find((o: any) => o.id === guildId);
      const viewDenied = everyoneOverwrite && (BigInt(everyoneOverwrite.deny || '0') & BigInt(1024)) !== BigInt(0);
      
      const newDeny = viewDenied
        ? String(BigInt(everyoneOverwrite?.deny || '0') & ~BigInt(1024))
        : String(BigInt(everyoneOverwrite?.deny || '0') | BigInt(1024));

      await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}/permissions/${guildId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guildId,
          type: 0,
          allow: everyoneOverwrite?.allow || '0',
          deny: newDeny,
        }),
      });

      return jtcEphemeral(viewDenied ? '👁️ Kanalen er nu **synlig** for alle.' : '🙈 Kanalen er nu **skjult** fra andre.');
    }

    case 'rename': {
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `jtc_rename_modal_${voiceChannelId}`,
          title: '✏️ Omdøb Kanal',
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: 'new_name',
              label: 'Nyt kanalnavn',
              style: TextInputStyle.SHORT,
              placeholder: 'Skriv det nye kanalnavn...',
              required: true,
              min_length: 1,
              max_length: 100,
            }],
          }],
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    case 'limit': {
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `jtc_limit_modal_${voiceChannelId}`,
          title: '👥 Sæt Brugergrænse',
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: 'user_limit',
              label: 'Brugergrænse (0 = ingen grænse)',
              style: TextInputStyle.SHORT,
              placeholder: '0',
              required: true,
              min_length: 1,
              max_length: 2,
            }],
          }],
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    case 'kick': {
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `jtc_kick_modal_${voiceChannelId}`,
          title: '🚫 Kick Bruger',
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: 'user_id',
              label: 'Bruger ID (højreklik → Kopier ID)',
              style: TextInputStyle.SHORT,
              placeholder: '123456789012345678',
              required: true,
              min_length: 17,
              max_length: 20,
            }],
          }],
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    case 'block': {
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `jtc_block_modal_${voiceChannelId}`,
          title: '⛔ Bloker Bruger',
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: 'user_id',
              label: 'Bruger ID (højreklik → Kopier ID)',
              style: TextInputStyle.SHORT,
              placeholder: '123456789012345678',
              required: true,
              min_length: 17,
              max_length: 20,
            }],
          }],
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    case 'allow': {
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `jtc_allow_modal_${voiceChannelId}`,
          title: '✅ Tillad Bruger',
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: 'user_id',
              label: 'Bruger ID (højreklik → Kopier ID)',
              style: TextInputStyle.SHORT,
              placeholder: '123456789012345678',
              required: true,
              min_length: 17,
              max_length: 20,
            }],
          }],
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    default:
      return jtcEphemeral('❌ Ukendt handling.');
  }
}

async function handleJTCRenameSubmit(interaction: any, customId: string): Promise<Response> {
  const voiceChannelId = customId.replace('jtc_rename_modal_', '');
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const newName = interaction.data?.components?.[0]?.components?.[0]?.value;
  if (!newName) return jtcEphemeral('❌ Intet navn angivet.');

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const res = await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) return jtcEphemeral('❌ Kunne ikke omdøbe kanalen. Prøv igen.');
  return jtcEphemeral(`✏️ Kanalen er omdøbt til **${newName}**!`);
}

async function handleJTCLimitSubmit(interaction: any, customId: string): Promise<Response> {
  const voiceChannelId = customId.replace('jtc_limit_modal_', '');
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const limitStr = interaction.data?.components?.[0]?.components?.[0]?.value;
  const limit = parseInt(limitStr, 10);
  if (isNaN(limit) || limit < 0 || limit > 99) return jtcEphemeral('❌ Ugyldig grænse. Brug et tal mellem 0-99.');

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const res = await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_limit: limit }),
  });

  if (!res.ok) return jtcEphemeral('❌ Kunne ikke ændre grænsen. Prøv igen.');
  return jtcEphemeral(limit === 0 ? '👥 Brugergrænsen er fjernet.' : `👥 Brugergrænsen er sat til **${limit}**.`);
}

async function handleJTCKickSubmit(interaction: any, customId: string): Promise<Response> {
  const voiceChannelId = customId.replace('jtc_kick_modal_', '');
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const targetId = interaction.data?.components?.[0]?.components?.[0]?.value?.trim();
  if (!targetId || !/^\d{17,20}$/.test(targetId)) return jtcEphemeral('❌ Ugyldigt bruger ID.');
  if (targetId === userId) return jtcEphemeral('❌ Du kan ikke kicke dig selv.');

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const guildId = interaction.guild_id;

  // Disconnect user from voice (set channel_id to null)
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${targetId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: null }),
  });

  if (!res.ok) return jtcEphemeral('❌ Kunne ikke kicke brugeren. Er de i kanalen?');
  return jtcEphemeral(`🚫 <@${targetId}> er blevet kicket fra kanalen.`);
}

async function handleJTCBlockSubmit(interaction: any, customId: string): Promise<Response> {
  const voiceChannelId = customId.replace('jtc_block_modal_', '');
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const targetId = interaction.data?.components?.[0]?.components?.[0]?.value?.trim();
  if (!targetId || !/^\d{17,20}$/.test(targetId)) return jtcEphemeral('❌ Ugyldigt bruger ID.');
  if (targetId === userId) return jtcEphemeral('❌ Du kan ikke blokere dig selv.');

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const guildId = interaction.guild_id;

  // Deny CONNECT and VIEW for the user on the voice channel
  await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}/permissions/${targetId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: targetId,
      type: 1, // Member
      deny: String(BigInt(1048576) | BigInt(1024)), // CONNECT + VIEW_CHANNEL
    }),
  });

  // Also disconnect them if they're in the channel
  await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${targetId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: null }),
  }).catch(() => {});

  return jtcEphemeral(`⛔ <@${targetId}> er blokeret fra din kanal.`);
}

async function handleJTCAllowSubmit(interaction: any, customId: string): Promise<Response> {
  const voiceChannelId = customId.replace('jtc_allow_modal_', '');
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const check = await verifyJTCOwner(supabase, voiceChannelId, userId);
  if (!check.ok) return jtcEphemeral(`❌ ${check.reason}`);

  const targetId = interaction.data?.components?.[0]?.components?.[0]?.value?.trim();
  if (!targetId || !/^\d{17,20}$/.test(targetId)) return jtcEphemeral('❌ Ugyldigt bruger ID.');

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;

  // Allow CONNECT and VIEW for the user on the voice channel
  await fetch(`https://discord.com/api/v10/channels/${voiceChannelId}/permissions/${targetId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: targetId,
      type: 1, // Member
      allow: String(BigInt(1048576) | BigInt(1024)), // CONNECT + VIEW_CHANNEL
      deny: '0',
    }),
  });

  return jtcEphemeral(`✅ <@${targetId}> har nu adgang til din kanal.`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log("Received interaction request");

    // Verify Discord signature
    const isValid = await verifyDiscordSignature(req, body);
    if (!isValid) {
      console.error("Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(body);
    console.log("Interaction type:", interaction.type, "custom_id:", interaction.data?.custom_id);

    // Handle PING (Discord verification)
    if (interaction.type === InteractionType.PING) {
      console.log("Responding to PING");
      return new Response(
        JSON.stringify({ type: InteractionResponseType.PONG }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle slash commands (APPLICATION_COMMAND)
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data?.name;
      const guildId = interaction.guild_id;
      const userId = interaction.member?.user?.id || interaction.user?.id;
      const userName = interaction.member?.user?.username || interaction.user?.username;
      
      console.log("Slash command:", commandName, "from user:", userName);
      
      // Handle /fivem command with subcommand groups
      if (commandName === "fivem") {
        const options = interaction.data?.options || [];

        if (options.length > 0) {
          const first = options[0];
          if (first.type === 2) {
            const nested = first.options?.[0];
            if (!nested) break;
            return handleFiveMSlashCommand(interaction, first.name, nested.name, nested.options || []);
          }

          return handleFiveMSlashCommand(interaction, null, first.name, first.options || []);
        }
        
        return new Response(
          JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "❌ Invalid command format.",
              flags: 64,
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Handle /leaderboard
      if (commandName === "leaderboard") {
        const discordGuildId = interaction.guild_id;
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Resolve internal guild UUID from Discord guild ID
        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', discordGuildId)
          .maybeSingle();

        if (!guild) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: "❌ Server ikke fundet i databasen.", flags: 64 },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        const { data: topUsers, error: lbError } = await supabase
          .from('user_levels')
          .select('user_id, discord_username, xp, level, total_messages')
          .eq('guild_id', guild.id)
          .order('xp', { ascending: false })
          .limit(10);

        if (lbError || !topUsers || topUsers.length === 0) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: "🏆 **Leaderboard**\n\nIngen har optjent XP endnu. Begynd at chatte for at komme på ranglisten!",
                flags: 64,
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        const medals = ['🥇', '🥈', '🥉'];
        const lines = topUsers.map((u, i) => {
          const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
          const name = u.discord_username || `<@${u.user_id}>`;
          return `${prefix} ${name} — Level ${u.level} • ${u.xp.toLocaleString()} XP • ${u.total_messages} beskeder`;
        });

        return new Response(
          JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: [{
                title: '🏆 XP Leaderboard',
                description: lines.join('\n'),
                color: 0x5865F2,
                footer: { text: `Top ${topUsers.length} brugere` },
                timestamp: new Date().toISOString(),
              }],
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      
      // Unknown slash command
      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Unknown command: \`/${commandName}\``,
            flags: 64,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle modal submissions
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      const modalCustomId = interaction.data?.custom_id || "";
      
      // JTC rename modal
      if (modalCustomId.startsWith("jtc_rename_modal_")) {
        return await handleJTCRenameSubmit(interaction, modalCustomId);
      }

      // JTC limit modal
      if (modalCustomId.startsWith("jtc_limit_modal_")) {
        return await handleJTCLimitSubmit(interaction, modalCustomId);
      }

      // JTC kick modal
      if (modalCustomId.startsWith("jtc_kick_modal_")) {
        return await handleJTCKickSubmit(interaction, modalCustomId);
      }

      // JTC block modal
      if (modalCustomId.startsWith("jtc_block_modal_")) {
        return await handleJTCBlockSubmit(interaction, modalCustomId);
      }

      // JTC allow modal
      if (modalCustomId.startsWith("jtc_allow_modal_")) {
        return await handleJTCAllowSubmit(interaction, modalCustomId);
      }

      // NEW APPLICATION SYSTEM: Handle application form modal
      if (modalCustomId.startsWith("application_form_")) {
        return await handleApplicationFormSubmit(interaction);
      }
      
      // Legacy ticket modal
      return await handleModalSubmit(interaction);
    }

    // Handle button clicks and select menus
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      const customId = interaction.data?.custom_id || "";
      const componentType = interaction.data?.component_type;

      // Handle select menu (dropdown) selection
      if (customId === "ticket_category_select" && componentType === 3) {
        const selectedCategoryId = interaction.data?.values?.[0];
        if (selectedCategoryId) {
          // Check if this is an application category with questions
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          const { data: category } = await supabase
            .from("ticket_categories")
            .select("*, guilds!inner(id, guild_id)")
            .eq("id", selectedCategoryId)
            .single();

          if (category) {
            const questions = category.questions || [];
            // If any category has questions, show modal first
            if (questions.length > 0) {
              console.log("Showing ticket modal with", questions.length, "questions");
              return await showTicketModal(interaction, selectedCategoryId, category);
            }
          }

          // Otherwise create ticket directly
          return deferAndCreateTicket(interaction, selectedCategoryId);
        }
      }

      // Create ticket button (legacy/fallback)
      if (customId.startsWith("ticket_create_")) {
        const categoryId = customId.replace("ticket_create_", "");
        return deferAndCreateTicket(interaction, categoryId);
      }

      // Claim ticket button
      if (customId.startsWith("ticket_claim_")) {
        const threadId = customId.replace("ticket_claim_", "");
        return await handleClaimTicket(interaction, threadId);
      }

      // Close ticket button (archive)
      if (customId.startsWith("ticket_close_")) {
        const threadId = customId.replace("ticket_close_", "");
        return await handleCloseTicket(interaction, threadId, false);
      }

      // Close ticket button (delete)
      if (customId.startsWith("ticket_delete_")) {
        const threadId = customId.replace("ticket_delete_", "");
        return await handleCloseTicket(interaction, threadId, true);
      }
      
      // Approve application button
      if (customId.startsWith("application_approve_")) {
        const threadId = customId.replace("application_approve_", "");
        return await handleApproveApplication(interaction, threadId);
      }
      
      // Deny application button (legacy ticket system)
      if (customId.startsWith("application_deny_")) {
        const threadId = customId.replace("application_deny_", "");
        return await handleDenyApplication(interaction, threadId);
      }

      // NEW APPLICATION SYSTEM: Approve submission button (from log channel)
      if (customId.startsWith("submission_approve_")) {
        const submissionId = customId.replace("submission_approve_", "");
        return await handleSubmissionApprove(interaction, submissionId);
      }

      // NEW APPLICATION SYSTEM: Deny submission button (from log channel)
      if (customId.startsWith("submission_deny_")) {
        const submissionId = customId.replace("submission_deny_", "");
        return await handleSubmissionDeny(interaction, submissionId);
      }

      // NEW APPLICATION SYSTEM: Start application button (from application panel)
      if (customId.startsWith("application_start_")) {
        const formId = customId.replace("application_start_", "");
        return await handleApplicationStart(interaction, formId);
      }

      // NEW APPLICATION SYSTEM: Dropdown select for application form
      if (customId === "application_select") {
        const values = interaction.data?.values;
        if (values && values.length > 0) {
          const formId = values[0];
          return await handleApplicationStart(interaction, formId);
        }
      }

      // NEW APPLICATION SYSTEM: Modal submit for application form
      if (customId.startsWith("application_form_")) {
        return await handleApplicationFormSubmit(interaction);
      }

      // Handle reaction role buttons directly here (toggle role on/off)
      if (customId.startsWith("reaction_role:")) {
        const roleId = customId.replace("reaction_role:", "");
        const memberId = interaction.member?.user?.id;
        const memberRoles: string[] = interaction.member?.roles || [];
        const guildId = interaction.guild_id;

        if (!memberId || !guildId) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: "❌ Kunne ikke finde bruger eller server.", flags: 64 },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        const hasRole = memberRoles.includes(roleId);

        // Defer ephemeral reply immediately so Discord doesn't timeout
        waitUntil(
          (async () => {
            try {
              // Resolve the correct bot token (custom bot or global)
              let botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
              try {
                const innerSupabase = createClient(
                  Deno.env.get("SUPABASE_URL")!,
                  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
                );
                // Look up the internal guild UUID from the Discord guild ID
                const { data: guildRow } = await innerSupabase
                  .from("guilds")
                  .select("id")
                  .eq("guild_id", guildId)
                  .maybeSingle();
                if (guildRow) {
                  const { data: customBot } = await innerSupabase
                    .from("guild_bot_settings")
                    .select("bot_token_encrypted, is_custom_bot, is_active")
                    .eq("guild_id", guildRow.id)
                    .eq("is_custom_bot", true)
                    .eq("is_active", true)
                    .maybeSingle();
                  if (customBot?.bot_token_encrypted) {
                    const encKey = Deno.env.get("BOT_SECRET_KEY") || "default-encryption-key";
                    const decText = atob(customBot.bot_token_encrypted);
                    let dec = "";
                    for (let i = 0; i < decText.length; i++) {
                      dec += String.fromCharCode(decText.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length));
                    }
                    botToken = dec;
                    console.log("Using custom bot token for reaction role toggle");
                  }
                }
              } catch (tokenErr) {
                console.error("Failed to resolve custom bot token, using global:", tokenErr);
              }

              const method = hasRole ? "DELETE" : "PUT";
              const url = `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`;

              let res = await fetch(url, {
                method,
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              });

              // Retry on rate limit
              for (let attempt = 0; attempt < 3 && res.status === 429; attempt++) {
                const retryData = await res.json().catch(() => ({}));
                const retryAfter = (retryData.retry_after || 2) * 1000;
                await new Promise((r) => setTimeout(r, retryAfter));
                res = await fetch(url, {
                  method,
                  headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                });
              }

              if (res.ok || res.status === 204) {
                const action = hasRole ? "fjernet" : "fået";
                await sendFollowupEphemeral(interaction, `✅ Du har ${action} rollen <@&${roleId}>`);
              } else {
                const errText = await res.text().catch(() => "");
                console.error(`Role toggle failed: ${res.status} ${errText}`);
                await sendFollowupEphemeral(interaction, "❌ Kunne ikke ændre din rolle. Tjek at botten har de rette tilladelser.");
              }
            } catch (e) {
              console.error("Reaction role toggle error:", e);
              await sendFollowupEphemeral(interaction, "❌ Der opstod en fejl.");
            }
          })()
        );

        return deferredEphemeral("⏳ Opdaterer din rolle...");
      }

      // Modmail claim button
      if (customId === "modmail_claim") {
        return await handleModmailClaim(interaction);
      }

      // Modmail close button
      if (customId === "modmail_close") {
        return await handleModmailClose(interaction);
      }

      // ===== JTC Control Panel Buttons =====
      if (customId.startsWith("jtc_")) {
        return await handleJTCControl(interaction, customId);
      }

      // ===== Poll Vote Buttons =====
      if (customId.startsWith("poll_vote_")) {
        const parts = customId.split("_");
        const pollId = parts[2];
        const optionIndex = parseInt(parts[3]);
        const userId = interaction.member?.user?.id || interaction.user?.id;

        waitUntil(
          (async () => {
            try {
              const supabase = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
              );

              const { data: poll, error } = await supabase
                .from("polls")
                .select("*")
                .eq("id", pollId)
                .single();

              if (error || !poll || poll.ended) {
                await sendFollowupEphemeral(interaction, "❌ Denne afstemning er afsluttet.");
                return;
              }

              const pollOptions = (poll.options || []) as Array<{ label: string; votes: number; voters: string[] }>;

              if (pollOptions[optionIndex]?.voters?.includes(userId)) {
                await sendFollowupEphemeral(interaction, "❌ Du har allerede stemt på denne mulighed.");
                return;
              }

              const allowMultiple = (poll.votes as any)?.allow_multiple ?? false;
              if (!allowMultiple) {
                for (const opt of pollOptions) {
                  opt.voters = (opt.voters || []).filter((v: string) => v !== userId);
                  opt.votes = opt.voters.length;
                }
              }

              pollOptions[optionIndex].voters.push(userId);
              pollOptions[optionIndex].votes = pollOptions[optionIndex].voters.length;

              await supabase
                .from("polls")
                .update({ options: pollOptions })
                .eq("id", pollId);

              // Update the original message with vote counts
              const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
              if (poll.message_id && botToken) {
                try {
                  const totalVotes = pollOptions.reduce((sum: number, o: any) => sum + o.votes, 0);
                  const updatedDesc = pollOptions
                    .map((o: any, i: number) => {
                      const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
                      return `**${i + 1}.** ${o.label}\n${bar} ${pct}% (${o.votes})`;
                    })
                    .join("\n\n");

                  const channelId = interaction.channel_id || interaction.channel?.id;
                  if (channelId) {
                    // Get the original message to preserve embed properties
                    const msgRes = await fetch(
                      `https://discord.com/api/v10/channels/${channelId}/messages/${poll.message_id}`,
                      { headers: { Authorization: `Bot ${botToken}` } }
                    );
                    if (msgRes.ok) {
                      const msg = await msgRes.json();
                      const embed = msg.embeds?.[0] || {};
                      embed.description = updatedDesc;

                      await fetch(
                        `https://discord.com/api/v10/channels/${channelId}/messages/${poll.message_id}`,
                        {
                          method: "PATCH",
                          headers: {
                            Authorization: `Bot ${botToken}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({ embeds: [embed] }),
                        }
                      );
                    }
                  }
                } catch (e) {
                  console.error("[Poll] Failed to update message:", e);
                }
              }

              await sendFollowupEphemeral(
                interaction,
                `✅ Du stemte på **${pollOptions[optionIndex].label}**!`
              );
            } catch (e: any) {
              console.error("[Poll] Vote error:", e);
              await sendFollowupEphemeral(interaction, "❌ Kunne ikke registrere din stemme.");
            }
          })()
        );

        return deferredEphemeral("⏳ Registrerer din stemme...");
      }

      // ===== Giveaway Buttons =====
      // Handle here for the default bot webhook flow; custom bots handle it in the gateway.
      if (customId.startsWith("giveaway_enter_")) {
        const giveawayId = customId.replace("giveaway_enter_", "");
        const memberId = interaction.member?.user?.id;
        const memberRoles: string[] = interaction.member?.roles || [];
        const guildId = interaction.guild_id;

        if (!memberId || !guildId) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: "❌ Kunne ikke finde bruger eller server.", flags: 64 },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        waitUntil(
          (async () => {
            try {
              const innerSupabase = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
              );

              const { data: guildRow } = await innerSupabase
                .from("guilds")
                .select("id")
                .eq("guild_id", guildId)
                .maybeSingle();

              if (!guildRow) {
                await sendFollowupEphemeral(interaction, "❌ Server ikke fundet.");
                return;
              }

              const { data: giveaway } = await innerSupabase
                .from("giveaways")
                .select("*")
                .eq("id", giveawayId)
                .eq("guild_id", guildRow.id)
                .maybeSingle();

              if (!giveaway) {
                await sendFollowupEphemeral(interaction, "❌ Giveaway ikke fundet.");
                return;
              }

              if (giveaway.required_role_id && !memberRoles.includes(giveaway.required_role_id)) {
                await sendFollowupEphemeral(interaction, `❌ Du skal have rollen <@&${giveaway.required_role_id}> for at deltage.`);
                return;
              }

              if (giveaway.ended || new Date(giveaway.ends_at) <= new Date()) {
                await sendFollowupEphemeral(interaction, "❌ Giveawayen er afsluttet.");
                return;
              }

              const entries = getGiveawayEntries(giveaway.entries);
              const alreadyEntered = entries.includes(memberId);
              const updatedEntries = alreadyEntered
                ? entries.filter((entry) => entry !== memberId)
                : Array.from(new Set([...entries, memberId]));

              const { error: updateError } = await innerSupabase
                .from("giveaways")
                .update({ entries: updatedEntries })
                .eq("id", giveaway.id);

              if (updateError) {
                throw updateError;
              }

              const botToken = await getBotTokenForGuild(innerSupabase, guildId);
              await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages/${interaction.message.id}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(buildGiveawayMessagePayload({ ...giveaway, entries: updatedEntries })),
              });

              await sendFollowupEphemeral(
                interaction,
                alreadyEntered
                  ? `✅ Du er fjernet fra giveawayen. (${updatedEntries.length} deltagere)`
                  : `✅ Du deltager nu i giveawayen! (${updatedEntries.length} deltagere)`
              );
            } catch (e) {
              console.error("Giveaway button error:", e);
              await sendFollowupEphemeral(interaction, "❌ Der opstod en fejl ved giveaway-knappen.");
            }
          })()
        );

        return deferredEphemeral("⏳ Opdaterer giveaway...");
      }

      // ===== Suggestion Vote Buttons =====
      // Handled by the bot's suggestionHandler via gateway events.
      // Do NOT handle here to avoid double-acknowledge errors.
      if (customId.startsWith("suggestion_")) {
        // Return empty ack - the bot gateway handler will handle the actual response
        return new Response(
          JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Unknown interaction type
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Unknown action.",
          flags: 64,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error handling interaction:", error);
    return new Response("Internal error", { status: 500 });
  }
});
