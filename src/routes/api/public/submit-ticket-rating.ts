// @ts-nocheck
// Migrated from Supabase Edge Function `submit-ticket-rating` to a TanStack server route.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const botSecret = req.headers.get("x-bot-secret");
    if (!botSecret || botSecret !== __env("BOT_SECRET_KEY")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { ticket_id, rated_by_id, rating, comment, staff_id, staff_name } = body || {};
    if (!ticket_id || !rated_by_id || !rating || rating < 1 || rating > 5) {
      return json({ error: "invalid input" }, 400);
    }

    const supabase = createClient(__env("SUPABASE_URL")!, __env("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await supabase.from("tickets").select("id, guild_id, claimed_by_id, claimed_by_name, closed_by_id, closed_by_name").eq("id", ticket_id).maybeSingle();
    if (!ticket) return json({ error: "ticket not found" }, 404);

    const sid = staff_id || ticket.closed_by_id || ticket.claimed_by_id || null;
    const sname = staff_name || ticket.closed_by_name || ticket.claimed_by_name || null;

    const { error } = await supabase.from("ticket_ratings").upsert({
      ticket_id, guild_id: ticket.guild_id,
      rated_by_id: String(rated_by_id),
      staff_id: sid ? String(sid) : null,
      staff_name: sname,
      rating: Math.round(rating),
      comment: comment || null,
    }, { onConflict: "ticket_id" });

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/submit-ticket-rating')({
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
