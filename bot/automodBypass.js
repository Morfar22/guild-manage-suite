/**
 * Automod Bypass Helper
 *
 * Centralized check for whether a member should bypass ALL automod systems.
 * Reads `automod_bypass_role_ids` from the guilds table (cached).
 */

const cache = new Map(); // discordGuildId -> { roles: string[], ts }
const TTL = 120_000; // 2 min

async function getBypassRoleIds(supabase, discordGuildId) {
  const cached = cache.get(discordGuildId);
  if (cached && Date.now() - cached.ts < TTL) return cached.roles;

  try {
    const { data } = await supabase
      .from('guilds')
      .select('automod_bypass_role_ids')
      .eq('guild_id', discordGuildId)
      .maybeSingle();
    const roles = Array.isArray(data?.automod_bypass_role_ids) ? data.automod_bypass_role_ids : [];
    cache.set(discordGuildId, { roles, ts: Date.now() });
    return roles;
  } catch {
    return [];
  }
}

/**
 * Returns true if the given GuildMember has any bypass role.
 * Pass `member` (GuildMember) — falls back to false if not available.
 */
async function isAutomodBypassed(supabase, member) {
  if (!member?.guild?.id || !member?.roles?.cache) return false;
  const bypassRoles = await getBypassRoleIds(supabase, member.guild.id);
  if (!bypassRoles.length) return false;
  return member.roles.cache.some((r) => bypassRoles.includes(r.id));
}

function invalidateBypassCache(discordGuildId) {
  if (discordGuildId) cache.delete(discordGuildId);
  else cache.clear();
}

module.exports = { isAutomodBypassed, getBypassRoleIds, invalidateBypassCache };
