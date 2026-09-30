// @ts-nocheck
// Migrated from Supabase Edge Function `bot-log-events` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
}

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotTokenForGuild(supabase: any, guildId: string): Promise<string> {
  const { data: settings } = await supabase
    .from('guild_bot_settings')
    .select('is_custom_bot, is_active, bot_token_encrypted')
    .eq('guild_id', guildId)
    .eq('is_custom_bot', true)
    .eq('is_active', true)
    .maybeSingle();

  const encryptionKey = __env('BOT_SECRET_KEY') || 'default-encryption-key';

  if (settings?.bot_token_encrypted) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
    } catch (e) {
      console.error('Failed to decrypt custom bot token, falling back to global:', e instanceof Error ? e.message : String(e));
    }
  }

  const globalToken = __env('DISCORD_BOT_TOKEN');
  if (!globalToken) throw new Error('Bot token not configured');
  return globalToken;
}

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

interface LogEventPayload {
  guild_id: string
  event_type: string
  data: Record<string, any>
}

function generateEventHash(guildId: string, eventType: string, data: Record<string, any>): string {
  const parts = [guildId, eventType];
  if (data.user_id) parts.push(data.user_id);
  if (data.channel_id) parts.push(data.channel_id);
  if (data.role_id) parts.push(data.role_id);
  if (data.invite_code) parts.push(data.invite_code);
  if (data.voice_channel_from) parts.push('from');
  if (data.voice_channel_to) parts.push('to');
  if (data.old_nickname) parts.push(data.old_nickname.substring(0, 20));
  if (data.new_nickname) parts.push(data.new_nickname.substring(0, 20));
  if (data.content) parts.push(data.content.substring(0, 30));
  if (data.old_content) parts.push(data.old_content.substring(0, 30));
  if (data.emoji_name) parts.push(data.emoji_name);
  if (data.thread_name) parts.push(data.thread_name);
  if (data.command_name) parts.push(data.command_name);
  if (data.target_id) parts.push(data.target_id);
  if (data.sticker_name) parts.push(data.sticker_name);
  const timeBucket = Math.floor(Date.now() / 10000);
  parts.push(timeBucket.toString());
  return parts.join(':');
}

const EVENT_TO_SETTING: Record<string, string> = {
  'member_join': 'log_member_join',
  'member_leave': 'log_member_leave',
  'member_ban': 'log_member_ban',
  'member_unban': 'log_member_unban',
  'member_kick': 'log_member_kick',
  'member_timeout': 'log_member_timeout',
  'member_untimeout': 'log_member_untimeout',
  'message_delete': 'log_message_delete',
  'message_edit': 'log_message_edit',
  'message_bulk_delete': 'log_message_bulk_delete',
  'message_pin': 'log_message_pin',
  'message_unpin': 'log_message_unpin',
  'role_create': 'log_role_create',
  'role_delete': 'log_role_delete',
  'role_update': 'log_role_update',
  'role_add': 'log_role_add',
  'role_remove': 'log_role_remove',
  'channel_create': 'log_channel_create',
  'channel_delete': 'log_channel_delete',
  'channel_update': 'log_channel_update',
  'voice_join': 'log_voice_join',
  'voice_leave': 'log_voice_leave',
  'voice_move': 'log_voice_move',
  'voice_server_mute': 'log_voice_server_mute',
  'voice_server_deafen': 'log_voice_server_deafen',
  'member_voice_move': 'log_member_voice_move',
  'screen_share_start': 'log_screen_share_start',
  'screen_share_stop': 'log_screen_share_stop',
  'nickname_change': 'log_nickname_change',
  'avatar_change': 'log_avatar_change',
  'invite_create': 'log_invite_create',
  'invite_delete': 'log_invite_delete',
  'emoji_create': 'log_emoji_create',
  'emoji_delete': 'log_emoji_delete',
  'emoji_update': 'log_emoji_update',
  'thread_create': 'log_thread_create',
  'thread_delete': 'log_thread_delete',
  'thread_archive': 'log_thread_archive',
  'server_boost': 'log_server_boost',
  'server_boost_remove': 'log_server_boost_remove',
  'server_update': 'log_server_update',
  'command_used': 'log_command_used',
  'sticker_create': 'log_sticker_create',
  'sticker_delete': 'log_sticker_delete',
}

