import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptBotToken } from "../_shared/bot-token-crypto.ts";
import type { Untyped } from "../_shared/untyped";
import {
  requireUser,
  requireGuildAdmin,
  requireGuildChannel,
} from "../_shared/api-auth.ts";

const __env = (key: string) =>
  Deno.env.get(key) ??
  (key === "SUPABASE_ANON_KEY"
    ? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
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

Deno.serve(__handler);
