// @ts-nocheck
// Migrated from Supabase Edge Function `send-ticket-panel` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    .select("bot_token_encrypted")
    .eq("guild_id", guildId)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  const key = __env("BOT_SECRET_KEY") || "default-encryption-key";
  if (settings?.bot_token_encrypted) {
    try { return simpleDecrypt(settings.bot_token_encrypted, key); } catch (_) {}
  }
  const globalToken = __env("DISCORD_BOT_TOKEN");
  if (!globalToken) throw new Error("Discord bot token not configured");
  return globalToken;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const svcKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, svcKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { guild_id, panel_id } = await req.json();
    if (!guild_id) return json({ error: "guild_id required" }, 400);

    const { data: userGuild } = await supabase
      .from("user_guilds").select("has_admin_permission")
      .eq("user_id", user.id).eq("guild_id", guild_id).single();
    if (!userGuild?.has_admin_permission) return json({ error: "No permission" }, 403);

    const { data: guild } = await supabase.from("guilds")
      .select("guild_name, guild_icon, guild_id").eq("id", guild_id).single();
    if (!guild) return json({ error: "Guild not found" }, 404);

    // Load panel (new system) or fall back to legacy ticket_settings
    let panel: any = null;
    let legacyMode = false;
    if (panel_id) {
      const { data } = await supabase.from("ticket_panels").select("*").eq("id", panel_id).eq("guild_id", guild_id).maybeSingle();
      panel = data;
    }
    if (!panel) {
      // Legacy fallback: use ticket_settings
      const { data: legacy } = await supabase.from("ticket_settings").select("*").eq("guild_id", guild_id).maybeSingle();
      if (!legacy?.panel_channel_id) return json({ error: "Panel not found and no legacy settings" }, 404);
      legacyMode = true;
      panel = {
        id: null,
        channel_id: legacy.panel_channel_id,
        message_id: legacy.panel_message_id,
        embed_title: "🎫 Support Tickets",
        embed_description: "Select a category from the dropdown menu below to create a ticket.",
        embed_color: 0x5865F2,
        embed_image_url: null, embed_thumbnail_url: null, embed_footer_text: null,
        component_style: "select",
        button_label: "Open Ticket", button_emoji: "📩", button_style: 1,
        category_ids: [],
      };
    }

    if (!panel.channel_id) return json({ error: "Panel channel not set" }, 400);

    // Categories filter
    let cats: any[] = [];
    if (Array.isArray(panel.category_ids) && panel.category_ids.length > 0) {
      const { data } = await supabase.from("ticket_categories").select("*").in("id", panel.category_ids);
      cats = data || [];
    } else {
      const { data } = await supabase.from("ticket_categories").select("*").eq("guild_id", guild_id).eq("ticket_type", "support").order("position").order("name");
      cats = data || [];
    }

    const embed: any = {
      title: (panel.embed_title || "🎫 Support Tickets").slice(0, 256),
      description: (panel.embed_description || "").slice(0, 4000),
      color: panel.embed_color ?? 0x5865F2,
      timestamp: new Date().toISOString(),
    };
    if (panel.embed_image_url) embed.image = { url: panel.embed_image_url };
    if (panel.embed_thumbnail_url) embed.thumbnail = { url: panel.embed_thumbnail_url };
    embed.footer = {
      text: (panel.embed_footer_text || guild.guild_name || "").slice(0, 2048),
      icon_url: guild.guild_icon ? `https://cdn.discordapp.com/icons/${guild.guild_id}/${guild.guild_icon}.png` : undefined,
    };

    const idSuffix = panel.id ? `_${panel.id}` : "";
    const components: any[] = [];

    if (cats.length === 0) {
      components.push({ type: 1, components: [{ type: 2, style: 1, label: "Create Ticket", emoji: { name: "🎫" }, custom_id: `ticket_create_default${idSuffix}` }] });
    } else if (panel.component_style === "buttons") {
      // Buttons - max 5 per row, 5 rows = 25 buttons max
      for (let i = 0; i < Math.min(cats.length, 25); i += 5) {
        const row = cats.slice(i, i + 5).map((c: any) => ({
          type: 2,
          style: c.button_color ? 1 : (panel.button_style || 1),
          label: c.name.slice(0, 80),
          emoji: c.emoji ? { name: c.emoji } : undefined,
          custom_id: `ticket_create_${c.id}${idSuffix}`,
        }));
        components.push({ type: 1, components: row });
      }
    } else {
      // Select menu
      const opts = cats.slice(0, 25).map((c: any) => ({
        label: c.name.slice(0, 100),
        description: c.description ? c.description.slice(0, 100) : undefined,
        value: c.id,
        emoji: c.emoji ? { name: c.emoji } : undefined,
      }));
      components.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: `ticket_category_select${idSuffix}`,
          placeholder: "🎫 Select a ticket category...",
          min_values: 1, max_values: 1, options: opts,
        }],
      });
    }

    const payload = { embeds: [embed], components };
    const botToken = await getBotTokenForGuild(supabase, guild_id);

    let messageId: string | null = null;
    let resp: Response | null = null;

    if (panel.message_id) {
      resp = await fetch(`https://discord.com/api/v10/channels/${panel.channel_id}/messages/${panel.message_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.ok) messageId = (await resp.json()).id;
    }
    if (!messageId) {
      resp = await fetch(`https://discord.com/api/v10/channels/${panel.channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: "Discord API error", details: t, status: resp.status }, 500);
      }
      messageId = (await resp.json()).id;
    }

    if (messageId) {
      if (legacyMode) {
        await supabase.from("ticket_settings").update({ panel_message_id: messageId }).eq("guild_id", guild_id);
      } else if (panel.id) {
        await supabase.from("ticket_panels").update({ message_id: messageId }).eq("id", panel.id);
      }
    }

    return json({ success: true, message_id: messageId });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/send-ticket-panel')({
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
