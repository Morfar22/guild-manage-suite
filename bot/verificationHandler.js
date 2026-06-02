// Verification Handler - Anti-raid verification system
// Sends verification embed on member join, handles button/captcha verification

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Rate limiting map
const rateLimits = new Map();

function setupVerificationHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  // Send verification message when a new member joins
  client.on('guildMemberAdd', async (member) => {
    // Guild filter
    if (shouldHandleGuild && !shouldHandleGuild(member.guild.id)) return;

    try {
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', member.guild.id)
        .single();

      if (!guild) return;

      const { data: settings } = await supabase
        .from('verification_settings')
        .select('*')
        .eq('guild_id', guild.id)
        .single();

      if (!settings || !settings.enabled || !settings.channel_id) return;

      const channel = member.guild.channels.cache.get(settings.channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('✅ Verification')
        .setDescription(settings.welcome_message || 'Klik på knappen nedenfor for at verificere dig!')
        .setColor(0x5865F2)
        .setFooter({ text: `Bruger: ${member.user.tag}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify_button_${member.id}`)
          .setLabel('Verificér mig')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      await channel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
    } catch (err) {
      console.error('Verification join error:', err);
    }
  });

  // Handle verification button click
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const isPanelButton = interaction.customId === 'verify_panel_button';
    const isUserButton = interaction.customId.startsWith('verify_button_');
    if (!isPanelButton && !isUserButton) return;

    // Guild filter
    if (shouldHandleGuild && interaction.guild && !shouldHandleGuild(interaction.guild.id)) return;

    // For user-specific buttons, only the target user can click
    if (isUserButton) {
      const targetUserId = interaction.customId.split('_')[2];
      if (interaction.user.id !== targetUserId) {
        return interaction.reply({ content: '❌ Denne verifikation er ikke til dig.', ephemeral: true });
      }
    }

    try {
      // Rate limiting
      const key = `${interaction.guild.id}_${interaction.user.id}`;
      const now = Date.now();
      const timestamps = rateLimits.get(key) || [];
      const recent = timestamps.filter(t => now - t < 60000);
      
      if (recent.length >= 5) {
        return interaction.reply({ content: '⏳ Du prøver for hurtigt. Vent et minut.', ephemeral: true });
      }
      
      recent.push(now);
      rateLimits.set(key, recent);

      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', interaction.guild.id)
        .single();

      if (!guild) return interaction.reply({ content: '❌ Server ikke fundet.', ephemeral: true });

      const { data: settings } = await supabase
        .from('verification_settings')
        .select('*')
        .eq('guild_id', guild.id)
        .single();

      if (!settings || !settings.role_id) {
        return interaction.reply({ content: '❌ Verification er ikke konfigureret korrekt.', ephemeral: true });
      }

      const member = interaction.member;
      await member.roles.add(settings.role_id);

      await supabase.from('verification_logs').insert({
        guild_id: guild.id,
        user_id: interaction.user.id,
        user_name: interaction.user.tag,
        method: settings.method || 'button',
        success: true,
      });

      await interaction.reply({ content: '✅ Du er nu verificeret!', ephemeral: true });

      // Only delete user-specific verification messages, not the persistent panel
      if (isUserButton) {
        try {
          await interaction.message.delete();
        } catch (_) {}
      }
    } catch (err) {
      console.error('Verification error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Der opstod en fejl under verifikation.', ephemeral: true });
      }
    }
  });

  // Cleanup rate limit map periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimits.entries()) {
      const recent = timestamps.filter(t => now - t < 60000);
      if (recent.length === 0) {
        rateLimits.delete(key);
      } else {
        rateLimits.set(key, recent);
      }
    }
  }, 60000);

  console.log('✅ Verification handler loaded');

  return {
    destroy() {
      clearInterval(cleanupInterval);
    }
  };
}

module.exports = { setupVerificationHandler };
