import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
}

interface LogActionPayload {
  guild_id: string
  action_type: 'ban' | 'kick' | 'mute' | 'warn' | 'delete' | 'timeout' | 'unban' | 'unmute'
  moderator_id: string
  moderator_name?: string
  target_id: string
  target_name?: string
  reason?: string
  duration_seconds?: number
}

async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") || 
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
    req.headers.get("x-real-ip") || 
    "unknown";

  const { count, error: countError } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error checking whitelist count:", countError);
    return { allowed: false, ip: clientIp };
  }

  if ((count ?? 0) === 0) {
    return { allowed: true, ip: clientIp };
  }

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

Deno.serve(async (req) => {
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
    const expectedSecret = Deno.env.get('BOT_SECRET_KEY')
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error('Invalid or missing bot secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid bot secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    const payload: LogActionPayload = await req.json()

    // Validate required fields
    if (!payload.guild_id || !payload.action_type || !payload.moderator_id || !payload.target_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: guild_id, action_type, moderator_id, target_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Logging action: ${payload.action_type} in guild ${payload.guild_id}`)

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

    // Insert moderation log
    const { data: log, error: insertError } = await supabase
      .from('moderation_logs')
      .insert({
        guild_id: guild.id,
        action_type: payload.action_type,
        moderator_id: payload.moderator_id,
        moderator_name: payload.moderator_name,
        target_id: payload.target_id,
        target_name: payload.target_name,
        reason: payload.reason,
        duration_seconds: payload.duration_seconds,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting moderation log:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to log action' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Action logged successfully: ${log.id}`)

    return new Response(
      JSON.stringify({ success: true, log_id: log.id }),
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
