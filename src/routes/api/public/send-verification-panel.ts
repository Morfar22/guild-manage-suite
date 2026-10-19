// Migrated from Supabase Edge Function `send-verification-panel` to a TanStack server route.
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { decryptBotToken } from "@/lib/server/bot-token-crypto";
import type { Untyped } from "@/types/untyped";
import {
  requireUser,
  requireGuildAdmin,
  requireGuildChannel,
} from "@/lib/server/api-auth";

const __env = (k: string) =>
  process.env[k] ??
  (k === "SUPABASE_ANON_KEY"
    ? process.env["SUPABASE_PUBLISHABLE_KEY"]
    : undefined);
let __handler: (req: Request) => Response | Promise<Response>;
const __serve = (fn: Untyped, _opts?: Untyped) => {
  __handler = fn;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseServiceKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = __env("DISCORD_BOT_TOKEN")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const user = await requireUser(req, supabase);

    const { guildId } = await req.json();
    if (!guildId) {
      return new Response(JSON.stringify({ error: "guildId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guild = await requireGuildAdmin(supabase, user.id, guildId);

    // Get verification settings
    const { data: settings } = await supabase
      .from("verification_settings")
      .select("*")
      .eq("guild_id", guild.id)
      .single();

    if (!settings || !settings.enabled || !settings.channel_id) {
      return new Response(
        JSON.stringify({
          error:
            "Verification not configured. Enable it and select a channel first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: customBot, error: customBotError } = await supabase
      .from("guild_bot_settings")
      .select("bot_token_encrypted")
      .eq("guild_id", guild.id)
      .eq("is_custom_bot", true)
      .eq("is_active", true)
      .maybeSingle();
    if (customBotError) throw customBotError;
    const token = customBot?.bot_token_encrypted
      ? decryptBotToken(
          customBot.bot_token_encrypted,
          __env("BOT_SECRET_KEY") || "",
        )
      : botToken;
    if (!token) throw new Error("Bot token not configured");
    await requireGuildChannel(token, guild.guild_id, settings.channel_id);

    // Send verification panel embed via Discord API
    const embed = {
      title: "✅ Verification",
      description:
        settings.welcome_message ||
        "Klik på knappen nedenfor for at verificere dig og få adgang til serveren!",
      color: 0x5865f2,
      footer: { text: "Tryk på knappen for at blive verificeret" },
    };

    const components = [
      {
        type: 1, // ActionRow
        components: [
          {
            type: 2, // Button
            style: 3, // Success
            label: "Verificér mig ✅",
            custom_id: "verify_panel_button",
          },
        ],
      },
    ];

    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${settings.channel_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed], components }),
      },
    );

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error("Discord API error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send panel to Discord" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const msgData = await discordRes.json();

    // Store panel message ID in settings
    await supabase
      .from("verification_settings")
      .update({ panel_message_id: msgData.id })
      .eq("guild_id", guild.id);

    return new Response(
      JSON.stringify({ success: true, messageId: msgData.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Send verification panel error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const __call = ({ request }: { request: Request }) => __handler(request);

export const Route = createFileRoute("/api/public/send-verification-panel")({
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
});
