// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (key: string) => process.env[key] ?? (key === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any) => { __handler = fn }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createBridgeToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const value = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `gms_${value}`
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = __env('SUPABASE_URL')
    const serviceKey = __env('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration missing' }, 500)

    const supabase = createClient(supabaseUrl, serviceKey)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const token = authHeader.slice('Bearer '.length)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { guild_id, action = 'status' } = await req.json()
    if (!guild_id) return json({ error: 'guild_id is required' }, 400)

    const { data: membership } = await supabase
      .from('user_guilds')
      .select('has_admin_permission')
      .eq('user_id', user.id)
      .eq('guild_id', guild_id)
      .maybeSingle()

    if (!membership?.has_admin_permission) return json({ error: 'No permission for this guild' }, 403)

    const { data: guild } = await supabase
      .from('guilds')
      .select('guild_id, guild_name')
      .eq('id', guild_id)
      .maybeSingle()

    if (!guild) return json({ error: 'Guild not found' }, 404)

    if (action === 'status') {
      const { data: settings } = await supabase
        .from('fivem_settings')
        .select('enabled, bridge_token_hash, bridge_token_created_at, bridge_last_seen_at, bridge_version, bridge_framework')
        .eq('guild_id', guild_id)
        .maybeSingle()

      return json({
        configured: Boolean(settings?.bridge_token_hash),
        enabled: Boolean(settings?.enabled),
        tokenCreatedAt: settings?.bridge_token_created_at || null,
        lastSeenAt: settings?.bridge_last_seen_at || null,
        bridgeVersion: settings?.bridge_version || null,
        framework: settings?.bridge_framework || null,
        discordGuildId: guild.guild_id,
        guildName: guild.guild_name,
        apiBase: __env('PUBLIC_APP_URL') || __env('APP_URL') || 'https://bot.nethost-solutions.dk',
      })
    }

    if (action === 'rotate') {
      const rawToken = createBridgeToken()
      const tokenHash = await sha256Hex(rawToken)
      const now = new Date().toISOString()

      const { error } = await supabase
        .from('fivem_settings')
        .upsert({
          guild_id,
          enabled: true,
          bridge_token_hash: tokenHash,
          bridge_token_created_at: now,
          bridge_last_seen_at: null,
          bridge_version: null,
          bridge_framework: null,
          updated_at: now,
        }, { onConflict: 'guild_id' })

      if (error) {
        console.error('[FiveM Setup] Failed to rotate bridge token:', error)
        return json({ error: 'Could not create bridge key' }, 500)
      }

      return json({
        success: true,
        token: rawToken,
        discordGuildId: guild.guild_id,
        guildName: guild.guild_name,
        apiBase: __env('PUBLIC_APP_URL') || __env('APP_URL') || 'https://bot.nethost-solutions.dk',
        warning: 'Gem nøglen nu. Den vises ikke igen.',
      })
    }

    if (action === 'revoke') {
      const { error } = await supabase
        .from('fivem_settings')
        .update({
          bridge_token_hash: null,
          bridge_token_created_at: null,
          bridge_last_seen_at: null,
          bridge_version: null,
          bridge_framework: null,
          updated_at: new Date().toISOString(),
        })
        .eq('guild_id', guild_id)

      if (error) return json({ error: 'Could not revoke bridge key' }, 500)
      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (error) {
    console.error('[FiveM Setup] Error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/fivem-setup-key')({
  server: {
    handlers: {
      POST: __call,
      OPTIONS: __call,
    },
  },
})
