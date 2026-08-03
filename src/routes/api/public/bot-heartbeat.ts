// @ts-nocheck
// Migrated from Supabase Edge Function `bot-heartbeat` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
}

// Helper function to check if IP is whitelisted
async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Check if whitelist is empty (allow all if no IPs configured)
  const { count, error: countError } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Whitelist count error:", countError);
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

interface HeartbeatPayload {
  guild_id: string // Discord guild ID
  is_online: boolean
  latency_ms: number
  member_count?: number
  message_count_today?: number
}

__serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Validate bot secret
    const botSecret = req.headers.get('x-bot-secret')
    const expectedSecret = __env('BOT_SECRET_KEY')
    
    // Debug: Log first 4 chars of each secret for troubleshooting
    const receivedPrefix = botSecret ? botSecret.substring(0, 4) : 'null'
    const expectedPrefix = expectedSecret ? expectedSecret.substring(0, 4) : 'null'
    console.log(`Secret check: received="${receivedPrefix}..." expected="${expectedPrefix}..."`)
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error(`Invalid or missing bot secret. Received length: ${botSecret?.length ?? 0}, Expected length: ${expectedSecret?.length ?? 0}`)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid bot secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check IP whitelist
    const ipCheck = await checkIPWhitelist(req, supabase);
    if (!ipCheck.allowed) {
      console.error(`IP not whitelisted: ${ipCheck.ip}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: HeartbeatPayload = await req.json()

    if (!payload.guild_id) {
      return new Response(
        JSON.stringify({ error: 'Missing guild_id in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Heartbeat received for guild: ${payload.guild_id}`)

    // Find the guild by Discord guild_id
    const { data: guild, error: guildError } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', payload.guild_id)
      .single()

    if (guildError || !guild) {
      console.error('Guild not found:', guildError)
      return new Response(
        JSON.stringify({ error: 'Guild not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upsert bot status
    const { error: upsertError } = await supabase
      .from('bot_status')
      .upsert({
        guild_id: guild.id,
        is_online: payload.is_online,
        latency_ms: payload.latency_ms,
        member_count: payload.member_count ?? 0,
        message_count_today: payload.message_count_today ?? 0,
        last_heartbeat: new Date().toISOString(),
      }, {
        onConflict: 'guild_id'
      })

    if (upsertError) {
      console.error('Error upserting bot status:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to update status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Heartbeat updated for guild: ${payload.guild_id}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Heartbeat recorded' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/bot-heartbeat')({
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