const EVENT_COLORS: Record<string, number> = {
  'member_join': 0x57F287,
  'member_leave': 0xED4245,
  'member_ban': 0xED4245,
  'member_unban': 0x57F287,
  'member_kick': 0xED4245,
  'member_timeout': 0xE67E22,
  'member_untimeout': 0x57F287,
  'message_delete': 0xFEE75C,
  'message_edit': 0x5865F2,
  'message_bulk_delete': 0xFEE75C,
  'message_pin': 0x57F287,
  'message_unpin': 0xFEE75C,
  'role_create': 0x57F287,
  'role_delete': 0xED4245,
  'role_update': 0x5865F2,
  'role_add': 0x57F287,
  'role_remove': 0xED4245,
  'channel_create': 0x57F287,
  'channel_delete': 0xED4245,
  'channel_update': 0x5865F2,
  'voice_join': 0x57F287,
  'voice_leave': 0xED4245,
  'voice_move': 0x5865F2,
  'voice_server_mute': 0xFEE75C,
  'voice_server_deafen': 0xFEE75C,
  'member_voice_move': 0xE67E22,
  'screen_share_start': 0x57F287,
  'screen_share_stop': 0xED4245,
  'nickname_change': 0x5865F2,
  'avatar_change': 0x5865F2,
  'invite_create': 0x57F287,
  'invite_delete': 0xED4245,
  'emoji_create': 0x57F287,
  'emoji_delete': 0xED4245,
  'emoji_update': 0x5865F2,
  'thread_create': 0x57F287,
  'thread_delete': 0xED4245,
  'thread_archive': 0xFEE75C,
  'server_boost': 0xF47FFF,
  'server_boost_remove': 0xED4245,
  'server_update': 0x5865F2,
  'command_used': 0x5865F2,
  'sticker_create': 0x57F287,
  'sticker_delete': 0xED4245,
}

const EVENT_TITLES: Record<string, string> = {
  'member_join': '👋 Medlem tilsluttede',
  'member_leave': '🚪 Medlem Forlod',
  'member_ban': '🔨 Medlem Bannet',
  'member_unban': '✅ Bandlysning ophævet',
  'member_kick': '👢 Medlem fjernet',
  'member_timeout': '⏱️ Medlem Timet Ud',
  'member_untimeout': '⏱️ Timeout Fjernet',
  'message_delete': '🗑️ Besked Slettet',
  'message_edit': '✏️ Besked Redigeret',
  'message_bulk_delete': '🧹 Flere beskeder slettet',
  'message_pin': '📌 Besked fastgjort',
  'message_unpin': '📌 Fastgørelse fjernet',
  'role_create': '🏷️ Rolle Oprettet',
  'role_delete': '🏷️ Rolle Slettet',
  'role_update': '🏷️ Rolle Opdateret',
  'role_add': '🏷️ Rolle Tildelt',
  'role_remove': '🏷️ Rolle Fjernet',
  'channel_create': '📁 Kanal Oprettet',
  'channel_delete': '📁 Kanal Slettet',
  'channel_update': '📁 Kanal Opdateret',
  'voice_join': '🔊 Tilsluttet voice',
  'voice_leave': '🔇 Forlod voice',
  'voice_move': '🔀 Skiftede voice-kanal',
  'voice_server_mute': '🔇 Server mute ændret',
  'voice_server_deafen': '🔇 Server deafen ændret',
  'member_voice_move': '↔️ Medlem Flyttet (Voice)',
  'screen_share_start': '🖥️ Skærmdeling Startet',
  'screen_share_stop': '🖥️ Skærmdeling Stoppet',
  'nickname_change': '📝 Nickname Ændret',
  'avatar_change': '🖼️ Avatar Ændret',
  'invite_create': '📨 Invite Oprettet',
  'invite_delete': '📨 Invite Slettet',
  'emoji_create': '😀 Emoji Oprettet',
  'emoji_delete': '😀 Emoji Slettet',
  'emoji_update': '😀 Emoji Opdateret',
  'thread_create': '🧵 Tråd Oprettet',
  'thread_delete': '🧵 Tråd Slettet',
  'thread_archive': '🧵 Tråd Arkiveret',
  'server_boost': '🚀 Server boost',
  'server_boost_remove': '🚀 Boost fjernet',
  'server_update': '⚙️ Server Opdateret',
  'command_used': '⚡ Kommando brugt',
  'sticker_create': '🎨 Sticker Oprettet',
  'sticker_delete': '🎨 Sticker Slettet',
}

