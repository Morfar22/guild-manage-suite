// @ts-nocheck
// Migrated from Supabase Edge Function `generate-ticket-transcript` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildHtml(ticket: any, messages: any[], guildName: string) {
  const rows = messages.map((m) => {
    const time = new Date(m.created_at).toLocaleString();
    const att = Array.isArray(m.attachments) && m.attachments.length
      ? `<div class="atts">${m.attachments.map((a: any) => `<a href="${esc(a.url)}" target="_blank">${esc(a.name || "attachment")}</a>`).join(" ")}</div>` : "";
    return `<div class="msg">
      <img class="avatar" src="${esc(m.author_avatar || "https://cdn.discordapp.com/embed/avatars/0.png")}" alt="">
      <div class="body">
        <div class="head"><span class="name">${esc(m.author_name || "Unknown")}</span><span class="time">${esc(time)}</span></div>
        <div class="content">${esc(m.content || "")}</div>
        ${att}
      </div>
    </div>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket transcript · ${esc(ticket.id)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:'gg sans','Segoe UI',Arial,sans-serif;background:#313338;color:#dbdee1;margin:0;padding:0}
    header{background:#2b2d31;padding:20px 24px;border-bottom:1px solid #1e1f22}
    h1{margin:0;font-size:18px;color:#fff}
    .meta{color:#949ba4;font-size:12px;margin-top:4px}
    .container{max-width:900px;margin:0 auto;padding:16px 24px}
    .msg{display:flex;gap:14px;padding:8px 0;border-bottom:1px solid #26272a}
    .avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0}
    .body{flex:1;min-width:0}
    .head{display:flex;gap:8px;align-items:baseline}
    .name{font-weight:600;color:#f2f3f5}
    .time{color:#949ba4;font-size:11px}
    .content{white-space:pre-wrap;word-wrap:break-word;color:#dbdee1;margin-top:2px}
    .atts{margin-top:6px;font-size:12px}
    .atts a{color:#00a8fc;margin-right:8px}
    footer{padding:16px 24px;text-align:center;color:#949ba4;font-size:12px}
  </style></head>
  <body>
    <header>
      <h1>🎫 ${esc(ticket.subject || "Ticket")} · ${esc(guildName)}</h1>
      <div class="meta">Ticket ${esc(ticket.id)} · created ${esc(new Date(ticket.created_at).toLocaleString())} · ${messages.length} messages</div>
    </header>
    <div class="container">${rows || '<p style="color:#949ba4">No messages recorded.</p>'}</div>
    <footer>Transcript generated ${esc(new Date().toISOString())}</footer>
  </body></html>`;
}

async function fetchDMChannel(botToken: string, userId: string) {
  const r = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!r.ok) return null;
  return r.json();
}

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = "";
  for (let i = 0; i < text.length; i++) result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return result;
}

async function getBotToken(supabase: any, guildId: string): Promise<string> {
  const { data } = await supabase.from("guild_bot_settings").select("bot_token_encrypted")
    .eq("guild_id", guildId).eq("is_custom_bot", true).eq("is_active", true).maybeSingle();
  const k = __env("BOT_SECRET_KEY") || "default-encryption-key";
  if (data?.bot_token_encrypted) {
    try { return simpleDecrypt(data.bot_token_encrypted, k); } catch (_) {}
  }
  return __env("DISCORD_BOT_TOKEN")!;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const botSecret = req.headers.get("x-bot-secret");
    if (!botSecret || botSecret !== __env("BOT_SECRET_KEY")) return json({ error: "unauthorized" }, 401);

    const { ticket_id } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id required" }, 400);

    const supabase = createClient(__env("SUPABASE_URL")!, __env("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await supabase.from("tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) return json({ error: "ticket not found" }, 404);

    const { data: settings } = await supabase.from("ticket_settings").select("*").eq("guild_id", ticket.guild_id).maybeSingle();
    if (settings && settings.enable_transcripts === false) return json({ success: true, skipped: true });

    const { data: messages } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticket_id).order("created_at", { ascending: true });
    const { data: guild } = await supabase.from("guilds").select("guild_name").eq("id", ticket.guild_id).maybeSingle();

    const html = buildHtml(ticket, messages || [], guild?.guild_name || "Server");
    const path = `${ticket.guild_id}/${ticket_id}.html`;

    const { error: upErr } = await supabase.storage.from("ticket-transcripts").upload(path, new Blob([html], { type: "text/html" }), { upsert: true, contentType: "text/html" });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await supabase.storage.from("ticket-transcripts").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || null;

    await supabase.from("ticket_transcripts").upsert({
      ticket_id, guild_id: ticket.guild_id, html_url: url, storage_path: path, message_count: messages?.length || 0,
    }, { onConflict: "ticket_id" });

    // DM the creator with transcript + optional rating buttons
    if (url && settings?.dm_transcript_to_user !== false) {
      const botToken = await getBotToken(supabase, ticket.guild_id);
      const dm = await fetchDMChannel(botToken, ticket.creator_id);
      if (dm?.id) {
        const components: any[] = [];
        if (settings?.enable_ratings) {
          components.push({
            type: 1,
            components: [1, 2, 3, 4, 5].map((n) => ({
              type: 2, style: n <= 2 ? 4 : n === 3 ? 2 : 3,
              label: `${n} ★`, custom_id: `ticket_rate_${ticket_id}_${n}`,
            })),
          });
        }
        const embed = {
          title: "🎫 Ticket closed",
          description: `${settings?.enable_ratings ? (settings.ratings_dm_prompt || "How would you rate the support you received?") + "\n\n" : ""}[View transcript](${url})`,
          color: 0x5865F2,
          footer: { text: guild?.guild_name || "" },
          timestamp: new Date().toISOString(),
        };
        await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed], components }),
        }).catch(() => {});
      }
    }

    // Post to transcript log channel
    if (url && settings?.transcript_channel_id) {
      const botToken = await getBotToken(supabase, ticket.guild_id);
      await fetch(`https://discord.com/api/v10/channels/${settings.transcript_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "📜 Ticket transcript",
            description: `**${ticket.subject || "Ticket"}**\nCreated by <@${ticket.creator_id}>\n[Open transcript](${url})`,
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
          }],
        }),
      }).catch(() => {});
    }

    return json({ success: true, url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/generate-ticket-transcript')({
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
