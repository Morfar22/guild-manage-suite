/**
 * Invite Tracker Handler
 *
 * Sporer invites pr. guild og logger hver join via en sammenligning
 * mellem cached invite uses og nuværende uses ved guildMemberAdd.
 *
 * Påkrævede intents: GuildMembers, GuildInvites, Guilds
 * Bot Permission: ManageGuild (for at læse invites)
 */

const { createClient } = require('@supabase/supabase-js');

const APP_API_BASE = (process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk').replace(/\/$/, '');
const API_URL = process.env.INVITE_TRACKER_API_URL || `${APP_API_BASE}/api/public/invite-tracker`;
const BOT_SECRET = process.env.BOT_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const directSupabase = SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const guildUuidCache = new Map();

// Map<guildId, Map<inviteCode, { uses, inviterId, inviterName, channelId, maxUses, expiresAt }>>
const inviteCache = new Map();
// Vanity url uses cache
const vanityCache = new Map();

const FAKE_ACCOUNT_DAYS = 7;
const UNREGISTERED_GUILD_RETRY_MS = 10 * 60 * 1000;
const unregisteredGuildUntil = new Map();

// Prevent the same Discord client from receiving duplicate invite listeners if a
// handler factory is accidentally applied more than once during lifecycle sync.
const initializedClients = new WeakSet();

async function getGuildUuid(discordGuildId) {
  if (!directSupabase || !discordGuildId) return null;
  if (guildUuidCache.has(discordGuildId)) return guildUuidCache.get(discordGuildId);

  const { data, error } = await directSupabase
    .from('guilds')
    .select('id')
    .eq('guild_id', discordGuildId)
    .maybeSingle();

  if (error) throw error;
  const uuid = data?.id || null;
  if (uuid) guildUuidCache.set(discordGuildId, uuid);
  return uuid;
}

async function callDirect(action, data) {
  if (!directSupabase) return null;

  const uuid = await getGuildUuid(data?.guildId);
  if (!uuid) {
    const error = new Error('Guild not found');
    error.code = 'GUILD_NOT_FOUND';
    throw error;
  }

  if (action === 'syncInvites') {
    const rows = (data.invites || []).map((inv) => ({
      guild_id: uuid,
      invite_code: inv.invite_code,
      inviter_discord_id: inv.inviter_discord_id,
      inviter_username: inv.inviter_username,
      channel_id: inv.channel_id,
      uses: inv.uses,
      max_uses: inv.max_uses,
      expires_at: inv.expires_at,
    }));

    if (rows.length) {
      const { error } = await directSupabase
        .from('invite_tracker')
        .upsert(rows, { onConflict: 'guild_id,invite_code' });
      if (error) throw error;
    }

    return { success: true, count: rows.length };
  }

  if (action === 'logInviteUse') {
    const { error: insertError } = await directSupabase
      .from('invite_uses')
      .insert({
        guild_id: uuid,
        invite_code: data.inviteCode,
        inviter_discord_id: data.inviterDiscordId,
        inviter_username: data.inviterUsername,
        joined_user_id: data.joinedUserId,
        joined_username: data.joinedUsername,
        joined_account_created_at: data.joinedAccountCreatedAt,
        is_fake: Boolean(data.isFake),
      });

    if (insertError) throw insertError;

    if (data.inviteCode) {
      const { data: existing, error: existingError } = await directSupabase
        .from('invite_tracker')
        .select('uses')
        .eq('guild_id', uuid)
        .eq('invite_code', data.inviteCode)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await directSupabase
          .from('invite_tracker')
          .update({ uses: (existing.uses || 0) + 1 })
          .eq('guild_id', uuid)
          .eq('invite_code', data.inviteCode);

        if (updateError) throw updateError;
      }
    }

    return { success: true };
  }

  if (action === 'markInviteLeft') {
    const { error } = await directSupabase
      .from('invite_uses')
      .update({
        has_left: true,
        left_at: new Date().toISOString(),
      })
      .eq('guild_id', uuid)
      .eq('joined_user_id', data.joinedUserId)
      .eq('has_left', false);

    if (error) throw error;
    return { success: true };
  }

  return null;
}