const EVENT_GROUPS: Record<string, string> = {
  member_join: 'Medlemmer', member_leave: 'Medlemmer', member_ban: 'Moderation',
  member_unban: 'Moderation', member_kick: 'Moderation', member_timeout: 'Moderation',
  member_untimeout: 'Moderation', message_delete: 'Beskeder', message_edit: 'Beskeder',
  message_bulk_delete: 'Beskeder', message_pin: 'Beskeder', message_unpin: 'Beskeder',
  role_create: 'Roller', role_delete: 'Roller', role_update: 'Roller', role_add: 'Roller',
  role_remove: 'Roller', channel_create: 'Kanaler', channel_delete: 'Kanaler',
  channel_update: 'Kanaler', voice_join: 'Voice', voice_leave: 'Voice', voice_move: 'Voice',
  voice_server_mute: 'Voice', voice_server_deafen: 'Voice', member_voice_move: 'Voice',
  screen_share_start: 'Voice', screen_share_stop: 'Voice', nickname_change: 'Medlemmer',
  avatar_change: 'Medlemmer', invite_create: 'Invites', invite_delete: 'Invites',
  emoji_create: 'Server', emoji_delete: 'Server', emoji_update: 'Server',
  thread_create: 'Tråde', thread_delete: 'Tråde', thread_archive: 'Tråde',
  server_boost: 'Server', server_boost_remove: 'Server', server_update: 'Server',
  command_used: 'Kommandoer', sticker_create: 'Server', sticker_delete: 'Server',
}

function truncate(value: unknown, max = 1024): string {
  const text = String(value ?? '').trim()
  if (!text) return 'Ikke angivet'
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text
}

