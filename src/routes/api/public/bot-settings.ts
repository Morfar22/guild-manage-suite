// @ts-nocheck
// Migrated from Supabase Edge Function `bot-settings` to a TanStack server route.
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

  const { count } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) === 0) return { allowed: true, ip: clientIp };

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

__serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate bot secret
    const botSecret = req.headers.get('x-bot-secret')
    const expectedSecret = __env('BOT_SECRET_KEY')
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error('Invalid or missing bot secret')
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

    const url = new URL(req.url)
    const guildId = url.searchParams.get('guild_id')

    if (!guildId) {
      return new Response(
        JSON.stringify({ error: 'Missing guild_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetching settings for guild: ${guildId}`)

    // Fetch guild settings - guild_id is the Discord ID (text)
    const { data: guild, error: guildError } = await supabase
      .from('guilds')
      .select('*')
      .eq('guild_id', guildId)
      .single()

    if (guildError || !guild) {
      console.error('Guild not found:', guildError)
      return new Response(
        JSON.stringify({ error: 'Guild not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch modules for this guild
    const { data: modules, error: modulesError } = await supabase
      .from('guild_modules')
      .select('module_type, enabled')
      .eq('guild_id', guild.id)

    if (modulesError) {
      console.error('Error fetching modules:', modulesError)
    }

    // Transform modules to object format
    const modulesObj: Record<string, boolean> = {}
    if (modules) {
      for (const mod of modules) {
        modulesObj[mod.module_type] = mod.enabled
      }
    }

    // Fetch commands for this guild
    const { data: commands, error: commandsError } = await supabase
      .from('guild_commands')
      .select('command_name, category, enabled')
      .eq('guild_id', guild.id)

    if (commandsError) {
      console.error('Error fetching commands:', commandsError)
    }

    // Transform commands to object format
    const commandsObj: Record<string, boolean> = {}
    if (commands) {
      for (const cmd of commands) {
        commandsObj[cmd.command_name] = cmd.enabled
      }
    }

    const response = {
      guild: {
        id: guild.id,
        guild_id: guild.guild_id,
        guild_name: guild.guild_name,
        command_prefix: guild.command_prefix,
        log_channel_id: guild.log_channel_id,
        auto_moderation_enabled: guild.auto_moderation_enabled,
      },
      modules: modulesObj,
      commands: commandsObj,
    }

    console.log(`Successfully fetched settings for guild: ${guild.guild_name}`)

    return new Response(
      JSON.stringify(response),
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

export const Route = createFileRoute('/api/public/bot-settings')({
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
