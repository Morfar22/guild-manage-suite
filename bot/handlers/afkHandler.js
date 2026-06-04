/**
 * AFK Handler
 * 
 * Manages AFK/Away status for users via Discord commands.
 * When a user is mentioned while AFK, the bot notifies the mentioner.
 * When an AFK user sends a message, their AFK status is cleared.
 */

const { Events } = require('discord.js');

function setupAfkHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

    try {
      // Get guild DB id
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!guild) return;

      // Check if message author is AFK → remove AFK
      const { data: authorAfk } = await supabase
        .from('afk_status')
        .select('id, message')
        .eq('guild_id', guild.id)
        .eq('user_discord_id', message.author.id)
        .maybeSingle();

      if (authorAfk) {
        await supabase
          .from('afk_status')
          .delete()
          .eq('id', authorAfk.id);

        await message.reply({
          content: `👋 Velkommen tilbage! Dit AFK-status er fjernet.`,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
      }

      // Check if any mentioned users are AFK
      for (const mentionedUser of message.mentions.users.values()) {
        if (mentionedUser.bot) continue;

        const { data: afk } = await supabase
          .from('afk_status')
          .select('message, set_at')
          .eq('guild_id', guild.id)
          .eq('user_discord_id', mentionedUser.id)
          .maybeSingle();

        if (afk) {
          const since = new Date(afk.set_at).toLocaleString('da-DK');
          await message.reply({
            content: `💤 **${mentionedUser.displayName}** er AFK${afk.message ? `: ${afk.message}` : ''} (siden ${since})`,
            allowedMentions: { repliedUser: false },
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[AFK] Error:', err.message);
    }
  });

  console.log('[AFK] Handler initialized');
}

module.exports = { setupAfkHandler };