function normalizeEmbed(embed: any, eventType: string, data: Record<string, any>) {
  embed.title = truncate(embed.title || eventType, 256)
  if (embed.description) embed.description = truncate(embed.description, 4096)

  const fields = Array.isArray(embed.fields) ? embed.fields : []
  const normalizedFields = fields
    .filter((field: any) => field?.name && field?.value !== undefined && field?.value !== null)
    .slice(0, 25)
    .map((field: any) => ({
      name: truncate(field.name, 256),
      value: truncate(field.value, 1024),
      inline: Boolean(field.inline),
    }))

  // Discord caps a complete embed at 6000 characters. Keep a safety margin
  // so one unusually long message can never make the entire log fail.
  const baseChars = String(embed.title || '').length + String(embed.description || '').length + 350
  let usedChars = baseChars
  embed.fields = []
  for (const field of normalizedFields) {
    const cost = field.name.length + field.value.length
    if (usedChars + cost > 5700) {
      const remaining = Math.max(80, 5700 - usedChars - field.name.length)
      if (remaining >= 80) {
        embed.fields.push({ ...field, value: truncate(field.value, remaining) })
      }
      break
    }
    embed.fields.push(field)
    usedChars += cost
  }

  const group = EVENT_GROUPS[eventType] || 'System'
  const id = typeof data.event_id === 'string' ? data.event_id.slice(0, 8) : 'ukendt'
  const guild = data.guild_name ? ` • ${truncate(data.guild_name, 80)}` : ''
  embed.footer = {
    text: `${group} • ${eventType} • #${id}${guild}`,
  }

  if (data.occurred_at) {
    const occurred = new Date(data.occurred_at)
    if (!Number.isNaN(occurred.getTime())) embed.timestamp = occurred.toISOString()
  }

  return embed
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function sendDiscordLog(
  token: string,
  channelId: string,
  payload: Record<string, any>,
  eventId: string,
) {
  const maxAttempts = 3
  let lastStatus = 0
  let lastBody = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${token}`,
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': encodeURIComponent(`Guild log event ${eventId}`),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      )
      clearTimeout(timer)

      lastStatus = response.status
      if (response.ok) return response

      lastBody = await response.text().catch(() => '')
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === maxAttempts) break

      let waitMs = 400 * attempt
      if (response.status === 429) {
        try {
          const body = JSON.parse(lastBody)
          waitMs = Math.max(waitMs, Math.ceil(Number(body.retry_after || 0) * 1000))
        } catch {}
      }
      await sleep(Math.min(waitMs, 5000))
    } catch (error) {
      clearTimeout(timer)
      lastBody = error instanceof Error ? error.message : String(error)
      if (attempt === maxAttempts) break
      await sleep(400 * attempt)
    }
  }

  throw new Error(`Discord log delivery failed (status ${lastStatus || 'network'}, event ${eventId}): ${truncate(lastBody, 500)}`)
}

function buildEmbed(eventType: string, data: Record<string, any>): object {
  const embed: any = {
    title: EVENT_TITLES[eventType] || eventType,
    color: EVENT_COLORS[eventType] || 0x5865F2,
    timestamp: data.occurred_at || new Date().toISOString(),
    fields: [],
  }

  if (data.user_name) {
    embed.author = {
      name: truncate(data.user_name, 256),
      icon_url: data.user_avatar || undefined,
    }
  }

  if (data.guild_name && data.guild_member_count !== null && data.guild_member_count !== undefined) {
    embed.fields.push({
      name: '🏠 Server',
      value: `${truncate(data.guild_name, 180)}\n${Number(data.guild_member_count).toLocaleString('da-DK')} medlemmer`,
      inline: true,
    })
  }

  // Helper to add moderator field
  const addModeratorField = () => {
    if (data.moderator_id) {
      embed.fields.push({ name: '🛡️ Moderator', value: `<@${data.moderator_id}> (${data.moderator_name || 'Ukendt'})`, inline: true })
    }
  }

  // Helper to add "changed by" field
  const addChangedByField = () => {
    if (data.changed_by_id) {
      embed.fields.push({ name: '🔧 Ændret af', value: `<@${data.changed_by_id}> (${data.changed_by_name || 'Ukendt'})`, inline: true })
    }
  }

  // Helper to add "deleted by" field
  const addDeletedByField = () => {
    if (data.deleted_by_id) {
      embed.fields.push({ name: '🗑️ Slettet af', value: `<@${data.deleted_by_id}> (${data.deleted_by_name || 'Ukendt'})`, inline: true })
    }
  }

  switch (eventType) {
    case 'member_join':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> joined serveren`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
        embed.fields.push({ name: '🆔 ID', value: data.user_id, inline: true })
      }
      if (data.account_created) {
        const created = new Date(data.account_created)
        const age = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
        embed.fields.push({ name: '📅 Konto oprettet', value: `<t:${Math.floor(created.getTime() / 1000)}:R> (${age} dage)`, inline: true })
        if (age < 7) {
          embed.fields.push({ name: '⚠️ Ny konto', value: 'Konto er under 7 dage gammel', inline: false })
        }
      }
      if (data.joined_at) {
        const joined = new Date(data.joined_at)
        embed.fields.push({ name: '🕒 Join-tidspunkt', value: `<t:${Math.floor(joined.getTime() / 1000)}:F>`, inline: true })
      }
      if (data.pending_screening) {
        embed.fields.push({ name: '🛡️ Membership screening', value: 'Afventer godkendelse', inline: true })
      }
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_leave':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> forlod serveren`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
        embed.fields.push({ name: '🆔 ID', value: data.user_id, inline: true })
      }
      if (data.roles) embed.fields.push({ name: '🏷️ Roller', value: data.roles, inline: false })
      if (data.joined_at) {
        const joined = new Date(data.joined_at)
        const days = Math.max(0, Math.floor((Date.now() - joined.getTime()) / 86400000))
        embed.fields.push({ name: '⏳ Tid på serveren', value: `${days} dage`, inline: true })
      }
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_ban':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> blev bannet`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
        embed.fields.push({ name: '🆔 ID', value: data.user_id, inline: true })
      }
      addModeratorField()
      if (data.reason) embed.fields.push({ name: '📋 Årsag', value: data.reason, inline: false })
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_unban':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> blev unbanned`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
      }
      addModeratorField()
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_kick':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> blev kicket`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
      }
      addModeratorField()
      if (data.reason) embed.fields.push({ name: '📋 Årsag', value: data.reason, inline: false })
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_timeout':
      if (data.user_id) {
        const untilTs = Math.floor(new Date(data.timeout_until).getTime() / 1000)
        embed.description = `<@${data.user_id}> blev timet ud`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
        embed.fields.push({ name: '⏰ Udløber', value: `<t:${untilTs}:R>`, inline: true })
      }
      addModeratorField()
      if (data.reason) embed.fields.push({ name: '📋 Årsag', value: data.reason, inline: false })
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'member_untimeout':
      if (data.user_id) {
        embed.description = `<@${data.user_id}> fik timeout fjernet`
        embed.fields.push({ name: '👤 Bruger', value: `<@${data.user_id}>`, inline: true })
      }
      addModeratorField()
      if (data.user_avatar) embed.thumbnail = { url: data.user_avatar }
      break

    case 'message_delete':
      embed.fields.push({ name: '📝 Kanal', value: data.channel_id ? `<#${data.channel_id}>` : 'Ukendt', inline: true })
      if (data.user_id) embed.fields.push({ name: '👤 Forfatter', value: `<@${data.user_id}>`, inline: true })
      if (data.message_id) embed.fields.push({ name: '🆔 Besked-ID', value: `\`${data.message_id}\``, inline: true })
      if (data.message_created_at) {
        const created = new Date(data.message_created_at)
        embed.fields.push({ name: '🕒 Oprettet', value: `<t:${Math.floor(created.getTime() / 1000)}:R>`, inline: true })
      }
      addDeletedByField()
      if (data.content) embed.fields.push({ name: '💬 Indhold', value: data.content.substring(0, 1024), inline: false })
      if (data.attachments) embed.fields.push({ name: '📎 Vedhæftninger', value: data.attachments.substring(0, 1024), inline: false })
      break

    case 'message_edit':
      embed.fields.push({ name: '📝 Kanal', value: data.channel_id ? `<#${data.channel_id}>` : 'Ukendt', inline: true })
      if (data.user_id) embed.fields.push({ name: '👤 Forfatter', value: `<@${data.user_id}>`, inline: true })
      if (data.message_url) embed.fields.push({ name: '🔗 Link', value: `[Gå til besked](${data.message_url})`, inline: true })
      if (data.old_content) embed.fields.push({ name: '📝 Før', value: data.old_content.substring(0, 1024), inline: false })
      if (data.new_content) embed.fields.push({ name: '✏️ Efter', value: data.new_content.substring(0, 1024), inline: false })
      break

    case 'message_bulk_delete':
      embed.fields.push({ name: '📝 Kanal', value: data.channel_id ? `<#${data.channel_id}>` : 'Ukendt', inline: true })
      if (data.message_count) embed.fields.push({ name: '🔢 Antal', value: `${data.message_count} beskeder`, inline: true })
      break

    case 'message_pin':
    case 'message_unpin':
      embed.fields.push({ name: '📝 Kanal', value: data.channel_id ? `<#${data.channel_id}>` : 'Ukendt', inline: true })
      if (data.user_id) embed.fields.push({ name: '👤 Af', value: `<@${data.user_id}>`, inline: true })
      break

    case 'role_create':
    case 'role_delete':
      if (data.role_name) embed.fields.push({ name: '🏷️ Rolle', value: data.role_name, inline: true })
      if (data.role_id) embed.fields.push({ name: '🆔 ID', value: data.role_id, inline: true })
      addModeratorField()
      break

    case 'role_update':
      if (data.role_name) embed.fields.push({ name: '🏷️ Rolle', value: data.role_name, inline: true })
      if (data.role_id) embed.fields.push({ name: '🆔 ID', value: data.role_id, inline: true })
      addModeratorField()
      if (data.changes) embed.fields.push({ name: '📋 Ændringer', value: data.changes, inline: false })
      break

    case 'role_add':
    case 'role_remove':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.role_name) embed.fields.push({ name: '🏷️ Rolle', value: data.role_name, inline: true })
      if (data.role_id) embed.fields.push({ name: '🆔 ID', value: data.role_id, inline: true })
      addChangedByField()
      break

    case 'channel_create':
    case 'channel_delete':
      if (data.channel_name) embed.fields.push({ name: '📁 Kanal', value: data.channel_name, inline: true })
      if (data.channel_id) embed.fields.push({ name: '🆔 ID', value: data.channel_id, inline: true })
      addModeratorField()
      break

    case 'channel_update':
      if (data.channel_name) embed.fields.push({ name: '📁 Kanal', value: data.channel_name, inline: true })
      if (data.channel_id) embed.fields.push({ name: '🆔 ID', value: data.channel_id, inline: true })
      addModeratorField()
      if (data.changes) embed.fields.push({ name: '📋 Ændringer', value: data.changes, inline: false })
      break

    case 'voice_join':
    case 'voice_leave':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.channel_name) embed.fields.push({ name: '🔊 Kanal', value: data.channel_name, inline: true })
      break

    case 'voice_move':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.voice_channel_from) embed.fields.push({
        name: '⬅️ Fra',
        value: data.voice_channel_from_id ? `<#${data.voice_channel_from_id}>\n${data.voice_channel_from}` : data.voice_channel_from,
        inline: true,
      })
      if (data.voice_channel_to) embed.fields.push({
        name: '➡️ Til',
        value: data.voice_channel_to_id ? `<#${data.voice_channel_to_id}>\n${data.voice_channel_to}` : data.voice_channel_to,
        inline: true,
      })
      break

    case 'member_voice_move':
      if (data.user_id) embed.description = `<@${data.user_id}> blev flyttet`
      if (data.voice_channel_from) embed.fields.push({
        name: '⬅️ Fra',
        value: data.voice_channel_from_id ? `<#${data.voice_channel_from_id}>\n${data.voice_channel_from}` : data.voice_channel_from,
        inline: true,
      })
      if (data.voice_channel_to) embed.fields.push({
        name: '➡️ Til',
        value: data.voice_channel_to_id ? `<#${data.voice_channel_to_id}>\n${data.voice_channel_to}` : data.voice_channel_to,
        inline: true,
      })
      addModeratorField()
      break

    case 'voice_server_mute':
      if (data.user_id) embed.description = `<@${data.user_id}> blev ${data.muted ? 'server mutet 🔇' : 'server unmutet 🔊'}`
      if (data.channel_name) embed.fields.push({ name: '🔊 Kanal', value: data.channel_name, inline: true })
      break

    case 'voice_server_deafen':
      if (data.user_id) embed.description = `<@${data.user_id}> blev ${data.deafened ? 'server deafened 🔇' : 'server undeafened 🔊'}`
      if (data.channel_name) embed.fields.push({ name: '🔊 Kanal', value: data.channel_name, inline: true })
      break

    case 'screen_share_start':
    case 'screen_share_stop':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.channel_name) embed.fields.push({ name: '🔊 Kanal', value: data.channel_name, inline: true })
      break

    case 'nickname_change':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.old_nickname) embed.fields.push({ name: '📝 Før', value: data.old_nickname, inline: true })
      if (data.new_nickname) embed.fields.push({ name: '✏️ Efter', value: data.new_nickname, inline: true })
      addChangedByField()
      break

    case 'invite_create':
      if (data.user_id) embed.fields.push({ name: '👤 Oprettet af', value: `<@${data.user_id}>`, inline: true })
      if (data.invite_code) embed.fields.push({ name: '🔗 Kode', value: `\`${data.invite_code}\``, inline: true })
      if (data.channel_id) embed.fields.push({ name: '📝 Kanal', value: `<#${data.channel_id}>`, inline: true })
      if (data.invite_uses !== undefined) embed.fields.push({ name: '🔢 Max Uses', value: data.invite_uses === 0 ? 'Ubegrænset' : `${data.invite_uses}`, inline: true })
      if (data.expires_at) {
        const ts = Math.floor(new Date(data.expires_at).getTime() / 1000)
        embed.fields.push({ name: '⏰ Udløber', value: `<t:${ts}:R>`, inline: true })
      }
      break

    case 'invite_delete':
      if (data.invite_code) embed.fields.push({ name: '🔗 Kode', value: `\`${data.invite_code}\``, inline: true })
      if (data.channel_id) embed.fields.push({ name: '📝 Kanal', value: `<#${data.channel_id}>`, inline: true })
      break

    case 'emoji_create':
      embed.fields.push({ name: '😀 Emoji', value: data.emoji_name || 'Ukendt', inline: true })
      if (data.emoji_id) embed.fields.push({ name: '🆔 ID', value: data.emoji_id, inline: true })
      break

    case 'emoji_delete':
      embed.fields.push({ name: '😀 Emoji', value: data.emoji_name || 'Ukendt', inline: true })
      if (data.emoji_id) embed.fields.push({ name: '🆔 ID', value: data.emoji_id, inline: true })
      break

    case 'emoji_update':
      if (data.old_name) embed.fields.push({ name: '📝 Før', value: data.old_name, inline: true })
      if (data.new_name) embed.fields.push({ name: '✏️ Efter', value: data.new_name, inline: true })
      break

    case 'sticker_create':
    case 'sticker_delete':
      embed.fields.push({ name: '🎨 Sticker', value: data.sticker_name || 'Ukendt', inline: true })
      if (data.sticker_id) embed.fields.push({ name: '🆔 ID', value: data.sticker_id, inline: true })
      break

    case 'thread_create':
      if (data.thread_name) embed.fields.push({ name: '🧵 Tråd', value: data.thread_name, inline: true })
      if (data.channel_name) embed.fields.push({ name: '📁 Forælderkanal', value: data.channel_name, inline: true })
      if (data.user_id) embed.fields.push({ name: '👤 Oprettet af', value: `<@${data.user_id}>`, inline: true })
      break

    case 'thread_delete':
    case 'thread_archive':
      if (data.thread_name) embed.fields.push({ name: '🧵 Tråd', value: data.thread_name, inline: true })
      if (data.channel_name) embed.fields.push({ name: '📁 Forælderkanal', value: data.channel_name, inline: true })
      break

    case 'server_boost':
      if (data.user_id) embed.description = `<@${data.user_id}> boostede serveren! 🚀`
      if (data.boost_count !== undefined) embed.fields.push({ name: '🚀 Total Boosts', value: `${data.boost_count}`, inline: true })
      if (data.boost_tier !== undefined) embed.fields.push({ name: '⭐ Tier', value: `${data.boost_tier}`, inline: true })
      break

    case 'server_boost_remove':
      if (data.user_id) embed.description = `<@${data.user_id}> stoppede med at booste`
      if (data.boost_count !== undefined) embed.fields.push({ name: '🚀 Total Boosts', value: `${data.boost_count}`, inline: true })
      break

    case 'server_update':
      embed.description = '⚙️ Serverindstillinger blev ændret'
      if (data.changes) embed.fields.push({ name: '📋 Ændringer', value: data.changes, inline: false })
      addModeratorField()
      break

    case 'command_used':
      if (data.user_id) embed.description = `<@${data.user_id}>`
      if (data.command_name) embed.fields.push({ name: '⚡ Kommando', value: `\`/${data.command_name}\``, inline: true })
      if (data.channel_id) embed.fields.push({ name: '📝 Kanal', value: `<#${data.channel_id}>`, inline: true })
      if (data.command_options) embed.fields.push({ name: '⚙️ Parametre', value: `\`\`\`\n${truncate(data.command_options, 960)}\n\`\`\``, inline: false })
      break
  }

  return normalizeEmbed(embed, eventType, data)
}

