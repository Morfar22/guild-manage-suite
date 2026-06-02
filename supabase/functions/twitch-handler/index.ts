import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

interface TwitchTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface TwitchStream {
  id: string
  user_id: string
  user_login: string
  user_name: string
  game_id: string
  game_name: string
  type: string
  title: string
  viewer_count: number
  started_at: string
  language: string
  thumbnail_url: string
  is_mature: boolean
}

interface TwitchUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

async function getTwitchToken(): Promise<string> {
  const clientId = Deno.env.get('TWITCH_CLIENT_ID')
  const clientSecret = Deno.env.get('TWITCH_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Twitch credentials not configured')
  }

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get Twitch token: ${response.status}`)
  }

  const data: TwitchTokenResponse = await response.json()
  return data.access_token
}

async function getTwitchUser(username: string, token: string): Promise<TwitchUser | null> {
  const clientId = Deno.env.get('TWITCH_CLIENT_ID')!

  const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  })

  if (!response.ok) {
    console.error(`Failed to get Twitch user: ${response.status}`)
    return null
  }

  const data = await response.json()
  return data.data?.[0] || null
}

async function getStreams(userIds: string[], token: string): Promise<TwitchStream[]> {
  if (userIds.length === 0) return []

  const clientId = Deno.env.get('TWITCH_CLIENT_ID')!
  const queryParams = userIds.map(id => `user_id=${id}`).join('&')

  const response = await fetch(`https://api.twitch.tv/helix/streams?${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  })

  if (!response.ok) {
    console.error(`Failed to get streams: ${response.status}`)
    return []
  }

  const data = await response.json()
  return data.data || []
}

interface TwitchClip {
  id: string
  url: string
  embed_url: string
  broadcaster_id: string
  broadcaster_name: string
  creator_id: string
  creator_name: string
  video_id: string
  game_id: string
  language: string
  title: string
  view_count: number
  created_at: string
  thumbnail_url: string
  duration: number
}

interface TwitchVideo {
  id: string
  stream_id: string | null
  user_id: string
  user_login: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: string // 'archive', 'highlight', 'upload'
  duration: string
}

async function getClips(broadcasterId: string, token: string, after?: string): Promise<TwitchClip[]> {
  const clientId = Deno.env.get('TWITCH_CLIENT_ID')!
  // Only get clips from the last 2 minutes to catch new ones
  const startedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  
  let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&started_at=${startedAt}&first=5`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  })

  if (!response.ok) {
    console.error(`Failed to get clips: ${response.status}`)
    return []
  }

  const data = await response.json()
  return data.data || []
}

async function getVideos(userId: string, token: string, type: string = 'all'): Promise<TwitchVideo[]> {
  const clientId = Deno.env.get('TWITCH_CLIENT_ID')!
  
  let url = `https://api.twitch.tv/helix/videos?user_id=${userId}&first=5&sort=time`
  if (type !== 'all') {
    url += `&type=${type}`
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  })

  if (!response.ok) {
    console.error(`Failed to get videos: ${response.status}`)
    return []
  }

  const data = await response.json()
  return data.data || []
}

// Add or remove a Discord role for a guild member (for Twitch live role)
async function manageGuildRole(
  guildSnowflake: string,
  userId: string,
  roleId: string,
  action: 'add' | 'remove',
  customBotToken?: string | null
): Promise<boolean> {
  const botToken = customBotToken || Deno.env.get('DISCORD_BOT_TOKEN')
  if (!botToken) {
    console.error('[live-role] Discord bot token not configured')
    return false
  }

  try {
    const url = `https://discord.com/api/v10/guilds/${guildSnowflake}/members/${userId}/roles/${roleId}`
    const response = await fetch(url, {
      method: action === 'add' ? 'PUT' : 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text().catch(() => '')
      console.error(`[live-role] Failed to ${action} role ${roleId} for user ${userId}: ${response.status} ${errorText}`)
      return false
    }

    console.log(`[live-role] ${action === 'add' ? 'Added' : 'Removed'} role ${roleId} ${action === 'add' ? 'to' : 'from'} user ${userId} in guild ${guildSnowflake}`)
    return true
  } catch (e) {
    console.error(`[live-role] Error managing role:`, e)
    return false
  }
}

// Send a Discord DM to a user via the bot
async function sendDiscordDM(
  userId: string,
  content: string,
  customBotToken?: string | null
): Promise<boolean> {
  const botToken = customBotToken || Deno.env.get('DISCORD_BOT_TOKEN')
  if (!botToken) return false
  try {
    // Open/Get DM channel
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId }),
    })
    if (!dmRes.ok) {
      console.error(`[partner-dm] Failed to open DM channel: ${dmRes.status}`)
      return false
    }
    const dm = await dmRes.json()
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    return msgRes.ok
  } catch (e) {
    console.error('[partner-dm] Error:', e)
    return false
  }
}

// Get the start of the current week (Monday 00:00 UTC) as a YYYY-MM-DD date string
function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// Compute progress / goal display string for a partner
function describeProgress(streamer: any): { progress: string; goal: string; met: boolean } {
  const qt = streamer.quota_type || 'streams'
  const hours = (streamer.current_week_minutes || 0) / 60
  if (qt === 'hours') {
    const goal = Number(streamer.quota_hours_per_week || 0)
    return {
      progress: `${hours.toFixed(1)}t`,
      goal: `${goal}t`,
      met: hours >= goal,
    }
  }
  if (qt === 'both') {
    const sGoal = streamer.quota_streams_per_week || 0
    const hGoal = Number(streamer.quota_hours_per_week || 0)
    const sNow = streamer.current_week_streams || 0
    return {
      progress: `${sNow} streams / ${hours.toFixed(1)}t`,
      goal: `${sGoal} streams / ${hGoal}t`,
      met: sNow >= sGoal && hours >= hGoal,
    }
  }
  // streams
  const sGoal = streamer.quota_streams_per_week || 0
  const sNow = streamer.current_week_streams || 0
  return {
    progress: `${sNow} streams`,
    goal: `${sGoal} streams`,
    met: sNow >= sGoal,
  }
}

