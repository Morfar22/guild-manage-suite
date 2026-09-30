/**
 * Invite Tracker Handler
 *
 * Sporer invites pr. guild og logger hver join via en sammenligning
 * mellem cached invite uses og nuværende uses ved guildMemberAdd.
 *
 * Påkrævede intents: GuildMembers, GuildInvites, Guilds
 * Bot Permission: ManageGuild (for at læse invites)
 */

const APP_API_BASE = (process.env.APP_API_BASE || 'https://bot.nethost-solutions.dk').replace(/\/$/, '');
const API_URL = process.env.INVITE_TRACKER_API_URL || `${APP_API_BASE}/api/public/invite-tracker`;
const BOT_SECRET = process.env.BOT_SECRET_KEY;

// Map<guildId, Map<inviteCode, { uses, inviterId, inviterName, channelId, maxUses, expiresAt }>>
const inviteCache = new Map();
// Vanity url uses cache
const vanityCache = new Map();

const FAKE_ACCOUNT_DAYS = 7;

async function callApi(action, data) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[InviteTracker] API ${action} failed:`, res.status, err);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[InviteTracker] API ${action} error:`, e.message);
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
