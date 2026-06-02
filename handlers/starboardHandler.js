// Starboard Handler - Highlights popular messages
const { EmbedBuilder } = require('discord.js');

class StarboardHandler {
  constructor(client, supabase, config = {}) {
    this.client = client;
    this.supabase = supabase;
    this.cache = new Map(); // guild_id -> settings
    this.shouldHandleGuild = config.shouldHandleGuild || (() => true);
  }

  async init() {
    this.client.on('messageReactionAdd', (reaction, user) => this.handleReactionAdd(reaction, user));
    this.client.on('messageReactionRemove', (reaction, user) => this.handleReactionRemove(reaction, user));
    console.log('[Starboard] Handler initialized');
  }

  async getSettings(guildId) {
    // Check cache first
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId);
    }

    const { data, error } = await this.supabase
      .from('starboard_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error || !data) return null;

    this.cache.set(guildId, data);
    return data;
  }

  clearCache(guildId) {
    this.cache.delete(guildId);
  }

  async handleReactionAdd(reaction, user) {
    try {
      // Fetch partial reactions
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (e) {
          console.error('[Starboard] Failed to fetch reaction:', e);
          return;
        }
      }

      const message = reaction.message;
      if (!message.guild) return;

      // Check if this bot instance should handle this guild
      if (!this.shouldHandleGuild(message.guild.id)) return;

      // Get guild settings from database
      const { data: guild } = await this.supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!guild) return;

      const settings = await this.getSettings(guild.id);
      if (!settings || !settings.enabled || !settings.channel_id) return;

      // Check if reaction matches configured emoji
      const reactionEmoji = reaction.emoji.name;
      if (reactionEmoji !== settings.emoji && reaction.emoji.toString() !== settings.emoji) return;

      // Ignore self-star if configured
      if (settings.ignore_self_star && user.id === message.author.id) return;

      // Check if channel is ignored
      if (settings.ignored_channels?.includes(message.channel.id)) return;

      // Count reactions (excluding self if configured)
      let count = reaction.count;
      if (settings.ignore_self_star) {
        const users = await reaction.users.fetch();
        count = users.filter(u => u.id !== message.author.id).size;
      }

      // Check threshold
      if (count < settings.threshold) return;

      await this.updateStarboardEntry(message, count, settings, guild.id);
    } catch (error) {
      console.error('[Starboard] Error handling reaction add:', error);
    }
  }

  async handleReactionRemove(reaction, user) {
    try {
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (e) {
          return; // Message may have been deleted
        }
      }

      const message = reaction.message;
      if (!message.guild) return;

      // Check if this bot instance should handle this guild
      if (!this.shouldHandleGuild(message.guild.id)) return;

      const { data: guild } = await this.supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!guild) return;

      const settings = await this.getSettings(guild.id);
      if (!settings || !settings.enabled) return;

      const reactionEmoji = reaction.emoji.name;
      if (reactionEmoji !== settings.emoji && reaction.emoji.toString() !== settings.emoji) return;

      // Get updated count
      let count = reaction.count || 0;
      if (settings.ignore_self_star && count > 0) {
        const users = await reaction.users.fetch();
        count = users.filter(u => u.id !== message.author.id).size;
      }

      // Check if entry exists
      const { data: entry } = await this.supabase
        .from('starboard_entries')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('message_id', message.id)
        .single();

      if (!entry) return;

      if (count < settings.threshold) {
        // Remove from starboard
        await this.removeFromStarboard(entry, settings);
      } else {
        // Update count
        await this.updateStarboardEntry(message, count, settings, guild.id);
      }
    } catch (error) {
      console.error('[Starboard] Error handling reaction remove:', error);
    }
  }

  async updateStarboardEntry(message, count, settings, guildId) {
    try {
      // Fetch full message if partial
      if (message.partial) {
        await message.fetch();
      }

      const starboardChannel = await this.client.channels.fetch(settings.channel_id);
      if (!starboardChannel) return;

      // Check for existing entry
      const { data: existingEntry } = await this.supabase
        .from('starboard_entries')
        .select('*')
        .eq('guild_id', guildId)
        .eq('message_id', message.id)
        .single();

      const embed = this.createStarboardEmbed(message, count, settings.emoji);

      if (existingEntry?.starboard_message_id) {
        // Update existing message
        try {
          const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboard_message_id);
          await starboardMessage.edit({
            content: `${settings.emoji} **${count}** | <#${message.channel.id}>`,
            embeds: [embed]
          });
        } catch (e) {
          // Message may have been deleted, create new one
          const newMessage = await starboardChannel.send({
            content: `${settings.emoji} **${count}** | <#${message.channel.id}>`,
            embeds: [embed]
          });
          
          await this.supabase
            .from('starboard_entries')
            .update({ starboard_message_id: newMessage.id, star_count: count })
            .eq('id', existingEntry.id);
        }

        // Update count in database
        await this.supabase
          .from('starboard_entries')
          .update({ star_count: count })
          .eq('id', existingEntry.id);
      } else {
        // Create new starboard message
        const starboardMessage = await starboardChannel.send({
          content: `${settings.emoji} **${count}** | <#${message.channel.id}>`,
          embeds: [embed]
        });

        // Get attachments
        const attachments = message.attachments.map(a => ({
          url: a.url,
          name: a.name,
          contentType: a.contentType
        }));

        // Insert or update entry
        await this.supabase
          .from('starboard_entries')
          .upsert({
            guild_id: guildId,
            message_id: message.id,
            channel_id: message.channel.id,
            author_id: message.author.id,
            author_name: message.author.username,
            content: message.content?.substring(0, 4000),
            attachments,
            starboard_message_id: starboardMessage.id,
            star_count: count
          }, { onConflict: 'guild_id,message_id' });
      }
    } catch (error) {
      console.error('[Starboard] Error updating entry:', error);
    }
  }

  createStarboardEmbed(message, count, emoji) {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp(message.createdAt)
      .addFields({
        name: 'Original',
        value: `[Hop til besked](${message.url})`
      });

    if (message.content) {
      embed.setDescription(message.content);
    }

    // Add first image if present
    const imageAttachment = message.attachments.find(a => 
      a.contentType?.startsWith('image/')
    );
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    // Add embed image if message has embeds
    if (message.embeds.length > 0 && message.embeds[0].image) {
      embed.setImage(message.embeds[0].image.url);
    }

    return embed;
  }

  async removeFromStarboard(entry, settings) {
    try {
      if (entry.starboard_message_id && settings.channel_id) {
        const channel = await this.client.channels.fetch(settings.channel_id);
        if (channel) {
          try {
            const message = await channel.messages.fetch(entry.starboard_message_id);
            await message.delete();
          } catch (e) {
            // Message already deleted
          }
        }
      }

      // Remove from database
      await this.supabase
        .from('starboard_entries')
        .delete()
        .eq('id', entry.id);
    } catch (error) {
      console.error('[Starboard] Error removing entry:', error);
    }
  }
}

// Wrapper function for consistent API
function setupStarboardHandler(client, supabase, config = {}) {
  const handler = new StarboardHandler(client, supabase, config);
  handler.init();
  return handler;
}

module.exports = { StarboardHandler, setupStarboardHandler };
