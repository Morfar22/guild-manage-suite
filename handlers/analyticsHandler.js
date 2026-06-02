// Analytics Handler - Tracks bot and server activity
class AnalyticsHandler {
  constructor(client, supabase, config = {}) {
    this.client = client;
    this.supabase = supabase;
    this.eventQueue = [];
    this.flushInterval = null;
    this.guildCache = new Map(); // discord_guild_id -> db_guild_id
    this.shouldHandleGuild = config.shouldHandleGuild || (() => true);
  }

  async init() {
    // Listen to events with guild filtering
    this.client.on('messageCreate', (message) => {
      if (message.guild && this.shouldHandleGuild(message.guild.id)) {
        this.trackMessage(message);
      }
    });
    this.client.on('interactionCreate', (interaction) => {
      if (interaction.guild && this.shouldHandleGuild(interaction.guild.id)) {
        this.trackCommand(interaction);
      }
    });
    this.client.on('guildMemberAdd', (member) => {
      if (this.shouldHandleGuild(member.guild.id)) {
        this.trackMemberJoin(member);
      }
    });
    this.client.on('guildMemberRemove', (member) => {
      if (this.shouldHandleGuild(member.guild.id)) {
        this.trackMemberLeave(member);
      }
    });
    this.client.on('voiceStateUpdate', (oldState, newState) => {
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (guildId && this.shouldHandleGuild(guildId)) {
        this.trackVoice(oldState, newState);
      }
    });

    // Flush events every 30 seconds
    this.flushInterval = setInterval(() => this.flushEvents(), 30000);

    // Aggregate daily stats at midnight
    this.scheduleDailyAggregation();

    console.log('[Analytics] Handler initialized');
  }

  async getGuildId(discordGuildId) {
    if (this.guildCache.has(discordGuildId)) {
      return this.guildCache.get(discordGuildId);
    }

    const { data } = await this.supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', discordGuildId)
      .single();

    if (data) {
      this.guildCache.set(discordGuildId, data.id);
      return data.id;
    }
    return null;
  }

  queueEvent(guildId, eventType, userId = null, channelId = null, metadata = {}) {
    this.eventQueue.push({
      guild_id: guildId,
      event_type: eventType,
      user_id: userId,
      channel_id: channelId,
      metadata,
      created_at: new Date().toISOString()
    });

    // Auto-flush if queue gets too large
    if (this.eventQueue.length >= 100) {
      this.flushEvents();
    }
  }

  async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await this.supabase
        .from('analytics_events')
        .insert(events);

      if (error) {
        console.error('[Analytics] Error flushing events:', error);
        // Re-queue failed events (limit to prevent memory issues)
        if (this.eventQueue.length < 500) {
          this.eventQueue.push(...events);
        }
      }
    } catch (error) {
      console.error('[Analytics] Flush error:', error);
    }
  }

  async trackMessage(message) {
    if (message.author.bot || !message.guild) return;

    const guildId = await this.getGuildId(message.guild.id);
    if (!guildId) return;

    this.queueEvent(guildId, 'message', message.author.id, message.channel.id);
  }

  async trackCommand(interaction) {
    if (!interaction.isCommand() || !interaction.guild) return;

    const guildId = await this.getGuildId(interaction.guild.id);
    if (!guildId) return;

    this.queueEvent(guildId, 'command', interaction.user.id, interaction.channel?.id, {
      command: interaction.commandName
    });
  }

  async trackMemberJoin(member) {
    const guildId = await this.getGuildId(member.guild.id);
    if (!guildId) return;

    this.queueEvent(guildId, 'member_join', member.id);
  }

  async trackMemberLeave(member) {
    const guildId = await this.getGuildId(member.guild.id);
    if (!guildId) return;

    this.queueEvent(guildId, 'member_leave', member.id);
  }

  async trackVoice(oldState, newState) {
    // Track voice join/leave
    const guildId = await this.getGuildId(newState.guild.id);
    if (!guildId) return;

    if (!oldState.channel && newState.channel) {
      // Joined voice
      this.queueEvent(guildId, 'voice_join', newState.member?.id, newState.channel.id);
    } else if (oldState.channel && !newState.channel) {
      // Left voice
      this.queueEvent(guildId, 'voice_leave', oldState.member?.id, oldState.channel.id);
    }
  }

  async trackModAction(guildId, actionType, moderatorId, targetId) {
    this.queueEvent(guildId, 'mod_action', moderatorId, null, {
      action: actionType,
      target: targetId
    });
  }

  async trackXpGain(guildId, userId, amount) {
    this.queueEvent(guildId, 'xp_gain', userId, null, { amount });
  }

  scheduleDailyAggregation() {
    // Calculate time until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      this.aggregateDailyStats();
      // Then run every 24 hours
      setInterval(() => this.aggregateDailyStats(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  async aggregateDailyStats() {
    console.log('[Analytics] Running daily aggregation...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Get all guilds
      const { data: guilds } = await this.supabase
        .from('guilds')
        .select('id');

      if (!guilds) return;

      for (const guild of guilds) {
        await this.aggregateGuildStats(guild.id, dateStr);
      }

      // Clean up old events (keep 7 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      await this.supabase
        .from('analytics_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      console.log('[Analytics] Daily aggregation complete');
    } catch (error) {
      console.error('[Analytics] Aggregation error:', error);
    }
  }

  async aggregateGuildStats(guildId, date) {
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      // Get event counts
      const { data: events } = await this.supabase
        .from('analytics_events')
        .select('event_type, user_id, metadata')
        .eq('guild_id', guildId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (!events || events.length === 0) return;

      // Calculate stats
      const stats = {
        messages: 0,
        xp_gained: 0,
        commands_used: 0,
        members_joined: 0,
        members_left: 0,
        mod_actions: 0,
        voice_minutes: 0, // Simplified - would need session tracking for accurate
        active_users: new Set()
      };

      for (const event of events) {
        if (event.user_id) {
          stats.active_users.add(event.user_id);
        }

        switch (event.event_type) {
          case 'message':
            stats.messages++;
            break;
          case 'command':
            stats.commands_used++;
            break;
          case 'member_join':
            stats.members_joined++;
            break;
          case 'member_leave':
            stats.members_left++;
            break;
          case 'mod_action':
            stats.mod_actions++;
            break;
          case 'xp_gain':
            stats.xp_gained += event.metadata?.amount || 0;
            break;
        }
      }

      // Upsert daily stats
      await this.supabase
        .from('analytics_daily_stats')
        .upsert({
          guild_id: guildId,
          date,
          messages: stats.messages,
          xp_gained: stats.xp_gained,
          commands_used: stats.commands_used,
          members_joined: stats.members_joined,
          members_left: stats.members_left,
          mod_actions: stats.mod_actions,
          voice_minutes: stats.voice_minutes,
          active_users: stats.active_users.size
        }, { onConflict: 'guild_id,date' });

    } catch (error) {
      console.error(`[Analytics] Error aggregating guild ${guildId}:`, error);
    }
  }

  async getStats(guildId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('analytics_daily_stats')
      .select('*')
      .eq('guild_id', guildId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('[Analytics] Error fetching stats:', error);
      return [];
    }

    return data;
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush
    this.flushEvents();
  }
}

module.exports = { AnalyticsHandler };
