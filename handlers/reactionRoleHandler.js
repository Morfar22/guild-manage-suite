/**
 * Reaction Role Handler for Discord Bot
 * 
 * Environment variables required:
 * - BOT_SECRET_KEY: (samme som i Lovable Cloud secrets)
 * - REACTION_ROLE_API_URL: https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/reaction-role-handler
 * 
 * Usage in your main bot file:
 * const { setupReactionRoleHandler } = require('./reactionRoleHandler');
 * setupReactionRoleHandler(client);
 * 
 * IMPORTANT: Your bot needs the following intents:
 * - GatewayIntentBits.GuildMessageReactions
 * - GatewayIntentBits.GuildMembers
 * 
 * And partials:
 * - Partials.Message
 * - Partials.Reaction
 * - Partials.User
 */

const API_URL = process.env.REACTION_ROLE_API_URL || 'https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/reaction-role-handler';
const BOT_SECRET = process.env.BOT_SECRET_KEY;

/**
 * Call the Lovable API for reaction roles
 */
async function callReactionRoleAPI(data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  
  return response.json();
}

/**
 * Get the emoji identifier (handles both unicode and custom emojis)
 */
function getEmojiIdentifier(emoji) {
  // For custom emojis, use the format <:name:id> or just the name
  if (emoji.id) {
    return emoji.id; // Custom emoji - return the ID
  }
  // For unicode emojis, return the emoji character
  return emoji.name;
}

/**
 * Setup reaction role handler on Discord client
 * @param {Client} client - Discord.js client
 * @param {Object} config - Configuration object with shouldHandleGuild function
 */
function setupReactionRoleHandler(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  // Handle reaction add
  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      // Ignore bot reactions
      if (user.bot) return;
      
      // Handle partial reactions (when the message isn't cached)
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error('Error fetching reaction:', error);
          return;
        }
      }
      
      // Ignore DMs
      if (!reaction.message.guild) return;

      // Check if this bot instance should handle this guild
      if (!shouldHandleGuild(reaction.message.guild.id)) return;
      
      const emoji = getEmojiIdentifier(reaction.emoji);
      
      console.log(`🔵 Reaction add: ${emoji} by ${user.username} on message ${reaction.message.id}`);
      
      const result = await callReactionRoleAPI({
        guild_id: reaction.message.guild.id,
        user_id: user.id,
        message_id: reaction.message.id,
        emoji: emoji,
        action: 'add'
      });
      
      if (result.success && result.role_id) {
        try {
          const member = await reaction.message.guild.members.fetch(user.id);
          await member.roles.add(result.role_id);
          console.log(`✅ Added role ${result.role_name || result.role_id} to ${user.username}`);
        } catch (roleError) {
          console.error(`❌ Failed to add role to ${user.username}:`, roleError.message);
        }
      } else if (!result.success) {
        // No reaction role configured for this message/emoji - that's fine, just ignore
        console.log(`ℹ️ No reaction role configured for emoji ${emoji} on message ${reaction.message.id}`);
      }
    } catch (error) {
      console.error('Reaction role add error:', error.message);
    }
  });
  
  // NOTE: messageReactionRemove handler removed.
  // The system uses button toggles for role assignment/removal.
  // The old reaction-remove handler caused spurious role removals
  // when Discord fired messageReactionRemove during reconnects,
  // cache invalidation, or message deletions.

  // Handle reaction role buttons directly on the bot client.
  // This is required for custom bots where component interactions are handled
  // through the Gateway rather than a separate interactions endpoint.
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isButton()) return;
      if (!interaction.customId?.startsWith('reaction_role:')) return;
      if (!interaction.guild) return;
      if (!shouldHandleGuild(interaction.guild.id)) return;

      const roleId = interaction.customId.replace('reaction_role:', '');
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRole = member.roles.cache.has(roleId);

      if (hasRole) {
        await member.roles.remove(roleId);
        await interaction.reply({
          content: `✅ Rollen <@&${roleId}> blev fjernet.`,
          ephemeral: true,
        });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({
          content: `✅ Du har fået rollen <@&${roleId}>.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Reaction role button error:', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '❌ Kunne ikke ændre din rolle. Tjek at botten er over rollen og har Manage Roles.',
          ephemeral: true,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: '❌ Kunne ikke ændre din rolle. Tjek at botten er over rollen og har Manage Roles.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
  });
  
  console.log('✅ Reaction role handler initialized (reaction + button support)');
}

module.exports = { setupReactionRoleHandler };
