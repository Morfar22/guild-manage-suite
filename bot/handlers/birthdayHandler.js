/**
 * Birthday Handler
 * 
 * Checks daily for birthdays and announces them + assigns birthday role.
 * Users register via /birthday slash command.
 */

const { EmbedBuilder } = require('discord.js');

const settingsCache = new Map();
const CACHE_TTL = 300_000;
let intervalId = null;

function setupBirthdayHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    if (!guild) return null;

    const { data } = await supabase
      .from('birthday_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    return result;
  }

  async function checkBirthdays() {
    try {
      const today = new Date();
      const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Get all birthday settings with guilds
      const { data: allSettings } = await supabase
        .from('birthday_settings')
        .select('*, guilds!inner(guild_id)')
        .eq('enabled', true);

      if (!allSettings) return;

      for (const settings of allSettings) {
        const guildDiscordId = settings.guilds?.guild_id;
        if (!guildDiscordId) continue;
        if (shouldHandleGuild && !shouldHandleGuild(guildDiscordId)) continue;

        const guild = client.guilds.cache.get(guildDiscordId);
        if (!guild) continue;

        // Get today's birthdays for this guild
        const { data: birthdays } = await supabase
          .from('birthdays')
          .select('*')
          .eq('guild_id', settings.guild_id);

        if (!birthdays) continue;

        const todayBirthdays = birthdays.filter(b => {
          const bDate = new Date(b.birthday_date);
          const bMonthDay = `${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`;
          return bMonthDay === monthDay;
        });

        if (todayBirthdays.length === 0) continue;

        const channel = settings.channel_id ? guild.channels.cache.get(settings.channel_id) : null;

        for (const birthday of todayBirthdays) {
          const member = await guild.members.fetch(birthday.user_id).catch(() => null);
          if (!member) continue;

          // Assign birthday role
          if (settings.role_id) {
            await member.roles.add(settings.role_id, 'Fødselsdag!').catch(() => {});
            // Remove after 24h
            setTimeout(async () => {
              await member.roles.remove(settings.role_id, 'Fødselsdag slut').catch(() => {});
            }, 24 * 60 * 60 * 1000);
          }

          // Announce
          if (channel) {
            const template = settings.message_template || '🎂 Tillykke med fødselsdagen, {user}! 🎉';
            const message = template.replace('{user}', `<@${birthday.user_id}>`);

            const embed = new EmbedBuilder()
              .setTitle('🎂 Tillykke med fødselsdagen!')
              .setDescription(message)
              .setColor(0xFF69B4)
              .setThumbnail(member.user.displayAvatarURL())
              .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('[Birthday] Error checking birthdays:', err.message);
    }
  }

  // Handle /birthday slash command
  async function handleBirthdayCommand(interaction) {
    if (!interaction.guild) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

    const day = interaction.options.getInteger('dag');
    const month = interaction.options.getInteger('måned');

    if (day < 1 || day > 31 || month < 1 || month > 12) {
      await interaction.reply({ content: '❌ Ugyldig dato.', ephemeral: true });
      return;
    }

    const { data: guild } = await supabase
      .from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
    if (!guild) {
      await interaction.reply({ content: '❌ Server ikke fundet.', ephemeral: true });
      return;
    }

    const birthdayDate = new Date(2000, month - 1, day);

    await supabase.from('birthdays').upsert({
      guild_id: guild.id,
      user_id: interaction.user.id,
      user_name: interaction.user.username,
      birthday_date: birthdayDate.toISOString().split('T')[0],
    }, { onConflict: 'guild_id,user_id' });

    await interaction.reply({
      content: `✅ Din fødselsdag er sat til **${day}/${month}**! 🎂`,
      ephemeral: true,
    });
  }

  // Check daily at 8:00 AM
  if (!intervalId) {
    intervalId = setInterval(checkBirthdays, 60 * 60 * 1000); // Check every hour
    setTimeout(checkBirthdays, 30_000); // Initial check after 30s
  }

  console.log('[Birthday] Handler initialized');
  return { handleBirthdayCommand };
}

module.exports = { setupBirthdayHandler };