__serve(async (req) => {
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
    const botSecret = req.headers.get('x-bot-secret')
    const expectedSecret = __env('BOT_SECRET_KEY')
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error('Invalid or missing bot secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ipCheck = await checkIPWhitelist(req, supabase);
    if (!ipCheck.allowed) {
      console.error(`IP not whitelisted: ${ipCheck.ip}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: LogEventPayload = await req.json()
    const eventId = typeof payload?.data?.event_id === 'string'
      ? payload.data.event_id
      : crypto.randomUUID()

    if (!payload?.guild_id || !payload?.event_type || typeof payload?.data !== 'object' || payload.data === null) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: guild_id, event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const { data: logSettings, error: settingsError } = await supabase
      .from('log_settings')
      .select('*')
      .eq('guild_id', guild.id)
      .single()

    if (settingsError || !logSettings) {
      return new Response(
        JSON.stringify({ logged: false, reason: 'No log settings configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const settingKey = EVENT_TO_SETTING[payload.event_type]
    if (!settingKey || !logSettings[settingKey]) {
      return new Response(
        JSON.stringify({ logged: false, reason: 'Event type disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine target channel: use override if set, else default
    const isBoostEvent = payload.event_type === 'server_boost' || payload.event_type === 'server_boost_remove';
    const targetChannelId = (isBoostEvent && logSettings.boost_channel_id)
      ? logSettings.boost_channel_id
      : logSettings.log_channel_id;

    if (!targetChannelId) {
      return new Response(
        JSON.stringify({ logged: false, reason: 'No log channel configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const eventHash = generateEventHash(payload.guild_id, payload.event_type, payload.data)
    const { error: dedupError } = await supabase
      .from('log_event_dedup')
      .insert({ event_hash: eventHash, guild_id: payload.guild_id })
    
    if (dedupError && dedupError.code === '23505') {
      return new Response(
        JSON.stringify({ logged: false, reason: 'Duplicate event (server-side dedup)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const embed = buildEmbed(payload.event_type, payload.data)
    const discordToken = await getBotTokenForGuild(supabase, guild.id)

    await sendDiscordLog(
      discordToken,
      targetChannelId,
      {
        embeds: [embed],
        allowed_mentions: { parse: [] },
      },
      eventId,
    )

    console.log(`[Logs] ${payload.event_type} -> guild ${payload.guild_id} [${eventId.slice(0, 8)}]`)
    return new Response(
      JSON.stringify({ logged: true, event_type: payload.event_type, event_id: eventId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Logs] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? truncate(error.message, 500) : truncate(error, 500),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/bot-log-events')({
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
