// @ts-nocheck
// Migrated from Supabase Edge Function `bot-log-events` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
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
  'member_join': '👋 Medlem Joined',
  'member_leave': '🚪 Medlem Forlod',
  'member_ban': '🔨 Medlem Bannet',
  'member_unban': '✅ Medlem Unbanned',
  'member_kick': '👢 Medlem Kicket',
  'member_timeout': '⏱️ Medlem Timet Ud',
  'member_untimeout': '⏱️ Timeout Fjernet',
  'message_delete': '🗑️ Besked Slettet',
  'message_edit': '✏️ Besked Redigeret',
  'message_bulk_delete': '🗑️ Bulk Sletning',
  'message_pin': '📌 Besked Pinned',
  'message_unpin': '📌 Besked Unpinned',
  'role_create': '🏷️ Rolle Oprettet',
  'role_delete': '🏷️ Rolle Slettet',
  'role_update': '🏷️ Rolle Opdateret',
  'role_add': '🏷️ Rolle Tildelt',
  'role_remove': '🏷️ Rolle Fjernet',
  'channel_create': '📁 Kanal Oprettet',
  'channel_delete': '📁 Kanal Slettet',
  'channel_update': '📁 Kanal Opdateret',
  'voice_join': '🔊 Voice Join',
  'voice_leave': '🔇 Voice Leave',
  'voice_move': '🔀 Voice Move',
  'voice_server_mute': '🔇 Server Mute',
  'voice_server_deafen': '🔇 Server Deafen',
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
  'server_boost': '🚀 Server Boost',
  'server_boost_remove': '🚀 Boost Fjernet',
  'server_update': '⚙️ Server Opdateret',
  'command_used': '⚡ Kommando Brugt',
  'sticker_create': '🎨 Sticker Oprettet',
  'sticker_delete': '🎨 Sticker Slettet',
}

function buildEmbed(eventType: string, data: Record<string, any>): object {
  const embed: any = {
    title: EVENT_TITLES[eventType] || eventType,
    color: EVENT_COLORS[eventType] || 0x5865F2,
    timestamp: new Date().toISOString(),
    fields: [],
    footer: { text: `Event: ${eventType}` },
  }

  if (data.user_name) {
    embed.author = {
      name: data.user_name,
      icon_url: data.user_avatar || undefined,
    }
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
          embed.fields.push({ name: '⚠️ Ny konto', value: 'Konto er under 7 dage gammel!', inline: false })
        }
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
      if (data.voice_channel_from) embed.fields.push({ name: '⬅️ Fra', value: data.voice_channel_from, inline: true })
      if (data.voice_channel_to) embed.fields.push({ name: '➡️ Til', value: data.voice_channel_to, inline: true })
      break

    case 'member_voice_move':
      if (data.user_id) embed.description = `<@${data.user_id}> blev flyttet`
      if (data.voice_channel_from) embed.fields.push({ name: '⬅️ Fra', value: data.voice_channel_from, inline: true })
      if (data.voice_channel_to) embed.fields.push({ name: '➡️ Til', value: data.voice_channel_to, inline: true })
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
      break
  }

  return embed
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
    console.log(`Log event: ${payload.event_type} for guild ${payload.guild_id}`)

    if (!payload.guild_id || !payload.event_type) {
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

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${targetChannelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] }),
      }
    )

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error('Failed to send log to Discord:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send log to Discord', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Log sent successfully for event: ${payload.event_type}`)
    return new Response(
      JSON.stringify({ logged: true, event_type: payload.event_type }),
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
