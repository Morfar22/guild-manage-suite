// @ts-nocheck
// Migrated from Supabase Edge Function `global-ban-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SEVERITY_LABELS: Record<string, string> = {
  cheating: 'Cheating',
  harassment: 'Chikane',
  scam: 'Scam',
  raiding: 'Raiding',
  tos_violation: 'ToS Overtrædelse',
  other: 'Andet',
}

const SEVERITY_COLORS: Record<string, number> = {
  cheating: 0xef4444,
  harassment: 0xf97316,
  scam: 0xf59e0b,
  raiding: 0xa855f7,
  tos_violation: 0xec4899,
  other: 0x6b7280,
}

async function broadcastGlobalBanNotification(
  supabaseAdmin: any,
  ban: { target_discord_id: string; target_discord_name: string; reason: string; severity?: string }
) {
  try {
    const discordToken = __env('DISCORD_BOT_TOKEN')
    if (!discordToken) {
      console.error('DISCORD_BOT_TOKEN not set, skipping broadcast')
      return
    }

    // Get all guilds with log_channel_id configured
    const { data: logSettings } = await supabaseAdmin
      .from('log_settings')
      .select('guild_id, log_channel_id')
      .not('log_channel_id', 'is', null)

    if (!logSettings || logSettings.length === 0) return

    const sev = ban.severity || 'other'
    const embed = {
      title: '🚨 Global Ban Registreret',
      description: `En bruger er blevet globalt banned på tværs af alle servere.`,
      color: SEVERITY_COLORS[sev] || SEVERITY_COLORS.other,
      fields: [
        { name: 'Bruger', value: `${ban.target_discord_name}\n\`${ban.target_discord_id}\``, inline: true },
        { name: 'Severity', value: SEVERITY_LABELS[sev] || sev, inline: true },
        { name: 'Begrundelse', value: ban.reason.slice(0, 1024) },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Global Ban System' },
    }

    // Send to all log channels (fire-and-forget, don't block on failures)
    const promises = logSettings.map(async (ls: any) => {
      try {
        await fetch(`https://discord.com/api/v10/channels/${ls.log_channel_id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${discordToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed] }),
        })
      } catch (e) {
        console.error(`Failed to send global ban notification to channel ${ls.log_channel_id}:`, e)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    console.error('broadcastGlobalBanNotification error:', e)
  }
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = __env('SUPABASE_URL')!
    const supabaseAnonKey = __env('SUPABASE_ANON_KEY')!
    const serviceRoleKey = __env('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userId = claimsData.claims.sub

    // Check admin/staff role
    const { data: hasRole } = await supabaseAdmin.rpc('has_admin_or_staff_role', { _user_id: userId })
    
    const url = new URL(req.url)
    const method = req.method

    // GET actions
    if (method === 'GET') {
      const action = url.searchParams.get('action') || 'reports'
      
      if (action === 'reports') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const status = url.searchParams.get('status')
        let query = supabaseAdmin.from('global_ban_reports').select('*').order('created_at', { ascending: false })
        if (status) query = query.eq('status', status)
        const { data, error } = await query
        if (error) throw error
        return new Response(JSON.stringify({ reports: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (action === 'bans') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { data, error } = await supabaseAdmin.from('global_bans').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ bans: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (action === 'executions') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const banId = url.searchParams.get('ban_id')
        if (!banId) {
          return new Response(JSON.stringify({ error: 'ban_id required' }), { status: 400, headers: corsHeaders })
        }
        const { data, error } = await supabaseAdmin
          .from('global_ban_executions')
          .select('*, guilds(guild_name)')
          .eq('global_ban_id', banId)
        if (error) throw error
        return new Response(JSON.stringify({ executions: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // GET appeals
      if (action === 'appeals') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const status = url.searchParams.get('status')
        let query = supabaseAdmin.from('global_ban_appeals').select('*').order('created_at', { ascending: false })
        if (status) query = query.eq('status', status)
        const { data, error } = await query
        if (error) throw error
        return new Response(JSON.stringify({ appeals: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // GET stats
      if (action === 'stats') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { data: bans } = await supabaseAdmin.from('global_bans').select('id, created_at, severity')
        const { data: reports } = await supabaseAdmin.from('global_ban_reports').select('id, status, severity, created_at')
        const { data: appeals } = await supabaseAdmin.from('global_ban_appeals').select('id, status')

        const totalBans = bans?.length || 0
        const pendingReports = reports?.filter(r => r.status === 'pending').length || 0
        const approvedReports = reports?.filter(r => r.status === 'approved').length || 0
        const rejectedReports = reports?.filter(r => r.status === 'rejected').length || 0
        const totalReports = reports?.length || 0
        const approvalRate = totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0
        const pendingAppeals = appeals?.filter(a => a.status === 'pending').length || 0

        // Severity distribution
        const severityCounts: Record<string, number> = {}
        bans?.forEach(b => {
          const sev = (b as any).severity || 'other'
          severityCounts[sev] = (severityCounts[sev] || 0) + 1
        })

        // Monthly trend (last 6 months)
        const monthlyTrend: { month: string; count: number }[] = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const count = bans?.filter(b => b.created_at.startsWith(monthStr)).length || 0
          monthlyTrend.push({ month: monthStr, count })
        }

        return new Response(JSON.stringify({
          stats: {
            totalBans,
            pendingReports,
            approvedReports,
            rejectedReports,
            approvalRate,
            pendingAppeals,
            severityCounts,
            monthlyTrend,
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // POST actions
    if (method === 'POST') {
      const body = await req.json()
      const { action } = body

      // Create report (any authenticated user)
      if (action === 'create_report') {
        const { target_discord_id, target_discord_name, reason, evidence_urls, reporter_discord_id, reporter_discord_name, severity } = body
        if (!target_discord_id || !reason || !reporter_discord_id) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
        }
        const { data, error } = await supabaseAdmin.from('global_ban_reports').insert({
          reporter_discord_id,
          reporter_discord_name: reporter_discord_name || 'Unknown',
          target_discord_id,
          target_discord_name: target_discord_name || 'Unknown',
          reason,
          evidence_urls: evidence_urls || [],
          severity: severity || 'other',
        }).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ report: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Approve report (admin/staff only)
      if (action === 'approve') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { report_id, review_note } = body
        if (!report_id) {
          return new Response(JSON.stringify({ error: 'report_id required' }), { status: 400, headers: corsHeaders })
        }

        const { data: report, error: reportErr } = await supabaseAdmin
          .from('global_ban_reports')
          .select('*')
          .eq('id', report_id)
          .single()
        if (reportErr || !report) {
          return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404, headers: corsHeaders })
        }

        await supabaseAdmin.from('global_ban_reports').update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
        }).eq('id', report_id)

        const { data: ban, error: banErr } = await supabaseAdmin.from('global_bans').insert({
          report_id,
          target_discord_id: report.target_discord_id,
          target_discord_name: report.target_discord_name,
          reason: report.reason,
          banned_by: userId,
          severity: (report as any).severity || 'other',
        }).select().single()
        if (banErr) throw banErr

        const { data: guilds } = await supabaseAdmin.from('guilds').select('id')
        
        if (guilds) {
          const { data: optOuts } = await supabaseAdmin
            .from('guild_bot_settings')
            .select('guild_id')
            .eq('global_ban_opt_out', true)
          
          const optOutGuildIds = new Set((optOuts || []).map(o => o.guild_id))
          
          const executions = guilds
            .filter(g => !optOutGuildIds.has(g.id))
            .map(g => ({
              global_ban_id: ban.id,
              guild_id: g.id,
            }))

          if (executions.length > 0) {
            await supabaseAdmin.from('global_ban_executions').insert(executions)
          }
        }

        // Broadcast notification to all guilds with logging
        await broadcastGlobalBanNotification(supabaseAdmin, ban)

        return new Response(JSON.stringify({ ban, message: 'Report approved and global ban created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Reject report
      if (action === 'reject') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { report_id, review_note } = body
        if (!report_id) {
          return new Response(JSON.stringify({ error: 'report_id required' }), { status: 400, headers: corsHeaders })
        }
        const { error } = await supabaseAdmin.from('global_ban_reports').update({
          status: 'rejected',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
        }).eq('id', report_id)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Report rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Unban
      if (action === 'unban') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { ban_id } = body
        if (!ban_id) {
          return new Response(JSON.stringify({ error: 'ban_id required' }), { status: 400, headers: corsHeaders })
        }
        await supabaseAdmin.from('global_ban_executions').delete().eq('global_ban_id', ban_id)
        const { error } = await supabaseAdmin.from('global_bans').delete().eq('id', ban_id)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Global ban removed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Direct ban (admin/staff only - skips report flow)
      if (action === 'direct_ban') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { target_discord_id, target_discord_name, reason, severity } = body
        if (!target_discord_id || !reason) {
          return new Response(JSON.stringify({ error: 'target_discord_id and reason required' }), { status: 400, headers: corsHeaders })
        }

        const { data: ban, error: banErr } = await supabaseAdmin.from('global_bans').insert({
          report_id: null,
          target_discord_id,
          target_discord_name: target_discord_name || 'Unknown',
          reason,
          banned_by: userId,
          severity: severity || 'other',
        }).select().single()
        if (banErr) throw banErr

        // Create executions for all guilds (respecting opt-out)
        const { data: guilds } = await supabaseAdmin.from('guilds').select('id')
        if (guilds) {
          const { data: optOuts } = await supabaseAdmin
            .from('guild_bot_settings')
            .select('guild_id')
            .eq('global_ban_opt_out', true)
          const optOutGuildIds = new Set((optOuts || []).map(o => o.guild_id))
          const executions = guilds
            .filter(g => !optOutGuildIds.has(g.id))
            .map(g => ({ global_ban_id: ban.id, guild_id: g.id }))
          if (executions.length > 0) {
            await supabaseAdmin.from('global_ban_executions').insert(executions)
          }
        }

        // Broadcast notification to all guilds with logging
        await broadcastGlobalBanNotification(supabaseAdmin, ban)

        return new Response(JSON.stringify({ ban, message: 'Direct global ban created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Create appeal (any authenticated user)
      if (action === 'create_appeal') {
        const { ban_id, appellant_discord_id, appellant_discord_name, reason } = body
        if (!ban_id || !appellant_discord_id || !reason) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
        }
        const { data, error } = await supabaseAdmin.from('global_ban_appeals').insert({
          ban_id,
          appellant_discord_id,
          appellant_discord_name: appellant_discord_name || 'Unknown',
          reason,
        }).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ appeal: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Approve appeal (admin/staff)
      if (action === 'approve_appeal') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { appeal_id, review_note } = body
        if (!appeal_id) {
          return new Response(JSON.stringify({ error: 'appeal_id required' }), { status: 400, headers: corsHeaders })
        }

        const { data: appeal, error: appealErr } = await supabaseAdmin
          .from('global_ban_appeals')
          .select('*')
          .eq('id', appeal_id)
          .single()
        if (appealErr || !appeal) {
          return new Response(JSON.stringify({ error: 'Appeal not found' }), { status: 404, headers: corsHeaders })
        }

        await supabaseAdmin.from('global_ban_appeals').update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
        }).eq('id', appeal_id)

        // Remove the ban
        await supabaseAdmin.from('global_ban_executions').delete().eq('global_ban_id', appeal.ban_id)
        await supabaseAdmin.from('global_bans').delete().eq('id', appeal.ban_id)

        return new Response(JSON.stringify({ message: 'Appeal approved, ban removed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Reject appeal (admin/staff)
      if (action === 'reject_appeal') {
        if (!hasRole) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }
        const { appeal_id, review_note } = body
        if (!appeal_id) {
          return new Response(JSON.stringify({ error: 'appeal_id required' }), { status: 400, headers: corsHeaders })
        }
        const { error } = await supabaseAdmin.from('global_ban_appeals').update({
          status: 'rejected',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
        }).eq('id', appeal_id)
        if (error) throw error
        return new Response(JSON.stringify({ message: 'Appeal rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/global-ban-handler')({
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
