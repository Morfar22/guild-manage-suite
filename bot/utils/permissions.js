"use strict";

/**
 * Permission helpers for slash/button interactions.
 *
 * `interaction.memberPermissions` is always a resolved PermissionsBitField in
 * guild interactions, while `interaction.member.permissions` can be a raw
 * bitfield string when the member is not cached. Prefer the former, and fail
 * closed when nothing is available (e.g. DMs).
 */

function resolvePermissions(interaction) {
  const resolved = interaction?.memberPermissions;
  if (resolved && typeof resolved.has === "function") return resolved;
  const memberPerms = interaction?.member?.permissions;
  if (memberPerms && typeof memberPerms.has === "function") return memberPerms;
  if (typeof memberPerms === "string" && /^\d+$/.test(memberPerms)) {
    const bits = BigInt(memberPerms);
    return {
      has(flag) {
        const f = BigInt(flag);
        const ADMIN = 0x8n;
        return (bits & ADMIN) === ADMIN || (bits & f) === f;
      },
    };
  }
  return null;
}

function hasPermission(interaction, flag) {
  if (!interaction?.guild && !interaction?.guildId) return false;
  const perms = resolvePermissions(interaction);
  return Boolean(perms && perms.has(flag));
}

/** Send an ephemeral denial, whether or not the interaction was deferred. */
async function denyInteraction(interaction, content) {
  const payload = { content, flags: 64 };
  try {
    if (interaction.deferred || interaction.replied) {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content });
      } else {
        await interaction.followUp(payload);
      }
    } else {
      await interaction.reply(payload);
    }
  } catch {
    /* interaction expired; nothing else to do */
  }
}

/** Synchronous check; sends the denial in the background. */
function checkPermissionOrDeny(interaction, flag, message) {
  if (hasPermission(interaction, flag)) return true;
  void denyInteraction(interaction, message);
  return false;
}

async function requirePermission(interaction, flag, message) {
  if (hasPermission(interaction, flag)) return true;
  await denyInteraction(interaction, message);
  return false;
}

module.exports = {
  hasPermission,
  denyInteraction,
  checkPermissionOrDeny,
  requirePermission,
  resolvePermissions,
};