async function callApi(action, data) {
  const guildId = data?.guildId;
  if (guildId) {
    const retryAt = unregisteredGuildUntil.get(guildId) || 0;
    if (retryAt > Date.now()) return null;
    if (retryAt) unregisteredGuildUntil.delete(guildId);
  }

  // Primary path: direct database access. This keeps invite attribution working
  // even if the web dashboard / Cloudflare is temporarily unavailable.
  if (directSupabase) {
    try {
      const result = await callDirect(action, data);
      if (guildId) unregisteredGuildUntil.delete(guildId);
      if (result) return result;
    } catch (error) {
      if (error?.code === 'GUILD_NOT_FOUND') {
        const wasBackedOff = unregisteredGuildUntil.has(guildId);
        unregisteredGuildUntil.set(guildId, Date.now() + UNREGISTERED_GUILD_RETRY_MS);
        if (!wasBackedOff) {
          console.warn(`[InviteTracker] Guild ${guildId} er ikke registreret i databasen; sync pauses i 10 min.`);
        }
        return null;
      }

      console.warn(
        `[InviteTracker] Direct Supabase ${action} failed; prøver API fallback:`,
        error?.message || error,
      );
    }
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
      body: JSON.stringify({ action, data }),
    });

    if (!res.ok) {
      const err = await res.text();

      if (guildId && res.status === 404 && /guild not found/i.test(err)) {
        const wasBackedOff = unregisteredGuildUntil.has(guildId);
        unregisteredGuildUntil.set(guildId, Date.now() + UNREGISTERED_GUILD_RETRY_MS);
        if (!wasBackedOff) {
          console.warn(`[InviteTracker] Guild ${guildId} er ikke registreret i backend; sync pauses i 10 min.`);
        }
        return null;
      }

      console.error(`[InviteTracker] API ${action} failed:`, res.status, err);
      return null;
    }

    if (guildId) unregisteredGuildUntil.delete(guildId);
    return await res.json();
  } catch (error) {
    console.error(`[InviteTracker] API ${action} error:`, error?.message || error);
    return null;
  }
}

async function fetchAndCacheInvites(guild) {
  try {
    if (!guild.members.me?.permissions.has('ManageGuild')) {
      return;
    }
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach((inv) => {
      map.set(inv.code, {
        uses: inv.uses ?? 0,
        inviterId: inv.inviter?.id ?? null,
        inviterName: inv.inviter?.username ?? null,
        channelId: inv.channelId ?? null,
        maxUses: inv.maxUses ?? null,
        expiresAt: inv.expiresAt?.toISOString() ?? null,
      });
    });
    inviteCache.set(guild.id, map);

    // Vanity URL
    if (guild.features?.includes('VANITY_URL')) {
      try {
        const vanity = await guild.fetchVanityData();
        if (vanity?.code) vanityCache.set(guild.id, { code: vanity.code, uses: vanity.uses ?? 0 });
      } catch (_) { /* ignore */ }
    }

    // Sync to backend
    const inviteList = Array.from(map.entries()).map(([code, v]) => ({
      invite_code: code,
      inviter_discord_id: v.inviterId,
      inviter_username: v.inviterName,
      channel_id: v.channelId,
      uses: v.uses,
      max_uses: v.maxUses,
      expires_at: v.expiresAt,
    }));
    await callApi('syncInvites', { guildId: guild.id, invites: inviteList });
  } catch (e) {
    console.error(`[InviteTracker] Failed to fetch invites for ${guild.id}:`, e.message);
  }
}

