// @ts-nocheck
// Migrated from Supabase Edge Function `invite-tracker` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

__serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    __env("SUPABASE_URL")!,
    __env("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, data } = await req.json();

    // Bot-only endpoints require bot secret
    const botActions = ["syncInvites", "logInviteUse", "markInviteLeft"];
    if (botActions.includes(action)) {
      const botSecret = req.headers.get("x-bot-secret");
      if (botSecret !== __env("BOT_SECRET_KEY")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get internal guild UUID from Discord guild_id
    const getGuildUuid = async (discordGuildId: string): Promise<string | null> => {
      const { data: g } = await supabase.from("guilds").select("id").eq("guild_id", discordGuildId).maybeSingle();
      return g?.id ?? null;
    };

    switch (action) {
      case "syncInvites": {
        const { guildId, invites } = data as { guildId: string; invites: any[] };
        const uuid = await getGuildUuid(guildId);
        if (!uuid) return new Response(JSON.stringify({ error: "Guild not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        for (const inv of invites) {
          await supabase.from("invite_tracker").upsert({
            guild_id: uuid,
            invite_code: inv.invite_code,
            inviter_discord_id: inv.inviter_discord_id,
            inviter_username: inv.inviter_username,
            channel_id: inv.channel_id,
            uses: inv.uses,
            max_uses: inv.max_uses,
            expires_at: inv.expires_at,
          }, { onConflict: "guild_id,invite_code" });
        }
        return new Response(JSON.stringify({ success: true, count: invites.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "logInviteUse": {
        const { guildId, inviteCode, inviterDiscordId, inviterUsername, joinedUserId, joinedUsername, joinedAccountCreatedAt, isFake } = data;
        const uuid = await getGuildUuid(guildId);
        if (!uuid) return new Response(JSON.stringify({ error: "Guild not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        await supabase.from("invite_uses").insert({
          guild_id: uuid,
          invite_code: inviteCode,
          inviter_discord_id: inviterDiscordId,
          inviter_username: inviterUsername,
          joined_user_id: joinedUserId,
          joined_username: joinedUsername,
          joined_account_created_at: joinedAccountCreatedAt,
          is_fake: !!isFake,
        });

        // Increment uses on invite_tracker
        if (inviteCode) {
          const { data: existing } = await supabase
            .from("invite_tracker")
            .select("uses")
            .eq("guild_id", uuid)
            .eq("invite_code", inviteCode)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("invite_tracker")
              .update({ uses: (existing.uses ?? 0) + 1 })
              .eq("guild_id", uuid)
              .eq("invite_code", inviteCode);
          }
        }

        // Return inviter stats so caller (welcome flow) can use them
        let stats = { real: 0, fake: 0, left: 0, total: 0 };
        if (inviterDiscordId) {
          const { data: rows } = await supabase
            .from("invite_uses")
            .select("is_fake, has_left")
            .eq("guild_id", uuid)
            .eq("inviter_discord_id", inviterDiscordId);
          if (rows) {
            stats.total = rows.length;
            stats.fake = rows.filter((r: any) => r.is_fake).length;
            stats.left = rows.filter((r: any) => r.has_left).length;
            stats.real = stats.total - stats.fake - stats.left;
          }
        }

        return new Response(JSON.stringify({ success: true, inviter: { discord_id: inviterDiscordId, username: inviterUsername }, stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "markInviteLeft": {
        const { guildId, joinedUserId } = data;
        const uuid = await getGuildUuid(guildId);
        if (!uuid) return new Response(JSON.stringify({ error: "Guild not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        await supabase
          .from("invite_uses")
          .update({ has_left: true, left_at: new Date().toISOString() })
          .eq("guild_id", uuid)
          .eq("joined_user_id", joinedUserId)
          .eq("has_left", false);

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "getLeaderboard": {
        const { guildId } = data;
        const uuid = await getGuildUuid(guildId);
        if (!uuid) return new Response(JSON.stringify({ leaderboard: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: rows } = await supabase
          .from("invite_uses")
          .select("inviter_discord_id, inviter_username, is_fake, has_left")
          .eq("guild_id", uuid)
          .not("inviter_discord_id", "is", null);

        const map = new Map<string, { id: string; username: string; real: number; fake: number; left: number; total: number }>();
        (rows ?? []).forEach((r: any) => {
          const id = r.inviter_discord_id;
          if (!id) return;
          if (!map.has(id)) map.set(id, { id, username: r.inviter_username || 'Unknown', real: 0, fake: 0, left: 0, total: 0 });
          const e = map.get(id)!;
          e.total += 1;
          if (r.is_fake) e.fake += 1;
          else if (r.has_left) e.left += 1;
          else e.real += 1;
        });
        const leaderboard = Array.from(map.values()).sort((a, b) => b.real - a.real);
        return new Response(JSON.stringify({ leaderboard }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "getRecent": {
        const { guildId, limit = 50 } = data;
        const uuid = await getGuildUuid(guildId);
        if (!uuid) return new Response(JSON.stringify({ recent: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: recent } = await supabase
          .from("invite_uses")
          .select("*")
          .eq("guild_id", uuid)
          .order("joined_at", { ascending: false })
          .limit(Math.min(limit, 200));

        return new Response(JSON.stringify({ recent: recent ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e: any) {
    console.error("invite-tracker error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/invite-tracker')({
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
