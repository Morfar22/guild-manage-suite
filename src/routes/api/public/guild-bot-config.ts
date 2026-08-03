// @ts-nocheck
// Migrated from Supabase Edge Function `guild-bot-config` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple encryption using XOR with a key - for production use proper encryption
function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const encryptionKey = __env('BOT_SECRET_KEY') || 'default-encryption-key'
    const botSecret = req.headers.get('x-bot-secret')
    const authHeader = req.headers.get('Authorization')

    // Parse JSON body early for POST/PUT/PATCH to support actions that don't require guild_id in query
    // (e.g. dashboard-only utilities like token testing + global status)
    const canHaveBody = ['POST', 'PUT', 'PATCH'].includes(req.method)
    const safeJson = async () => {
      try {
        return await req.json()
      } catch {
        return null
      }
    }
    const body = canHaveBody ? await safeJson() : null

    // Bot-to-API calls (from VPS)
    if (botSecret) {
      if (botSecret !== encryptionKey) {
        return new Response(
          JSON.stringify({ error: 'Invalid bot secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const adminSupabase = createClient(
        __env('SUPABASE_URL')!,
        __env('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { action } = (body || {}) as { action?: string }

      // List all active custom bots (for bot manager to start them)
      if (action === 'list_active') {
        const { data: configs, error } = await adminSupabase
          .from('guild_bot_settings')
          .select(`
            guild_id,
            bot_token_encrypted,
            bot_client_id,
            bot_name,
            bot_avatar_url,
            bot_status,
            bot_activity_type,
            bot_activity_text,
            is_active
          `)
          .eq('is_custom_bot', true)
          .eq('is_active', true)

        if (error) {
          console.error('Error fetching active configs:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch configs' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Decrypt tokens for bot manager
        const decryptedConfigs = (configs || []).map(config => ({
          ...config,
          bot_token: config.bot_token_encrypted 
            ? simpleDecrypt(config.bot_token_encrypted, encryptionKey)
            : null,
          bot_token_encrypted: undefined
        }))

        console.log(`Returning ${decryptedConfigs.length} active bot config(s)`)

        return new Response(
          JSON.stringify({ configs: decryptedConfigs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Heartbeat from bot
      if (action === 'heartbeat') {
        const { guild_id, is_online, latency_ms, member_count, is_custom_bot } = body

        if (!guild_id) {
          return new Response(
            JSON.stringify({ error: 'Missing guild_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // guild_id should be our internal UUID, but the bot may send a Discord snowflake guild ID.
        // If it's not a UUID, resolve it via public.guilds.guild_id (discord id) -> public.guilds.id (uuid).
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        let resolvedGuildId: string = String(guild_id)

        if (!uuidRegex.test(resolvedGuildId)) {
          const { data: guildRow, error: guildLookupError } = await adminSupabase
            .from('guilds')
            .select('id')
            .eq('guild_id', resolvedGuildId)
            .maybeSingle()

          if (guildLookupError) {
            console.error('Error resolving guild snowflake to uuid:', guildLookupError)
            return new Response(
              JSON.stringify({ error: 'Failed to resolve guild id' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          if (!guildRow?.id) {
            return new Response(
              JSON.stringify({ error: 'Unknown guild id' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          resolvedGuildId = guildRow.id
        }

        // Update bot_status table
        const { error: statusError } = await adminSupabase
          .from('bot_status')
          .upsert({
            guild_id: resolvedGuildId,
            is_online,
            latency_ms,
            member_count,
            last_heartbeat: new Date().toISOString()
          }, { onConflict: 'guild_id' })

        if (statusError) {
          console.error('Error updating bot status:', statusError)
        }

        // Update last_connected_at if custom bot
        if (is_custom_bot && is_online) {
          await adminSupabase
            .from('guild_bot_settings')
            .update({ last_connected_at: new Date().toISOString() })
            .eq('guild_id', resolvedGuildId)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Report error from bot
      if (action === 'report_error') {
        const { guild_id, error: errorMsg } = body

        console.error(`Bot error for guild ${guild_id}:`, errorMsg)

        // Optionally disable the bot on repeated errors
        // For now just log it

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get status of all running bots (for dashboard)
      if (action === 'get_status') {
        const { data: botStatuses, error: statusError } = await adminSupabase
          .from('bot_status')
          .select(`
            guild_id,
            is_online,
            latency_ms,
            member_count,
            last_heartbeat
          `)
          .eq('is_online', true)

        if (statusError) {
          console.error('Error fetching bot statuses:', statusError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch bot statuses' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get custom bot settings for context
        const { data: customBots } = await adminSupabase
          .from('guild_bot_settings')
          .select(`
            guild_id,
            bot_name,
            bot_avatar_url,
            is_custom_bot,
            is_active,
            last_connected_at
          `)
          .eq('is_custom_bot', true)
          .eq('is_active', true)

        // Merge data
        const statusMap = new Map()
        for (const status of botStatuses || []) {
          statusMap.set(status.guild_id, status)
        }

        const customBotMap = new Map()
        for (const bot of customBots || []) {
          customBotMap.set(bot.guild_id, bot)
        }

        // Get guild names for context
        const guildIds = [...statusMap.keys()]
        const { data: guilds } = await adminSupabase
          .from('guilds')
          .select('id, guild_name, guild_icon')
          .in('id', guildIds)

        const guildMap = new Map()
        for (const guild of guilds || []) {
          guildMap.set(guild.id, guild)
        }

        const activeBots = guildIds.map(guildId => {
          const status = statusMap.get(guildId)
          const customBot = customBotMap.get(guildId)
          const guild = guildMap.get(guildId)

          return {
            guild_id: guildId,
            guild_name: guild?.guild_name || 'Unknown',
            guild_icon: guild?.guild_icon,
            is_online: status?.is_online || false,
            latency_ms: status?.latency_ms || 0,
            member_count: status?.member_count || 0,
            last_heartbeat: status?.last_heartbeat,
            is_custom_bot: !!customBot,
            bot_name: customBot?.bot_name || 'Default Bot',
            bot_avatar_url: customBot?.bot_avatar_url,
          }
        })

        console.log(`Returning status for ${activeBots.length} active bot(s)`)

        return new Response(
          JSON.stringify({ bots: activeBots }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Test a bot token (validate it works with Discord API)
      if (action === 'test_token') {
        const { token } = body

        if (!token) {
          return new Response(
            JSON.stringify({ error: 'Missing token' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        try {
          // Call Discord API to validate token and get bot info
          const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
              Authorization: `Bot ${token}`,
            },
          })

          if (!discordResponse.ok) {
            const errorText = await discordResponse.text()
            console.error('Discord API error:', errorText)
            return new Response(
              JSON.stringify({ 
                valid: false, 
                error: 'Invalid token or Discord API error',
                details: discordResponse.status === 401 ? 'Token er ugyldig' : 'Discord API fejl'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          const botUser = await discordResponse.json()

          return new Response(
            JSON.stringify({ 
              valid: true, 
              bot: {
                id: botUser.id,
                username: botUser.username,
                discriminator: botUser.discriminator,
                avatar: botUser.avatar,
                avatar_url: botUser.avatar 
                  ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png`
                  : null,
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Error testing token:', error)
          return new Response(
            JSON.stringify({ valid: false, error: 'Network error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Dashboard requests (user authenticated)
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // CRITICAL: Pass token explicitly when verify_jwt=false in Lovable Cloud
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id

    // Handle dashboard utility actions that don't map to a single guild_id
    // Use service role for reads to avoid RLS coupling, but limit results to the guilds the user admins.
    if (body && typeof (body as any).action === 'string') {
      const action = (body as any).action as string

      if (action === 'test_token') {
        const tokenToTest = (body as any).token as string | undefined
        if (!tokenToTest) {
          return new Response(
            JSON.stringify({ error: 'Missing token' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        try {
          const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${tokenToTest}` },
          })

          if (!discordResponse.ok) {
            const errorText = await discordResponse.text()
            console.error('Discord API error:', errorText)
            return new Response(
              JSON.stringify({
                valid: false,
                error: 'Invalid token or Discord API error',
                details: discordResponse.status === 401 ? 'Token er ugyldig' : 'Discord API fejl',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          const botUser = await discordResponse.json()
          return new Response(
            JSON.stringify({
              valid: true,
              bot: {
                id: botUser.id,
                username: botUser.username,
                discriminator: botUser.discriminator,
                avatar: botUser.avatar,
                avatar_url: botUser.avatar
                  ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png`
                  : null,
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Error testing token:', error)
          return new Response(
            JSON.stringify({ valid: false, error: 'Network error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Admin-only: Get ALL active bots across all guilds
      if (action === 'admin_get_all_bots') {
        const adminSupabase = createClient(
          __env('SUPABASE_URL')!,
          __env('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Check if user has admin OR staff role using the database function (handles enum properly)
        const { data: hasRole, error: roleError } = await adminSupabase
          .rpc('has_admin_or_staff_role', { _user_id: userId })

        if (roleError) {
          console.error('Error checking admin/staff role:', roleError)
          return new Response(
            JSON.stringify({ error: 'Failed to check permissions' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!hasRole) {
          return new Response(
            JSON.stringify({ error: 'Admin or staff access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch ALL bot statuses (not just user's guilds)
        const { data: allBotStatuses, error: statusError } = await adminSupabase
          .from('bot_status')
          .select('guild_id, is_online, latency_ms, member_count, last_heartbeat, updated_at')
          .order('last_heartbeat', { ascending: false })

        if (statusError) {
          console.error('Error fetching all bot statuses:', statusError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch bot statuses' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const guildIds = (allBotStatuses || []).map((s) => s.guild_id)
        if (guildIds.length === 0) {
          return new Response(
            JSON.stringify({ bots: [], stats: { total: 0, online: 0, offline: 0 } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get custom bot settings
        const { data: customBots } = await adminSupabase
          .from('guild_bot_settings')
          .select('guild_id, bot_name, bot_avatar_url, is_custom_bot, is_active, last_connected_at')
          .in('guild_id', guildIds)

        // Get guild info
        const { data: guilds } = await adminSupabase
          .from('guilds')
          .select('id, guild_id, guild_name, guild_icon, owner_id')
          .in('id', guildIds)

        const statusMap = new Map((allBotStatuses || []).map((s) => [s.guild_id, s]))
        const customBotMap = new Map((customBots || []).map((b) => [b.guild_id, b]))
        const guildMap = new Map((guilds || []).map((g) => [g.id, g]))

        const allBots = guildIds.map((gid) => {
          const status = statusMap.get(gid)
          const customBot = customBotMap.get(gid)
          const guild = guildMap.get(gid)
          return {
            guild_id: gid,
            discord_guild_id: guild?.guild_id,
            guild_name: guild?.guild_name || 'Unknown',
            guild_icon: guild?.guild_icon,
            owner_id: guild?.owner_id,
            is_online: status?.is_online || false,
            latency_ms: status?.latency_ms || 0,
            member_count: status?.member_count || 0,
            last_heartbeat: status?.last_heartbeat,
            updated_at: status?.updated_at,
            is_custom_bot: customBot?.is_custom_bot || false,
            custom_bot_active: customBot?.is_active || false,
            bot_name: customBot?.bot_name || 'Default Bot',
            bot_avatar_url: customBot?.bot_avatar_url,
          }
        })

        const onlineCount = allBots.filter(b => b.is_online).length
        const offlineCount = allBots.filter(b => !b.is_online).length

        console.log(`[Admin] Returning ${allBots.length} bot(s) - ${onlineCount} online, ${offlineCount} offline`)

        return new Response(
          JSON.stringify({ 
            bots: allBots,
            stats: {
              total: allBots.length,
              online: onlineCount,
              offline: offlineCount,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Admin-only: Remove bot from a guild (leave the Discord server + clean up DB)
      if (action === 'admin_leave_guild') {
        const adminSupabase = createClient(
          __env('SUPABASE_URL')!,
          __env('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { data: hasRole } = await adminSupabase
          .rpc('has_admin_or_staff_role', { _user_id: userId })
        if (!hasRole) {
          return new Response(
            JSON.stringify({ error: 'Admin or staff access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const targetGuildId = (body as any).guild_id as string | undefined
        if (!targetGuildId) {
          return new Response(
            JSON.stringify({ error: 'Missing guild_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get discord guild id from our guilds table (may be missing for stale rows)
        const { data: guildRow } = await adminSupabase
          .from('guilds')
          .select('id, guild_id')
          .eq('id', targetGuildId)
          .maybeSingle()

        const discordGuildId = guildRow?.guild_id as string | undefined

        // Determine which bot token to use: custom bot or default
        let botToken = __env('DISCORD_BOT_TOKEN')
        const { data: customBotSettings } = await adminSupabase
          .from('guild_bot_settings')
          .select('bot_token_encrypted, is_custom_bot, is_active')
          .eq('guild_id', targetGuildId)
          .eq('is_custom_bot', true)
          .eq('is_active', true)
          .maybeSingle()

        if (customBotSettings?.bot_token_encrypted) {
          try {
            botToken = simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey)
          } catch (err) {
            console.error('Failed to decrypt custom bot token:', err)
          }
        }

        let discordWarning: string | null = null

        // Call Discord API to leave the guild
        if (botToken && discordGuildId) {
          try {
            const leaveRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${discordGuildId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bot ${botToken}` },
            })
            if (!leaveRes.ok && leaveRes.status !== 404) {
              const errText = await leaveRes.text()
              console.error(`Discord leave guild failed (${leaveRes.status}):`, errText)
              return new Response(
                JSON.stringify({ error: `Discord afviste anmodningen (${leaveRes.status}): ${errText.slice(0, 200)}` }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            if (leaveRes.status === 404) {
              discordWarning = 'Botten var ikke medlem af serveren – rydder kun op i databasen.'
            }
            console.log(`[Admin] Bot left Discord guild ${discordGuildId}`)
          } catch (err) {
            console.error('Error calling Discord leave guild:', err)
            return new Response(
              JSON.stringify({ error: 'Kunne ikke kontakte Discord API' }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          discordWarning = !discordGuildId
            ? 'Serveren findes ikke længere i databasen – rydder kun op i bot-data.'
            : 'Intet bot-token tilgængeligt – rydder kun op i bot-data.'
          console.warn(`[Admin] leave_guild without Discord call: ${discordWarning}`)
        }

        // Clean up DB: bot_status, guild_bot_settings
        await adminSupabase.from('bot_status').delete().eq('guild_id', targetGuildId)
        await adminSupabase.from('guild_bot_settings').delete().eq('guild_id', targetGuildId)

        console.log(`[Admin] Cleaned up DB for guild ${targetGuildId}`)

        return new Response(
          JSON.stringify({ success: true, warning: discordWarning }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_status') {
        const adminSupabase = createClient(
          __env('SUPABASE_URL')!,
          __env('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Only show bots for guilds the user is admin in
        const { data: adminGuilds, error: adminGuildsError } = await adminSupabase
          .from('user_guilds')
          .select('guild_id')
          .eq('user_id', userId)
          .eq('has_admin_permission', true)

        if (adminGuildsError) {
          console.error('Error fetching admin guilds:', adminGuildsError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch permissions' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const guildIds = (adminGuilds || []).map((g) => g.guild_id)
        if (guildIds.length === 0) {
          return new Response(
            JSON.stringify({ bots: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: botStatuses, error: statusError } = await adminSupabase
          .from('bot_status')
          .select('guild_id, is_online, latency_ms, member_count, last_heartbeat')
          .eq('is_online', true)
          .in('guild_id', guildIds)

        if (statusError) {
          console.error('Error fetching bot statuses:', statusError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch bot statuses' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const onlineGuildIds = (botStatuses || []).map((s) => s.guild_id)
        if (onlineGuildIds.length === 0) {
          return new Response(
            JSON.stringify({ bots: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: customBots } = await adminSupabase
          .from('guild_bot_settings')
          .select('guild_id, bot_name, bot_avatar_url, is_custom_bot, is_active, last_connected_at')
          .eq('is_custom_bot', true)
          .eq('is_active', true)
          .in('guild_id', onlineGuildIds)

        const { data: guilds } = await adminSupabase
          .from('guilds')
          .select('id, guild_name, guild_icon')
          .in('id', onlineGuildIds)

        const statusMap = new Map((botStatuses || []).map((s) => [s.guild_id, s]))
        const customBotMap = new Map((customBots || []).map((b) => [b.guild_id, b]))
        const guildMap = new Map((guilds || []).map((g) => [g.id, g]))

        const activeBots = onlineGuildIds.map((gid) => {
          const status = statusMap.get(gid)
          const customBot = customBotMap.get(gid)
          const guild = guildMap.get(gid)
          return {
            guild_id: gid,
            guild_name: guild?.guild_name || 'Unknown',
            guild_icon: guild?.guild_icon,
            is_online: status?.is_online || false,
            latency_ms: status?.latency_ms || 0,
            member_count: status?.member_count || 0,
            last_heartbeat: status?.last_heartbeat,
            is_custom_bot: !!customBot,
            bot_name: customBot?.bot_name || 'Default Bot',
            bot_avatar_url: customBot?.bot_avatar_url,
          }
        })

        return new Response(
          JSON.stringify({ bots: activeBots }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const url = new URL(req.url)
    const guildId = url.searchParams.get('guild_id')

    if (!guildId) {
      return new Response(
        JSON.stringify({ error: 'Missing guild_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has admin permission for this guild
    // First check if user is a platform admin/staff — they bypass guild-level checks
    const adminSupabaseForCheck = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: isPlatformAdmin } = await adminSupabaseForCheck
      .rpc('has_admin_or_staff_role', { _user_id: userId })

    if (!isPlatformAdmin) {
      const { data: userGuild, error: userGuildError } = await supabase
        .from('user_guilds')
        .select('has_admin_permission')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single()

      if (userGuildError || !userGuild?.has_admin_permission) {
        console.error('Permission denied:', userGuildError)
        return new Response(
          JSON.stringify({ error: 'Permission denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'GET') {
      // Fetch bot settings (without exposing full token)
      const { data: settings, error } = await supabase
        .from('guild_bot_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching settings:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mask the token if it exists
      let response = settings
      if (settings?.bot_token_encrypted) {
        const decrypted = simpleDecrypt(settings.bot_token_encrypted, encryptionKey)
        response = {
          ...settings,
          bot_token_masked: decrypted ? `${decrypted.substring(0, 10)}...${decrypted.substring(decrypted.length - 5)}` : null,
          bot_token_encrypted: undefined, // Don't expose encrypted token
        }
      }

      return new Response(
        JSON.stringify({ settings: response }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Use the already-parsed body from line 46 instead of reading req.json() again
      // This prevents "Body already consumed" errors
      const postBody = body || {}
      const {
        is_custom_bot,
        bot_token,
        bot_client_id,
        bot_public_key,
        bot_name,
        bot_avatar_url,
        bot_status,
        bot_activity_type,
        bot_activity_text,
        is_active,
      } = postBody

      // Encrypt token if provided
      let encryptedToken = undefined
      if (bot_token) {
        encryptedToken = simpleEncrypt(bot_token, encryptionKey)
      }

      // Check if settings exist
      const { data: existing } = await supabase
        .from('guild_bot_settings')
        .select('id')
        .eq('guild_id', guildId)
        .maybeSingle()

      const settingsData: Record<string, unknown> = {
        guild_id: guildId,
        is_custom_bot: is_custom_bot ?? false,
        bot_client_id,
        bot_public_key,
        bot_name,
        bot_avatar_url,
        bot_status,
        bot_activity_type,
        bot_activity_text,
        is_active: is_active ?? false,
      }

      // Only update token if provided
      if (encryptedToken) {
        settingsData.bot_token_encrypted = encryptedToken
      }

      let result
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('guild_bot_settings')
          .update(settingsData)
          .eq('guild_id', guildId)
          .select()
          .single()
        
        if (error) throw error
        result = data
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('guild_bot_settings')
          .insert(settingsData)
          .select()
          .single()
        
        if (error) throw error
        result = data
      }

      // Mask token in response
      if (result?.bot_token_encrypted) {
        const decrypted = simpleDecrypt(result.bot_token_encrypted, encryptionKey)
        result = {
          ...result,
          bot_token_masked: decrypted ? `${decrypted.substring(0, 10)}...${decrypted.substring(decrypted.length - 5)}` : null,
          bot_token_encrypted: undefined,
        }
      }

      console.log(`Bot settings saved for guild: ${guildId}`)

      return new Response(
        JSON.stringify({ settings: result, success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('guild_bot_settings')
        .delete()
        .eq('guild_id', guildId)

      if (error) {
        console.error('Error deleting settings:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to delete settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

export const Route = createFileRoute('/api/public/guild-bot-config')({
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