function setupInviteTracker(client, config = {}) {
  if (!client) return;

  if (initializedClients.has(client)) {
    console.log('ℹ️ Invite tracker already initialized for this client; skipping duplicate setup');
    return;
  }
  initializedClients.add(client);

  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  client.once('clientReady', async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!shouldHandleGuild(guild.id)) continue;
      await fetchAndCacheInvites(guild);
    }
    console.log('✅ Invite tracker ready');
  });

  client.on('guildCreate', (guild) => {
    if (!shouldHandleGuild(guild.id)) return;
    fetchAndCacheInvites(guild);
  });

  client.on('inviteCreate', async (invite) => {
    if (!invite.guild || !shouldHandleGuild(invite.guild.id)) return;
    const map = inviteCache.get(invite.guild.id) || new Map();
    map.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null,
      inviterName: invite.inviter?.username ?? null,
      channelId: invite.channelId ?? null,
      maxUses: invite.maxUses ?? null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    });
    inviteCache.set(invite.guild.id, map);
    await callApi('syncInvites', {
      guildId: invite.guild.id,
      invites: [{
        invite_code: invite.code,
        inviter_discord_id: invite.inviter?.id ?? null,
        inviter_username: invite.inviter?.username ?? null,
        channel_id: invite.channelId ?? null,
        uses: invite.uses ?? 0,
        max_uses: invite.maxUses ?? null,
        expires_at: invite.expiresAt?.toISOString() ?? null,
      }],
    });
  });

  client.on('inviteDelete', (invite) => {
    if (!invite.guild) return;
    const map = inviteCache.get(invite.guild.id);
    if (map) map.delete(invite.code);
  });

  client.on('guildMemberAdd', async (member) => {
    if (!shouldHandleGuild(member.guild.id) || member.user.bot) return;

    try {
      const oldMap = inviteCache.get(member.guild.id) || new Map();
      let usedInvite = null;

      // Refetch current invites to compare
      try {
        const currentInvites = await member.guild.invites.fetch();
        const newMap = new Map();
        currentInvites.forEach((inv) => {
          const prev = oldMap.get(inv.code);
          const prevUses = prev?.uses ?? 0;
          const currUses = inv.uses ?? 0;
          if (!usedInvite && currUses > prevUses) {
            usedInvite = {
              code: inv.code,
              inviterId: inv.inviter?.id ?? null,
              inviterName: inv.inviter?.username ?? null,
              uses: currUses,
            };
          }
          newMap.set(inv.code, {
            uses: currUses,
            inviterId: inv.inviter?.id ?? null,
            inviterName: inv.inviter?.username ?? null,
            channelId: inv.channelId ?? null,
            maxUses: inv.maxUses ?? null,
            expiresAt: inv.expiresAt?.toISOString() ?? null,
          });
        });

        // Detect deleted single-use invite (existed before but not now)
        if (!usedInvite) {
          for (const [code, prev] of oldMap.entries()) {
            if (!newMap.has(code) && prev.maxUses && prev.uses === prev.maxUses - 1) {
              usedInvite = {
                code,
                inviterId: prev.inviterId,
                inviterName: prev.inviterName,
                uses: prev.maxUses,
              };
              break;
            }
          }
        }

        inviteCache.set(member.guild.id, newMap);

        // Vanity check
        if (!usedInvite && member.guild.features?.includes('VANITY_URL')) {
          try {
            const vanity = await member.guild.fetchVanityData();
            const cached = vanityCache.get(member.guild.id);
            if (vanity?.code && cached && (vanity.uses ?? 0) > (cached.uses ?? 0)) {
              usedInvite = { code: vanity.code, inviterId: null, inviterName: 'Vanity URL', uses: vanity.uses };
            }
            if (vanity?.code) vanityCache.set(member.guild.id, { code: vanity.code, uses: vanity.uses ?? 0 });
          } catch (_) { /* ignore */ }
        }
      } catch (e) {
        console.error('[InviteTracker] Fetch on join failed:', e.message);
      }

      // Determine fake (new account)
      const accountAgeMs = Date.now() - member.user.createdTimestamp;
      const isFake = accountAgeMs < FAKE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;

      await callApi('logInviteUse', {
        guildId: member.guild.id,
        inviteCode: usedInvite?.code ?? null,
        inviterDiscordId: usedInvite?.inviterId ?? null,
        inviterUsername: usedInvite?.inviterName ?? null,
        joinedUserId: member.user.id,
        joinedUsername: member.user.username,
        joinedAccountCreatedAt: new Date(member.user.createdTimestamp).toISOString(),
        isFake,
      });

      console.log(`[InviteTracker] ${member.user.username} joined via ${usedInvite?.code ?? 'unknown'} (inviter: ${usedInvite?.inviterName ?? 'unknown'}, fake: ${isFake})`);
    } catch (e) {
      console.error('[InviteTracker] Join handler error:', e.message);
    }
  });

  client.on('guildMemberRemove', async (member) => {
    if (!shouldHandleGuild(member.guild.id)) return;
    try {
      await callApi('markInviteLeft', {
        guildId: member.guild.id,
        joinedUserId: member.user.id,
      });
    } catch (e) {
      console.error('[InviteTracker] Leave handler error:', e.message);
    }
  });

  console.log('✅ Invite tracker handler initialized');
}

module.exports = { setupInviteTracker };