async function sendDiscordNotification(
  channelId: string,
  embed: Record<string, unknown>,
  mentionRoleId?: string | null,
  customBotToken?: string | null
): Promise<boolean> {
  const botToken = customBotToken || Deno.env.get('DISCORD_BOT_TOKEN')
  if (!botToken) {
    console.error('Discord bot token not configured')
    return false
  }

  const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      embeds: [embed],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`Failed to send Discord message: ${response.status} - ${error}`)
    return false
  }

  return true
}

// Decrypt XOR-encrypted bot token
function decryptToken(encrypted: string, key: string): string {
  const bytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

// Resolve the correct bot token for a guild (custom bot or default)
async function resolveGuildBotToken(supabase: any, guildId: string): Promise<string | null> {
  try {
    const { data: customBot } = await supabase
      .from('guild_bot_settings')
      .select('bot_token_encrypted, is_custom_bot, is_active')
      .eq('guild_id', guildId)
      .eq('is_custom_bot', true)
      .eq('is_active', true)
      .maybeSingle();

    if (customBot?.bot_token_encrypted) {
      const secretKey = Deno.env.get('BOT_SECRET_KEY');
      if (secretKey) {
        const token = decryptToken(customBot.bot_token_encrypted, secretKey);
        if (token && token.length > 20) {
          console.log('Using custom bot token for guild:', guildId);
          return token;
        }
      }
    }
  } catch (e) {
    console.error('Error resolving guild bot token:', e);
  }
  return null;
}

function formatMessage(template: string, data: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value)
  }
  return result
}

function createLiveEmbed(
  stream: TwitchStream,
  user: TwitchUser,
  settings: Record<string, unknown>,
  message: string
): Record<string, unknown> {
  const thumbnailUrl = stream.thumbnail_url
    .replace('{width}', '1280')
    .replace('{height}', '720')

  // Calculate stream uptime
  const startedAt = new Date(stream.started_at)
  const now = new Date()
  const uptimeMs = now.getTime() - startedAt.getTime()
  const hours = Math.floor(uptimeMs / 3600000)
  const minutes = Math.floor((uptimeMs % 3600000) / 60000)
  const uptimeStr = hours > 0 ? `${hours}t ${minutes}m` : `${minutes}m`

  const embed: Record<string, unknown> = {
    title: `🔴 LIVE: ${stream.title}`,
    url: `https://twitch.tv/${stream.user_login}`,
    color: parseInt((settings.live_embed_color as string || '#9146FF').replace('#', ''), 16),
    author: {
      name: `${user.display_name} er nu LIVE på Twitch!`,
      url: `https://twitch.tv/${stream.user_login}`,
      icon_url: user.profile_image_url,
    },
    description: `**[Klik her for at se streamen](https://twitch.tv/${stream.user_login})**`,
    timestamp: new Date().toISOString(),
  }

  const fields: Array<{ name: string; value: string; inline: boolean }> = []

  if (settings.show_game !== false && stream.game_name) {
    fields.push({ name: '🎮 Spil', value: stream.game_name, inline: true })
  }

  if (settings.show_viewers !== false) {
    fields.push({ name: '👀 Seere', value: stream.viewer_count.toLocaleString(), inline: true })
  }

  // Add uptime field
  fields.push({ name: '⏱️ Uptime', value: uptimeStr, inline: true })

  if (fields.length > 0) {
    embed.fields = fields
  }

  if (settings.show_thumbnail !== false) {
    embed.image = { url: `${thumbnailUrl}?t=${Date.now()}` }
  }

  embed.thumbnail = { url: user.profile_image_url }
  embed.footer = { 
    text: `Twitch • ${stream.language?.toUpperCase() || 'DA'}`, 
    icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' 
  }

  return embed
}

