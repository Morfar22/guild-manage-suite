// Warning Points Handler - Automated punishment system
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class WarningHandler {
  constructor(client, supabase) {
    this.client = client;
    this.supabase = supabase;
    this.cache = new Map(); // guild_id -> settings
  }

  async init() {
    console.log('[Warnings] Handler initialized');
  }

  async getSettings(guildId) {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId);
    }

    const { data, error } = await this.supabase
      .from('warning_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Warnings] Error fetching settings:', error);
      return null;
    }

    if (data) {
      this.cache.set(guildId, data);
    }
    return data;
  }

  clearCache(guildId) {
    this.cache.delete(guildId);
  }

  async addWarning(interaction, targetUser, reason) {
    try {
      const { data: guild } = await this.supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', interaction.guild.id)
        .single();

      if (!guild) {
        return { success: false, message: 'Guild ikke fundet i databasen.' };
      }

      let settings = await this.getSettings(guild.id);
      
      // Create default settings if none exist
      if (!settings) {
        const { data: newSettings, error: settingsError } = await this.supabase
          .from('warning_settings')
          .insert({
            guild_id: guild.id,
            enabled: true,
            points_per_warn: 1,
            decay_days: 30,
            thresholds: [
              { points: 3, action: 'mute', duration_hours: 1 },
              { points: 5, action: 'mute', duration_hours: 24 },
              { points: 10, action: 'kick' },
              { points: 15, action: 'ban' }
            ]
          })
          .select()
          .single();

        if (settingsError) {
          console.error('[Warnings] Error creating settings:', settingsError);
          return { success: false, message: 'Kunne ikke oprette indstillinger.' };
        }
        settings = newSettings;
        this.cache.set(guild.id, settings);
      }

      if (!settings.enabled) {
        return { success: false, message: 'Warning-systemet er deaktiveret.' };
      }

      // Calculate expiry date
      const expiresAt = settings.decay_days 
        ? new Date(Date.now() + settings.decay_days * 24 * 60 * 60 * 1000)
        : null;

      // Add warning to database
      const { error: warnError } = await this.supabase
        .from('warnings')
        .insert({
          guild_id: guild.id,
          user_id: targetUser.id,
          user_name: targetUser.username,
          moderator_id: interaction.user.id,
          moderator_name: interaction.user.username,
          reason: reason || 'Ingen grund angivet',
          points: settings.points_per_warn,
          expires_at: expiresAt,
          active: true
        });

      if (warnError) {
        console.error('[Warnings] Error adding warning:', warnError);
        return { success: false, message: 'Kunne ikke tilføje advarsel.' };
      }

      // Get total active points
      const totalPoints = await this.getActivePoints(guild.id, targetUser.id);

      // Check thresholds and apply punishment
      const punishment = await this.checkThresholds(interaction, targetUser, totalPoints, settings.thresholds);

      return {
        success: true,
        points: settings.points_per_warn,
        totalPoints,
        punishment
      };
    } catch (error) {
      console.error('[Warnings] Error in addWarning:', error);
      return { success: false, message: 'Der opstod en fejl.' };
    }
  }

  async getActivePoints(guildId, userId) {
    const { data, error } = await this.supabase
      .from('warnings')
      .select('points')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      console.error('[Warnings] Error getting points:', error);
      return 0;
    }

    return data.reduce((sum, w) => sum + w.points, 0);
  }

  async getWarnings(guildId, userId, activeOnly = true) {
    let query = this.supabase
      .from('warnings')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query
        .eq('active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    }

    const { data, error } = await query;
    return error ? [] : data;
  }

  async checkThresholds(interaction, targetUser, totalPoints, thresholds) {
    if (!thresholds || !Array.isArray(thresholds)) return null;

    // Sort thresholds by points descending
    const sortedThresholds = [...thresholds].sort((a, b) => b.points - a.points);

    for (const threshold of sortedThresholds) {
      if (totalPoints >= threshold.points) {
        try {
          const member = await interaction.guild.members.fetch(targetUser.id);
          
          switch (threshold.action) {
            case 'mute':
              const duration = (threshold.duration_hours || 1) * 60 * 60 * 1000;
              await member.timeout(duration, `Automatisk mute: ${totalPoints} warning points`);
              return { action: 'mute', duration_hours: threshold.duration_hours };

            case 'kick':
              await member.kick(`Automatisk kick: ${totalPoints} warning points`);
              return { action: 'kick' };

            case 'ban':
              await member.ban({ reason: `Automatisk ban: ${totalPoints} warning points` });
              return { action: 'ban' };
          }
        } catch (error) {
          console.error('[Warnings] Error applying punishment:', error);
        }
        break; // Only apply highest matching threshold
      }
    }
    return null;
  }

  async clearWarnings(guildId, userId, moderatorId) {
    const { error } = await this.supabase
      .from('warnings')
      .update({ active: false })
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('active', true);

    return !error;
  }

  async removeWarning(warningId) {
    const { error } = await this.supabase
      .from('warnings')
      .update({ active: false })
      .eq('id', warningId);

    return !error;
  }

  createWarningEmbed(user, warning, totalPoints, punishment) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⚠️ Advarsel')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Bruger', value: `${user.username} (${user.id})`, inline: true },
        { name: 'Points', value: `+${warning.points} (Total: ${totalPoints})`, inline: true },
        { name: 'Grund', value: warning.reason || 'Ingen grund angivet' }
      )
      .setTimestamp();

    if (punishment) {
      let punishmentText = '';
      switch (punishment.action) {
        case 'mute':
          punishmentText = `🔇 Automatisk muted i ${punishment.duration_hours} time(r)`;
          break;
        case 'kick':
          punishmentText = '👢 Automatisk kicked';
          break;
        case 'ban':
          punishmentText = '🔨 Automatisk banned';
          break;
      }
      embed.addFields({ name: 'Automatisk straf', value: punishmentText });
      embed.setColor(punishment.action === 'ban' ? 0xFF0000 : 0xFFA500);
    }

    return embed;
  }

  createWarningsListEmbed(user, warnings, totalPoints) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Advarsler for ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(`**Aktive points:** ${totalPoints}`)
      .setTimestamp();

    if (warnings.length === 0) {
      embed.addFields({ name: 'Ingen advarsler', value: 'Denne bruger har ingen aktive advarsler.' });
    } else {
      const warningsList = warnings.slice(0, 10).map((w, i) => {
        const date = new Date(w.created_at).toLocaleDateString('da-DK');
        const expires = w.expires_at 
          ? `(udløber ${new Date(w.expires_at).toLocaleDateString('da-DK')})`
          : '(permanent)';
        return `**${i + 1}.** ${w.reason || 'Ingen grund'}\n` +
               `   Points: ${w.points} | ${date} ${expires}\n` +
               `   Af: ${w.moderator_name}`;
      }).join('\n\n');

      embed.addFields({ name: `Advarsler (${warnings.length})`, value: warningsList });
    }

    return embed;
  }
}

module.exports = { WarningHandler };
