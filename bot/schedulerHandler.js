// Scheduled messages use the same durable lease/retry protocol as reminders.
const { EmbedBuilder } = require("discord.js");
const {
  listDueJobs,
  runJob,
  messageDeliveryOptions,
  permanentJobError,
  computeNextOccurrence,
} = require("./utils/durableJobs");

class SchedulerHandler {
  constructor(client, supabase, config = {}) {
    this.client = client;
    this.supabase = supabase;
    this.checkInterval = null;
    this.initialCheck = null;
    this.running = false;
    this.shouldHandleGuild = config.shouldHandleGuild || (() => true);
  }

  async init() {
    this.checkInterval = setInterval(
      () => this.checkScheduledMessages(),
      60_000,
    );
    this.initialCheck = setTimeout(() => this.checkScheduledMessages(), 5000);
    console.log("[Scheduler] Handler initialized");
  }

  async checkScheduledMessages(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const messages = await listDueJobs(
        this.supabase,
        "scheduled_messages",
        "scheduled_at",
        now,
      );
      for (const message of messages) {
        if (!this.shouldHandleGuild(message.guilds?.guild_id)) continue;
        try {
          await this.sendScheduledMessage(message, now);
        } catch (error) {
          console.error(`[Scheduler] Job ${message.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error("[Scheduler] Check error:", error.message);
    } finally {
      this.running = false;
    }
  }

  async sendScheduledMessage(candidate, now = new Date()) {
    return runJob(
      this.supabase,
      "scheduled_messages",
      candidate,
      async (message) => {
        const channel = await this.client.channels.fetch(message.channel_id);
        if (!channel?.send)
          throw permanentJobError(
            "Beskedens kanal findes ikke eller kan ikke modtage beskeder",
          );
        const payload = {
          ...messageDeliveryOptions("scheduled_messages", message.id),
        };
        if (message.content) payload.content = message.content;
        if (message.embed) {
          const data = message.embed;
          const embed = new EmbedBuilder();
          if (data.title) embed.setTitle(data.title);
          if (data.description) embed.setDescription(data.description);
          if (data.color) embed.setColor(data.color);
          if (data.thumbnail) embed.setThumbnail(data.thumbnail);
          if (data.image) embed.setImage(data.image);
          if (data.footer) embed.setFooter({ text: data.footer });
          if (data.author)
            embed.setAuthor({
              name: data.author.name,
              iconURL: data.author.icon_url,
            });
          if (Array.isArray(data.fields)) embed.addFields(data.fields);
          if (data.timestamp) embed.setTimestamp();
          payload.embeds = [embed];
        }
        if (!payload.content && !payload.embeds?.length)
          throw permanentJobError("Beskeden har intet indhold");
        return channel.send(payload);
      },
      (message) =>
        computeNextOccurrence(
          message.scheduled_at,
          message.repeat_interval,
          now,
        )?.toISOString() || null,
    );
  }

  async createScheduledMessage(
    guildId,
    channelId,
    content,
    embed,
    scheduledAt,
    repeatInterval,
    createdById,
    createdByName,
  ) {
    const { data, error } = await this.supabase
      .from("scheduled_messages")
      .insert({
        guild_id: guildId,
        channel_id: channelId,
        content,
        embed,
        scheduled_at: scheduledAt,
        repeat_interval: repeatInterval,
        created_by_id: createdById,
        created_by_name: createdByName,
        sent: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[Scheduler] Error creating message:", error);
      return null;
    }

    return data;
  }

  async deleteScheduledMessage(messageId) {
    const { error } = await this.supabase
      .from("scheduled_messages")
      .delete()
      .eq("id", messageId);

    return !error;
  }

  async getUpcomingMessages(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from("scheduled_messages")
      .select("*")
      .eq("guild_id", guildId)
      .eq("sent", false)
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("[Scheduler] Error fetching upcoming:", error);
      return [];
    }

    return data;
  }

  destroy() {
    clearTimeout(this.initialCheck);
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