function createOfflineEmbed(
  user: TwitchUser,
  settings: Record<string, unknown>,
  message: string
): Record<string, unknown> {
  return {
    description: message,
    color: parseInt((settings.offline_embed_color as string || '#6441A5').replace('#', ''), 16),
    thumbnail: { url: user.profile_image_url },
    footer: { text: 'Twitch', icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' },
    timestamp: new Date().toISOString(),
  }
}

console.log('Twitch handler loaded')

Deno.serve(async (req) => {
  console.log('Request:', req.method, new URL(req.url).search)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    console.log('Action:', action)

    // Validate user for lookup action (dashboard usage)
    if (action === 'lookup') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })

      const { data: { user }, error: authError } = await userSupabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const body = await req.json()
      const { username } = body

      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const token = await getTwitchToken()
      const twitchUser = await getTwitchUser(username, token)

      if (!twitchUser) {
        return new Response(JSON.stringify({ error: 'Twitch user not found' }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      return new Response(JSON.stringify({ user: twitchUser }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Test notification action (called from dashboard)
    if (action === 'test') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })

      const { data: { user }, error: authError } = await userSupabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const body = await req.json()
      const { streamer_id } = body

      if (!streamer_id) {
        return new Response(JSON.stringify({ error: 'Streamer ID required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Get streamer data
      const { data: streamer, error: streamerError } = await supabase
        .from('twitch_streamers')
        .select('*')
        .eq('id', streamer_id)
        .single()

      if (streamerError || !streamer) {
        return new Response(JSON.stringify({ error: 'Streamer not found' }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Get guild settings
      const { data: settings } = await supabase
        .from('twitch_settings')
        .select('*')
        .eq('guild_id', streamer.guild_id)
        .single()

      // Get Twitch token and user info
      const token = await getTwitchToken()
      const twitchUser = await getTwitchUser(streamer.twitch_username, token)
      
      if (!twitchUser) {
        return new Response(JSON.stringify({ error: 'Could not fetch Twitch user info' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Create a test embed
      const testStream: TwitchStream = {
        id: 'test_' + Date.now(),
        user_id: twitchUser.id,
        user_login: twitchUser.login,
        user_name: twitchUser.display_name,
        game_id: '509658',
        game_name: 'Just Chatting',
        type: 'live',
        title: '🧪 Test Notification - Ignore this!',
        viewer_count: 123,
        started_at: new Date().toISOString(),
        language: 'da',
        thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_{user_login}-{width}x{height}.jpg',
        is_mature: false,
      }

      const message = formatMessage(
        (settings?.live_message || '{streamer} er nu LIVE på Twitch!'),
        { streamer: twitchUser.display_name }
      )

      const embed = createLiveEmbed(testStream, twitchUser, settings || {}, message)
      
      // Add test indicator to embed
      embed.title = '🧪 TEST: ' + (embed.title as string)
      embed.footer = { 
        text: '⚠️ Dette er en test-notifikation', 
        icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' 
      }

      // Resolve custom bot token for this guild
      const resolvedToken = await resolveGuildBotToken(supabase, streamer.guild_id)

      const success = await sendDiscordNotification(
        streamer.notification_channel_id,
        embed,
        streamer.mention_role_id,
        resolvedToken
      )

      if (!success) {
        return new Response(JSON.stringify({ error: 'Failed to send Discord notification' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Log the test notification
      await supabase
        .from('twitch_notification_logs')
        .insert({
          guild_id: streamer.guild_id,
          streamer_id: streamer.id,
          event_type: 'live',
          stream_title: '🧪 TEST NOTIFICATION',
          game_name: 'Just Chatting',
          viewer_count: 123,
          thumbnail_url: null,
          channel_id: streamer.notification_channel_id,
          message_id: null,
          sent_at: new Date().toISOString(),
        })

      console.log(`Test notification sent for ${streamer.twitch_username}`)
      return new Response(JSON.stringify({ success: true, streamer: twitchUser.display_name }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Check stream status (called by bot periodically)
    if (action === 'check' || !action) {
      // Validate bot secret for automated calls
      const botSecret = req.headers.get('x-bot-secret')
      const expectedSecret = Deno.env.get('BOT_SECRET_KEY')
      
      if (action === 'check' && botSecret !== expectedSecret) {
        console.log('Invalid bot secret')
        return new Response(JSON.stringify({ error: 'Invalid bot secret' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Check IP whitelist for bot requests
      if (action === 'check') {
        const ipCheck = await checkIPWhitelist(req, supabase);
        if (!ipCheck.allowed) {
          console.error(`IP not whitelisted: ${ipCheck.ip}`);
          return new Response(JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }), { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
      }

      const guildIdParam = url.searchParams.get('guild_id')
      console.log('Checking streamers for guild:', guildIdParam || 'all')

      // Get all tracked streamers
      let query = supabase.from('twitch_streamers').select('*, guilds!inner(guild_id)')
      if (guildIdParam) {
        query = query.eq('guild_id', guildIdParam)
      }

      const { data: streamers, error: streamersError } = await query
      if (streamersError) {
        console.error('Failed to fetch streamers:', streamersError)
        return new Response(JSON.stringify({ error: 'Failed to fetch streamers' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      console.log('Found streamers:', streamers?.length || 0)

      if (!streamers || streamers.length === 0) {
        return new Response(JSON.stringify({ message: 'No streamers to check' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Get Twitch token
      const token = await getTwitchToken()
      console.log('Got Twitch token')

      // Get unique Twitch user IDs
      const userIds = [...new Set(streamers.map(s => s.twitch_user_id).filter(Boolean))] as string[]
      
      // For streamers without user_id, look them up
      const streamersNeedingLookup = streamers.filter(s => !s.twitch_user_id)
      console.log('Streamers needing lookup:', streamersNeedingLookup.length)
      
      for (const streamer of streamersNeedingLookup) {
        const twitchUser = await getTwitchUser(streamer.twitch_username, token)
        if (twitchUser) {
          await supabase
            .from('twitch_streamers')
            .update({
              twitch_user_id: twitchUser.id,
              display_name: twitchUser.display_name,
              profile_image_url: twitchUser.profile_image_url,
            })
            .eq('id', streamer.id)
          
          userIds.push(twitchUser.id)
          streamer.twitch_user_id = twitchUser.id
          streamer.display_name = twitchUser.display_name
          streamer.profile_image_url = twitchUser.profile_image_url
          console.log(`Looked up ${streamer.twitch_username}: ${twitchUser.id}`)
        }
      }

      // Get current streams
      console.log('Checking streams for user IDs:', userIds)
      const liveStreams = await getStreams(userIds, token)
      const liveStreamMap = new Map(liveStreams.map(s => [s.user_id, s]))
      console.log('Live streams found:', liveStreams.length)

      // Get guild settings
      const guildIds = [...new Set(streamers.map(s => s.guild_id))]
      const { data: settingsData } = await supabase
        .from('twitch_settings')
        .select('*')
        .in('guild_id', guildIds)

      const settingsMap = new Map((settingsData || []).map(s => [s.guild_id, s]))

      const results: Array<{ streamer: string; action: string; success: boolean }> = []

      // Process each streamer
      for (const streamer of streamers) {
        if (!streamer.twitch_user_id) continue

        const stream = liveStreamMap.get(streamer.twitch_user_id)
        const settings = settingsMap.get(streamer.guild_id) || {}
        const wasLive = streamer.is_live
        const isNowLive = !!stream

        console.log(`${streamer.twitch_username}: wasLive=${wasLive}, isNowLive=${isNowLive}`)

        // Skip if no change
        if (wasLive === isNowLive) continue

        // Status changed!
        if (isNowLive && stream) {
          // Just went live - check if it's a new stream
          if (stream.id === streamer.last_stream_id) {
            console.log(`${streamer.twitch_username}: Same stream, skipping`)
            continue
          }

          console.log(`${streamer.twitch_username} went LIVE: ${stream.title}`)

          // Get fresh user info for embed
          const twitchUser = await getTwitchUser(streamer.twitch_username, token)
          if (!twitchUser) continue

          const message = formatMessage(
            settings.live_message || '{streamer} er nu LIVE på Twitch!',
            { streamer: twitchUser.display_name }
          )

          const embed = createLiveEmbed(stream, twitchUser, settings, message)
          const guildToken = await resolveGuildBotToken(supabase, streamer.guild_id)
          const success = await sendDiscordNotification(
            streamer.notification_channel_id,
            embed,
            streamer.mention_role_id,
            guildToken
          )

          if (success) {
            // Only save last_stream_id if notification was sent successfully
            // so it retries on next check if it failed
            const liveUpdate: Record<string, unknown> = {
              is_live: true,
              last_stream_id: stream.id,
              last_went_live_at: new Date().toISOString(),
              display_name: twitchUser.display_name,
              profile_image_url: twitchUser.profile_image_url,
            }

            // Partner tracking: register a new stream this week
            if (streamer.is_partner) {
              liveUpdate.current_stream_started_at = new Date().toISOString()
              liveUpdate.current_week_streams = (streamer.current_week_streams || 0) + 1
            }

            await supabase
              .from('twitch_streamers')
              .update(liveUpdate)
              .eq('id', streamer.id)

            // Log the real notification
            await supabase
              .from('twitch_notification_logs')
              .insert({
                guild_id: streamer.guild_id,
                streamer_id: streamer.id,
                event_type: 'live',
                stream_title: stream.title,
                game_name: stream.game_name,
                viewer_count: stream.viewer_count,
                thumbnail_url: stream.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720') || null,
                channel_id: streamer.notification_channel_id,
                message_id: null,
                sent_at: new Date().toISOString(),
              })
          } else {
            console.error(`FAILED to send live notification for ${streamer.twitch_username} to channel ${streamer.notification_channel_id}`)
            // Keep is_live=false when delivery fails, otherwise the next check sees
            // wasLive===isNowLive and never retries the live notification.
            await supabase
              .from('twitch_streamers')
              .update({
                display_name: twitchUser.display_name,
                profile_image_url: twitchUser.profile_image_url,
              })
              .eq('id', streamer.id)
          }

          // Assign live role if configured
          const liveRoleId = settings.live_role_id
          const guildSnowflake = streamer.guilds?.guild_id
          if (success && liveRoleId && streamer.discord_user_id && guildSnowflake) {
            await manageGuildRole(
              guildSnowflake,
              streamer.discord_user_id,
              liveRoleId,
              'add',
              guildToken
            )
          }

          // If partner met quota and previously had inactive role, remove it
          if (success && streamer.is_partner && streamer.discord_user_id && guildSnowflake && settings.partner_inactive_role_id) {
            const prog = describeProgress({ ...streamer, current_week_streams: (streamer.current_week_streams || 0) + 1 })
            if (prog.met) {
              await manageGuildRole(guildSnowflake, streamer.discord_user_id, settings.partner_inactive_role_id, 'remove', guildToken)
              await supabase.from('twitch_streamers').update({ quota_met_this_week: true }).eq('id', streamer.id)
            }
          }

          results.push({ streamer: streamer.twitch_username, action: 'went_live', success })

        } else if (!isNowLive && wasLive) {
          // Just went offline
          console.log(`${streamer.twitch_username} went OFFLINE`)

          // Compute partner stream duration if applicable
          let updatedWeekMinutes = streamer.current_week_minutes || 0
          let quotaMet = streamer.quota_met_this_week || false
          if (streamer.is_partner && streamer.current_stream_started_at) {
            const startedAt = new Date(streamer.current_stream_started_at).getTime()
            const minutes = Math.max(0, Math.round((Date.now() - startedAt) / 60000))
            updatedWeekMinutes = (streamer.current_week_minutes || 0) + minutes
            const prog = describeProgress({ ...streamer, current_week_minutes: updatedWeekMinutes })
            quotaMet = prog.met
          }

          // Remove live role if configured (regardless of offline notification setting)
          const offlineLiveRoleId = settings.live_role_id
          const offlineGuildSnowflake = streamer.guilds?.guild_id
          const offlineGuildToken = await resolveGuildBotToken(supabase, streamer.guild_id)
          if (offlineLiveRoleId && streamer.discord_user_id && offlineGuildSnowflake) {
            await manageGuildRole(
              offlineGuildSnowflake,
              streamer.discord_user_id,
              offlineLiveRoleId,
              'remove',
              offlineGuildToken
            )
          }

          // Remove inactive role if quota is now met
          if (
            streamer.is_partner &&
            quotaMet &&
            settings.partner_inactive_role_id &&
            streamer.discord_user_id &&
            offlineGuildSnowflake
          ) {
            await manageGuildRole(
              offlineGuildSnowflake,
              streamer.discord_user_id,
              settings.partner_inactive_role_id,
              'remove',
              offlineGuildToken
            )
          }

          const offlineUpdate: Record<string, unknown> = {
            is_live: false,
            last_went_offline_at: new Date().toISOString(),
          }
          if (streamer.is_partner) {
            offlineUpdate.current_week_minutes = updatedWeekMinutes
            offlineUpdate.current_stream_started_at = null
            offlineUpdate.quota_met_this_week = quotaMet
          }

          // Check if offline notifications are enabled
          if (settings.notify_on_offline === false) {
            await supabase.from('twitch_streamers').update(offlineUpdate).eq('id', streamer.id)
            continue
          }

          const twitchUser: TwitchUser = {
            id: streamer.twitch_user_id,
            login: streamer.twitch_username,
            display_name: streamer.display_name || streamer.twitch_username,
            profile_image_url: streamer.profile_image_url || '',
          }

          const message = formatMessage(
            settings.offline_message || '{streamer} er gået offline.',
            { streamer: twitchUser.display_name }
          )

          const embed = createOfflineEmbed(twitchUser, settings, message)
          const success = await sendDiscordNotification(streamer.notification_channel_id, embed, null, offlineGuildToken)

          await supabase.from('twitch_streamers').update(offlineUpdate).eq('id', streamer.id)

          if (success) {
            await supabase
              .from('twitch_notification_logs')
              .insert({
                guild_id: streamer.guild_id,
                streamer_id: streamer.id,
                event_type: 'offline',
                stream_title: null,
                game_name: null,
                viewer_count: null,
                thumbnail_url: null,
                channel_id: streamer.notification_channel_id,
                message_id: null,
                sent_at: new Date().toISOString(),
              })
          } else {
            console.error(`FAILED to send offline notification for ${streamer.twitch_username} to channel ${streamer.notification_channel_id}`)
          }

          results.push({ streamer: streamer.twitch_username, action: 'went_offline', success })
        }
      }

      // ---- Check for new clips, VODs, highlights ----
      for (const streamer of streamers) {
        if (!streamer.twitch_user_id) continue

        const guildSettings = settingsMap.get(streamer.guild_id) || {}

        // Determine channels (per-streamer override or global)
        const clipsChannel = streamer.clips_channel_id || guildSettings.clips_channel_id
        const vodsChannel = streamer.vods_channel_id || guildSettings.vods_channel_id

        // Check clips
        if (guildSettings.notify_clips && clipsChannel) {
          try {
            const clips = await getClips(streamer.twitch_user_id, token)
            for (const clip of clips) {
              // Check if already posted
              const { data: existing } = await supabase
                .from('twitch_content_posts')
                .select('id')
                .eq('guild_id', streamer.guild_id)
                .eq('twitch_content_id', clip.id)
                .maybeSingle()

              if (existing) continue

              const msg = formatMessage(
                guildSettings.clip_message || '🎬 Nyt clip fra **{streamer}**: **{title}**',
                { streamer: streamer.display_name || streamer.twitch_username, title: clip.title, url: clip.url, creator: clip.creator_name }
              )

              const embed = {
                title: `🎬 ${clip.title}`,
                url: clip.url,
                color: parseInt((guildSettings.live_embed_color || '#9146FF').replace('#', ''), 16),
                author: {
                  name: `Nyt clip fra ${streamer.display_name || streamer.twitch_username}`,
                  icon_url: streamer.profile_image_url || undefined,
                },
                description: msg,
                image: { url: clip.thumbnail_url },
                fields: [
                  { name: '👤 Lavet af', value: clip.creator_name, inline: true },
                  { name: '👀 Views', value: clip.view_count.toLocaleString(), inline: true },
                  { name: '⏱️ Længde', value: `${clip.duration}s`, inline: true },
                ],
                footer: { text: 'Twitch Clip', icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' },
                timestamp: clip.created_at,
              }

              const guildToken = await resolveGuildBotToken(supabase, streamer.guild_id)
              const success = await sendDiscordNotification(clipsChannel, embed, streamer.mention_role_id, guildToken)

              if (success) {
                await supabase.from('twitch_content_posts').insert({
                  guild_id: streamer.guild_id,
                  streamer_id: streamer.id,
                  content_type: 'clip',
                  twitch_content_id: clip.id,
                  title: clip.title,
                  url: clip.url,
                  channel_id: clipsChannel,
                })
                results.push({ streamer: streamer.twitch_username, action: 'new_clip', success: true })
              }
            }
          } catch (e) {
            console.error(`Error checking clips for ${streamer.twitch_username}:`, e)
          }
        }

        // Check VODs and Highlights
        if ((guildSettings.notify_vods || guildSettings.notify_highlights) && vodsChannel) {
          try {
            const videos = await getVideos(streamer.twitch_user_id, token)
            for (const video of videos) {
              const isHighlight = video.type === 'highlight'
              const isVod = video.type === 'archive'

              if (isHighlight && !guildSettings.notify_highlights) continue
              if (isVod && !guildSettings.notify_vods) continue
              if (!isHighlight && !isVod) continue

              // Check if already posted
              const { data: existing } = await supabase
                .from('twitch_content_posts')
                .select('id')
                .eq('guild_id', streamer.guild_id)
                .eq('twitch_content_id', video.id)
                .maybeSingle()

              if (existing) continue

              // Only post videos created in the last 5 minutes (to avoid posting old content)
              const videoAge = Date.now() - new Date(video.created_at).getTime()
              if (videoAge > 5 * 60 * 1000) continue

              const contentType = isHighlight ? 'highlight' : 'vod'
              const emoji = isHighlight ? '⭐' : '📺'
              const label = isHighlight ? 'Highlight' : 'VOD'
              const messageTemplate = isHighlight
                ? (guildSettings.highlight_message || '⭐ Nyt highlight fra **{streamer}**: **{title}**')
                : (guildSettings.vod_message || '📺 Ny VOD fra **{streamer}**: **{title}**')

              const msg = formatMessage(messageTemplate, {
                streamer: streamer.display_name || streamer.twitch_username,
                title: video.title,
                url: video.url,
              })

              const thumbnailUrl = video.thumbnail_url
                .replace('%{width}', '1280')
                .replace('%{height}', '720')

              const embed = {
                title: `${emoji} ${video.title}`,
                url: video.url,
                color: parseInt((guildSettings.live_embed_color || '#9146FF').replace('#', ''), 16),
                author: {
                  name: `Ny ${label} fra ${streamer.display_name || streamer.twitch_username}`,
                  icon_url: streamer.profile_image_url || undefined,
                },
                description: msg,
                image: thumbnailUrl ? { url: thumbnailUrl } : undefined,
                fields: [
                  { name: '⏱️ Længde', value: video.duration, inline: true },
                  { name: '👀 Views', value: video.view_count.toLocaleString(), inline: true },
                ],
                footer: { text: `Twitch ${label}`, icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' },
                timestamp: video.created_at,
              }

              const guildToken = await resolveGuildBotToken(supabase, streamer.guild_id)
              const success = await sendDiscordNotification(vodsChannel, embed, null, guildToken)

              if (success) {
                await supabase.from('twitch_content_posts').insert({
                  guild_id: streamer.guild_id,
                  streamer_id: streamer.id,
                  content_type: contentType,
                  twitch_content_id: video.id,
                  title: video.title,
                  url: video.url,
                  channel_id: vodsChannel,
                })
                results.push({ streamer: streamer.twitch_username, action: `new_${contentType}`, success: true })
              }
            }
          } catch (e) {
            console.error(`Error checking videos for ${streamer.twitch_username}:`, e)
          }
        }
      }

      console.log('Check complete. Results:', results)
      return new Response(JSON.stringify({ 
        checked: streamers.length,
        live: liveStreams.length,
        notifications: results 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Partner quota check & weekly reset (called periodically by bot)
    if (action === 'partner_check') {
      const botSecret = req.headers.get('x-bot-secret')
      const expectedSecret = Deno.env.get('BOT_SECRET_KEY')
      if (botSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Invalid bot secret' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const ipCheck = await checkIPWhitelist(req, supabase)
      if (!ipCheck.allowed) {
        return new Response(JSON.stringify({ error: 'IP not whitelisted' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get all partner-tracking-enabled guilds
      const { data: trackingSettings } = await supabase
        .from('twitch_settings')
        .select('*, guilds!inner(id, guild_id, name)')
        .eq('partner_tracking_enabled', true)

      if (!trackingSettings || trackingSettings.length === 0) {
        return new Response(JSON.stringify({ ok: true, checked: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const now = new Date()
      const currentWeekStart = getWeekStartDate(now)
      const dayOfWeek = now.getUTCDay() // 0=Sun .. 6=Sat
      const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek // Sun = 0, Mon = 6...

      let warnings = 0
      let resets = 0

      for (const settings of trackingSettings) {
        const { data: partners } = await supabase
          .from('twitch_streamers')
          .select('*')
          .eq('guild_id', settings.guild_id)
          .eq('is_partner', true)

        if (!partners || partners.length === 0) continue

        const guildSnowflake = settings.guilds?.guild_id
        const guildToken = await resolveGuildBotToken(supabase, settings.guild_id)
        const guildName = settings.guilds?.name || 'serveren'
        const warnDays = settings.partner_warning_days_before ?? 2

        for (const partner of partners) {
          const lastReset = partner.last_quota_reset_at ? new Date(partner.last_quota_reset_at) : new Date(0)
          const lastResetWeek = getWeekStartDate(lastReset)
          const needsReset = lastResetWeek !== currentWeekStart

          // ---- Weekly reset (Monday 00:00 UTC) ----
          if (needsReset) {
            const prog = describeProgress(partner)
            // Save last week's stats
            const lastWeekStart = lastResetWeek
            await supabase
              .from('twitch_partner_weekly_stats')
              .upsert({
                guild_id: settings.guild_id,
                streamer_id: partner.id,
                week_start: lastWeekStart,
                streams_count: partner.current_week_streams || 0,
                minutes_streamed: partner.current_week_minutes || 0,
                quota_type: partner.quota_type || 'streams',
                quota_streams_goal: partner.quota_streams_per_week || 0,
                quota_hours_goal: Number(partner.quota_hours_per_week || 0),
                quota_met: prog.met,
              }, { onConflict: 'streamer_id,week_start' })

            // Update streak
            const newStreak = prog.met ? (partner.current_streak || 0) + 1 : 0
            const newBest = Math.max(partner.best_streak || 0, newStreak)

            // Reset weekly counters
            await supabase
              .from('twitch_streamers')
              .update({
                current_week_streams: 0,
                current_week_minutes: 0,
                current_streak: newStreak,
                best_streak: newBest,
                last_quota_reset_at: now.toISOString(),
                warning_sent_this_week: false,
                quota_met_this_week: false,
              })
              .eq('id', partner.id)

            resets++

            // Auto-assign inactive role if missed quota
            if (!prog.met && settings.partner_inactive_role_id && partner.discord_user_id && guildSnowflake) {
              await manageGuildRole(
                guildSnowflake,
                partner.discord_user_id,
                settings.partner_inactive_role_id,
                'add',
                guildToken
              )
            }
            // Skip warning logic this run (just reset)
            continue
          }

          // ---- Mid-week warning ----
          const prog = describeProgress(partner)
          if (prog.met) {
            // Mark met & remove inactive role if previously assigned
            if (!partner.quota_met_this_week) {
              await supabase
                .from('twitch_streamers')
                .update({ quota_met_this_week: true })
                .eq('id', partner.id)
              if (settings.partner_inactive_role_id && partner.discord_user_id && guildSnowflake) {
                await manageGuildRole(guildSnowflake, partner.discord_user_id, settings.partner_inactive_role_id, 'remove', guildToken)
              }
            }
            continue
          }

          // Should we warn?
          if (
            !partner.warning_sent_this_week &&
            daysUntilEndOfWeek <= warnDays
          ) {
            // DM the partner
            if (partner.discord_user_id) {
              const dmTemplate = settings.partner_warning_dm || 'Hej {streamer}! Du mangler stadig at opfylde din ugentlige stream-kvote på {server}. Du har {progress} ud af {goal}. 💜'
              const dmMsg = dmTemplate
                .replaceAll('{streamer}', partner.display_name || partner.twitch_username)
                .replaceAll('{server}', guildName)
                .replaceAll('{progress}', prog.progress)
                .replaceAll('{goal}', prog.goal)
              await sendDiscordDM(partner.discord_user_id, dmMsg, guildToken)
            }

            // Staff alert
            if (settings.partner_staff_channel_id) {
              const alertTpl = settings.partner_staff_alert_template || '⚠️ **{streamer}** har ikke ramt sin ugentlige kvote endnu ({progress}/{goal})'
              const alertMsg = alertTpl
                .replaceAll('{streamer}', partner.display_name || partner.twitch_username)
                .replaceAll('{progress}', prog.progress)
                .replaceAll('{goal}', prog.goal)
              const embed = {
                title: '⚠️ Partner kvote-advarsel',
                description: alertMsg,
                color: 0xF59E0B,
                fields: [
                  { name: 'Status', value: `${prog.progress} / ${prog.goal}`, inline: true },
                  { name: 'Streak', value: `${partner.current_streak || 0} uger`, inline: true },
                  { name: 'Dage tilbage', value: `${daysUntilEndOfWeek}`, inline: true },
                ],
                thumbnail: partner.profile_image_url ? { url: partner.profile_image_url } : undefined,
                timestamp: new Date().toISOString(),
              }
              await sendDiscordNotification(settings.partner_staff_channel_id, embed, null, guildToken)
            }

            await supabase
              .from('twitch_streamers')
              .update({ warning_sent_this_week: true })
              .eq('id', partner.id)
            warnings++
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, warnings, resets, checked: trackingSettings.length }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Post weekly schedule to Discord
    if (action === 'schedule_post') {
      const botSecret = req.headers.get('x-bot-secret')
      const expectedSecret = Deno.env.get('BOT_SECRET_KEY')
      
      if (botSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Invalid bot secret' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const DAY_NAMES = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

      // Get all guilds with auto_post_enabled
      const { data: scheduleSettings, error: ssErr } = await supabase
        .from('twitch_schedule_settings')
        .select('*')
        .eq('auto_post_enabled', true)

      if (ssErr || !scheduleSettings?.length) {
        return new Response(JSON.stringify({ posted: 0 }), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      let postedCount = 0

      for (const ss of scheduleSettings) {
        if (!ss.post_channel_id) continue

        // Check if it's the right day
        const now = new Date()
        const currentDay = now.getUTCDay()
        if (currentDay !== ss.post_day) continue

        // Check if already posted today
        if (ss.last_posted_at) {
          const lastPost = new Date(ss.last_posted_at)
          const hoursSincePost = (now.getTime() - lastPost.getTime()) / 3600000
          if (hoursSincePost < 20) continue
        }

        // Get schedule entries
        const { data: entries } = await supabase
          .from('twitch_stream_schedules')
          .select('*, twitch_streamers(display_name, twitch_username, profile_image_url)')
          .eq('guild_id', ss.guild_id)
          .eq('enabled', true)
          .order('day_of_week')
          .order('start_time')

        if (!entries?.length) continue

        // Build embed fields by day
        const dayGroups: Record<number, string[]> = {}
        for (const entry of entries) {
          const day = entry.day_of_week
          if (!dayGroups[day]) dayGroups[day] = []
          const name = entry.twitch_streamers?.display_name || entry.twitch_streamers?.twitch_username || 'Ukendt'
          const time = `${entry.start_time.slice(0,5)} - ${entry.end_time.slice(0,5)}`
          const game = entry.game_name ? ` • ${entry.game_name}` : ''
          const title = entry.title ? ` — ${entry.title}` : ''
          dayGroups[day].push(`> 🎮 **${name}** kl. ${time}${game}${title}`)
        }

        const fields = Object.entries(dayGroups)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([day, lines]) => ({
            name: `📅 ${DAY_NAMES[Number(day)]}`,
            value: lines.join('\n'),
            inline: false,
          }))

        const embed = {
          title: '📋 Ugentligt Streamskema',
          description: 'Her er denne uges planlagte streams!',
          color: 0x9146FF,
          fields,
          footer: { text: 'Twitch Stream Schedule', icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' },
          timestamp: now.toISOString(),
        }

        const resolvedToken = await resolveGuildBotToken(supabase, ss.guild_id)
        const sent = await sendDiscordNotification(ss.post_channel_id, embed, null, resolvedToken)

        if (sent) {
          await supabase
            .from('twitch_schedule_settings')
            .update({ last_posted_at: now.toISOString() })
            .eq('id', ss.id)
          postedCount++
        }
      }

      return new Response(JSON.stringify({ posted: postedCount }), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch upcoming Twitch schedule segments
    if (action === 'upcoming') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: { user }, error: authError } = await userSupabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const broadcasterId = url.searchParams.get('broadcaster_id')
      if (!broadcasterId) {
        return new Response(JSON.stringify({ error: 'broadcaster_id required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const token = await getTwitchToken()
      const clientId = Deno.env.get('TWITCH_CLIENT_ID')!

      const schedResponse = await fetch(
        `https://api.twitch.tv/helix/schedule?broadcaster_id=${broadcasterId}&first=10`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } }
      )

      if (!schedResponse.ok) {
        const errText = await schedResponse.text()
        return new Response(JSON.stringify({ error: 'Twitch schedule fetch failed', detail: errText }), { 
          status: schedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const schedData = await schedResponse.json()
      return new Response(JSON.stringify({ segments: schedData.data?.segments || [] }), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Manual schedule post from dashboard (authenticated)
    if (action === 'schedule_post_manual') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: { user }, error: authError } = await userSupabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const body = await req.json()
      const guildId = body.guild_id
      if (!guildId) {
        return new Response(JSON.stringify({ error: 'guild_id required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const DAY_NAMES_MANUAL = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

      // Get schedule settings
      const { data: ss } = await supabase
        .from('twitch_schedule_settings')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle()

      const channelId = ss?.post_channel_id
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'Ingen post-kanal konfigureret' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Get schedule entries
      const { data: entries } = await supabase
        .from('twitch_stream_schedules')
        .select('*, twitch_streamers(display_name, twitch_username)')
        .eq('guild_id', guildId)
        .eq('enabled', true)
        .order('day_of_week')
        .order('start_time')

      const dayGroups: Record<number, string[]> = {}
      for (const entry of (entries || [])) {
        const day = entry.day_of_week
        if (!dayGroups[day]) dayGroups[day] = []
        const name = (entry as any).twitch_streamers?.display_name || (entry as any).twitch_streamers?.twitch_username || 'Ukendt'
        const time = `${entry.start_time.slice(0,5)} - ${entry.end_time.slice(0,5)}`
        const game = entry.game_name ? ` • ${entry.game_name}` : ''
        const title = entry.title ? ` — ${entry.title}` : ''
        dayGroups[day].push(`> 🎮 **${name}** kl. ${time}${game}${title}`)
      }

      // If fetch_from_twitch is enabled, also pull upcoming schedule segments from Twitch API
      if (ss?.fetch_from_twitch) {
        try {
          const { data: streamers } = await supabase
            .from('twitch_streamers')
            .select('twitch_user_id, display_name, twitch_username')
            .eq('guild_id', guildId)
            .not('twitch_user_id', 'is', null)

          if (streamers?.length) {
            const token = await getTwitchToken()
            const clientId = Deno.env.get('TWITCH_CLIENT_ID')!
            const nowMs = Date.now()
            const weekAheadMs = nowMs + 7 * 24 * 3600 * 1000

            for (const s of streamers) {
              try {
                const r = await fetch(
                  `https://api.twitch.tv/helix/schedule?broadcaster_id=${s.twitch_user_id}&first=10`,
                  { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } }
                )
                if (!r.ok) continue
                const j = await r.json()
                const segments = j?.data?.segments || []
                for (const seg of segments) {
                  if (seg.canceled_until) continue
                  const start = new Date(seg.start_time)
                  const end = new Date(seg.end_time)
                  if (start.getTime() < nowMs || start.getTime() > weekAheadMs) continue
                  const day = start.getUTCDay()
                  if (!dayGroups[day]) dayGroups[day] = []
                  const name = s.display_name || s.twitch_username || 'Ukendt'
                  const t1 = start.toISOString().slice(11,16)
                  const t2 = end.toISOString().slice(11,16)
                  const game = seg.category?.name ? ` • ${seg.category.name}` : ''
                  const title = seg.title ? ` — ${seg.title}` : ''
                  dayGroups[day].push(`> 🟣 **${name}** kl. ${t1} - ${t2}${game}${title} _(Twitch)_`)
                }
              } catch (e) {
                console.error('Twitch schedule fetch failed for', s.twitch_username, e)
              }
            }
          }
        } catch (e) {
          console.error('fetch_from_twitch error:', e)
        }
      }

      if (!Object.keys(dayGroups).length) {
        return new Response(JSON.stringify({ error: 'Ingen skema-indgange at poste (hverken manuelle eller fra Twitch)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const fields = Object.entries(dayGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, lines]) => ({
          name: `📅 ${DAY_NAMES_MANUAL[Number(day)]}`,
          value: lines.join('\n'),
          inline: false,
        }))

      const embed = {
        title: '📋 Ugentligt Streamskema',
        description: 'Her er denne uges planlagte streams!',
        color: 0x9146FF,
        fields,
        footer: { text: 'Twitch Stream Schedule', icon_url: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png' },
        timestamp: new Date().toISOString(),
      }

      const resolvedToken = await resolveGuildBotToken(supabase, guildId)
      const sent = await sendDiscordNotification(channelId, embed, null, resolvedToken)

      if (!sent) {
        return new Response(JSON.stringify({ error: 'Kunne ikke sende til Discord' }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Update last_posted_at
      if (ss?.id) {
        await supabase
          .from('twitch_schedule_settings')
          .update({ last_posted_at: new Date().toISOString() })
          .eq('id', ss.id)
      }

      return new Response(JSON.stringify({ success: true }), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Twitch handler error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
