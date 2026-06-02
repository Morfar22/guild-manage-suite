// Scheduler Handler - Sends scheduled messages
const { EmbedBuilder } = require('discord.js');

class SchedulerHandler {
  constructor(client, supabase, config = {}) {
    this.client = client;
    this.supabase = supabase;
    this.checkInterval = null;
    this.shouldHandleGuild = config.shouldHandleGuild || (() => true);
  }

  async init() {
    // Check for pending messages every minute
    this.checkInterval = setInterval(() => this.checkScheduledMessages(), 60000);
    
    // Initial check
    setTimeout(() => this.checkScheduledMessages(), 5000);

    console.log('[Scheduler] Handler initialized');
  }

  async checkScheduledMessages() {
    try {
      const now = new Date().toISOString();

      // Get all pending messages that should be sent
      const { data: messages, error } = await this.supabase
        .from('scheduled_messages')
        .select('*, guilds!inner(guild_id)')
        .eq('sent', false)
        .lte('scheduled_at', now);

      if (error) {
        console.error('[Scheduler] Error fetching messages:', error);
        return;
      }

      if (!messages || messages.length === 0) return;

      for (const message of messages) {
        // Check if this bot instance should handle this guild
        if (!this.shouldHandleGuild(message.guilds?.guild_id)) continue;
        await this.sendScheduledMessage(message);
      }
    } catch (error) {
      console.error('[Scheduler] Check error:', error);
    }
  }

  async sendScheduledMessage(scheduledMessage) {
    try {
      const channel = await this.client.channels.fetch(scheduledMessage.channel_id);
      
      if (!channel) {
        console.error(`[Scheduler] Channel not found: ${scheduledMessage.channel_id}`);
        await this.markAsSent(scheduledMessage.id, false);
        return;
      }

      // Build message content
      const messageOptions = {};

      if (scheduledMessage.content) {
        messageOptions.content = scheduledMessage.content;
      }

      if (scheduledMessage.embed) {
        const embedData = scheduledMessage.embed;
        const embed = new EmbedBuilder();

        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.description) embed.setDescription(embedData.description);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
        if (embedData.image) embed.setImage(embedData.image);
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.author) {
          embed.setAuthor({
            name: embedData.author.name,
            iconURL: embedData.author.icon_url
          });
        }
        if (embedData.fields && Array.isArray(embedData.fields)) {
          embed.addFields(embedData.fields);
        }
        if (embedData.timestamp) embed.setTimestamp();

        messageOptions.embeds = [embed];
      }

      // Send the message
      await channel.send(messageOptions);
      console.log(`[Scheduler] Sent message ${scheduledMessage.id} to channel ${scheduledMessage.channel_id}`);

      // Handle repeat interval
      if (scheduledMessage.repeat_interval) {
        await this.scheduleNextOccurrence(scheduledMessage);
      }

      // Mark as sent
      await this.markAsSent(scheduledMessage.id, true);

    } catch (error) {
      console.error(`[Scheduler] Error sending message ${scheduledMessage.id}:`, error);
      // Mark as sent to prevent infinite retry loop
      await this.markAsSent(scheduledMessage.id, false);
    }
  }

  async markAsSent(messageId, success) {
    await this.supabase
      .from('scheduled_messages')
      .update({
        sent: true,
        sent_at: new Date().toISOString()
      })
      .eq('id', messageId);
  }

  async scheduleNextOccurrence(message) {
    const scheduledAt = new Date(message.scheduled_at);
    let nextDate;

    switch (message.repeat_interval) {
      case 'daily':
        nextDate = new Date(scheduledAt);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate = new Date(scheduledAt);
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate = new Date(scheduledAt);
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        return; // No repeat
    }

    // Create new scheduled message
    await this.supabase
      .from('scheduled_messages')
      .insert({
        guild_id: message.guild_id,
        channel_id: message.channel_id,
        content: message.content,
        embed: message.embed,
        scheduled_at: nextDate.toISOString(),
        repeat_interval: message.repeat_interval,
        created_by_id: message.created_by_id,
        created_by_name: message.created_by_name,
        sent: false
      });

    console.log(`[Scheduler] Scheduled next occurrence for ${message.id} at ${nextDate.toISOString()}`);
  }

  async createScheduledMessage(guildId, channelId, content, embed, scheduledAt, repeatInterval, createdById, createdByName) {
    const { data, error } = await this.supabase
      .from('scheduled_messages')
      .insert({
        guild_id: guildId,
        channel_id: channelId,
        content,
        embed,
        scheduled_at: scheduledAt,
        repeat_interval: repeatInterval,
        created_by_id: createdById,
        created_by_name: createdByName,
        sent: false
      })
      .select()
      .single();

    if (error) {
      console.error('[Scheduler] Error creating message:', error);
      return null;
    }

    return data;
  }

  async deleteScheduledMessage(messageId) {
    const { error } = await this.supabase
      .from('scheduled_messages')
      .delete()
      .eq('id', messageId);

    return !error;
  }

  async getUpcomingMessages(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from('scheduled_messages')
      .select('*')
      .eq('guild_id', guildId)
      .eq('sent', false)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Scheduler] Error fetching upcoming:', error);
      return [];
    }

    return data;
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Wrapper function for consistent API
function setupSchedulerHandler(client, supabase, config = {}) {
  const handler = new SchedulerHandler(client, supabase, config);
  handler.init();
  return handler;
}

module.exports = { SchedulerHandler, setupSchedulerHandler };
