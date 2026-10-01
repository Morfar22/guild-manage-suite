'use strict';

const { EmbedBuilder } = require('discord.js');

function createAppealHandlers(client, { supabase }) {
  const getGuild = async (discordGuildId) => {
    const { data, error } = await supabase
      .from('guilds')
      .select('id, guild_name')
      .eq('guild_id', discordGuildId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const findCase = async (guildId, caseInput, userId) => {
    if (!caseInput) return null;
    const value = String(caseInput).trim();

    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
      const { data, error } = await supabase
        .from('moderation_logs')
        .select('id, target_id, target_name, action_type, reason, status, created_at')
        .eq('guild_id', guildId)
        .eq('id', value)
        .maybeSingle();
      if (error) throw error;
      if (data && data.target_id !== userId) return null;
      return data;
    }

    const { data, error } = await supabase
      .from('moderation_logs')
      .select('id, target_id, target_name, action_type, reason, status, created_at')
      .eq('guild_id', guildId)
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const matches = (data || []).filter((item) => String(item.id).toLowerCase().startsWith(value.toLowerCase()));
    return matches.length === 1 ? matches[0] : null;
  };

  return {
    'appeal-submit': async (interaction) => {
      const guild = await getGuild(interaction.guild.id);
      if (!guild) {
        return interaction.reply({ content: '❌ Serveren findes ikke i dashboardet.', flags: 64 });
      }

      const caseInput = interaction.options.getString('case_id');
      const message = interaction.options.getString('message', true).trim();

      let moderationCase = null;
      if (caseInput) {
        moderationCase = await findCase(guild.id, caseInput, interaction.user.id);
        if (!moderationCase) {
          return interaction.reply({
            content: '❌ Case blev ikke fundet, eller den tilhører ikke din Discord-bruger.',
            flags: 64,
          });
        }
      }

      const { data: existing } = await supabase
        .from('moderation_appeals')
        .select('id, status')
        .eq('guild_id', guild.id)
        .eq('appellant_discord_id', interaction.user.id)
        .in('status', ['pending', 'needs_info'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return interaction.reply({
          content: `⏳ Du har allerede en aktiv appeal (\`${existing.id.slice(0, 8)}\`).`,
          flags: 64,
        });
      }

      const { data, error } = await supabase
        .from('moderation_appeals')
        .insert({
          guild_id: guild.id,
          case_id: moderationCase?.id || null,
          appellant_discord_id: interaction.user.id,
          appellant_name: interaction.user.tag,
          message,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      await supabase.from('dashboard_notifications').insert({
        guild_id: guild.id,
        type: 'moderation',
        severity: 'warning',
        status: 'open',
        title: 'Ny moderation appeal',
        message: `${interaction.user.tag} har indsendt en appeal.`,
        source: 'appeal',
        metadata: {
          appeal_id: data.id,
          case_id: moderationCase?.id || null,
          user_id: interaction.user.id,
        },
      }).catch(() => {});

      return interaction.reply({
        content:
          `✅ Din appeal er modtaget. ID: \`${data.id.slice(0, 8)}\`\n` +
          'Staff kan nu behandle den i Operations Center.',
        flags: 64,
      });
    },

    'appeal-status': async (interaction) => {
      const guild = await getGuild(interaction.guild.id);
      if (!guild) {
        return interaction.reply({ content: '❌ Serveren findes ikke i dashboardet.', flags: 64 });
      }

      const appealId = interaction.options.getString('appeal_id');

      let query = supabase
        .from('moderation_appeals')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('appellant_discord_id', interaction.user.id)
        .order('created_at', { ascending: false });

      if (appealId) {
        const { data, error } = await query.limit(50);
        if (error) throw error;
        const matches = (data || []).filter((item) =>
          String(item.id).toLowerCase().startsWith(appealId.toLowerCase())
        );

        if (matches.length !== 1) {
          return interaction.reply({ content: '❌ Appeal-ID blev ikke fundet entydigt.', flags: 64 });
        }

        const appeal = matches[0];
        const embed = new EmbedBuilder()
          .setColor(appeal.status === 'accepted' ? '#22C55E' : appeal.status === 'rejected' ? '#EF4444' : '#5865F2')
          .setTitle(`Appeal ${appeal.id.slice(0, 8)}`)
          .addFields(
            { name: 'Status', value: appeal.status, inline: true },
            { name: 'Oprettet', value: `<t:${Math.floor(new Date(appeal.created_at).getTime() / 1000)}:R>`, inline: true },
            { name: 'Din besked', value: String(appeal.message).slice(0, 1024) },
          );

        if (appeal.staff_response) {
          embed.addFields({ name: 'Svar fra staff', value: String(appeal.staff_response).slice(0, 1024) });
        }

        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;

      if (!data?.length) {
        return interaction.reply({ content: 'Du har ingen appeals på denne server.', flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Dine appeals')
        .setDescription(
          data.map((appeal) =>
            `\`${appeal.id.slice(0, 8)}\` · **${appeal.status}** · <t:${Math.floor(new Date(appeal.created_at).getTime() / 1000)}:R>`
          ).join('\n')
        );

      return interaction.reply({ embeds: [embed], flags: 64 });
    },
  };
}

module.exports = { createAppealHandlers };
