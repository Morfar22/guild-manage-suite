'use strict';

const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

function createAdvancedModerationHandlers(client, { supabase }) {
  const getGuildRecord = async (discordGuildId) => {
    const { data, error } = await supabase
      .from('guilds')
      .select('id, guild_name')
      .eq('guild_id', discordGuildId)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const insertModerationLog = async ({
    interaction,
    actionType,
    target,
    reason,
    durationSeconds = null,
    expiresAt = null,
    metadata = {},
  }) => {
    const guild = await getGuildRecord(interaction.guild.id);
    if (!guild) return null;

    const { data, error } = await supabase
      .from('moderation_logs')
      .insert({
        guild_id: guild.id,
        action_type: actionType,
        moderator_id: interaction.user.id,
        moderator_name: interaction.user.tag,
        target_id: target.id,
        target_name: target.tag || target.username || target.id,
        reason: reason || null,
        duration_seconds: durationSeconds,
        expires_at: expiresAt,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  };

  const findCase = async (interaction, input) => {
    const guild = await getGuildRecord(interaction.guild.id);
    if (!guild) return { guild: null, moderationCase: null };

    const value = String(input || '').trim();
    if (!value) return { guild, moderationCase: null };

    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
      const { data } = await supabase
        .from('moderation_logs')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('id', value)
        .maybeSingle();
      return { guild, moderationCase: data || null };
    }

    const { data } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('guild_id', guild.id)
      .order('created_at', { ascending: false })
      .limit(250);

    const needle = value.toLowerCase();
    const matches = (data || []).filter((row) => String(row.id).toLowerCase().startsWith(needle));
    return {
      guild,
      moderationCase: matches.length === 1 ? matches[0] : null,
      ambiguous: matches.length > 1,
    };
  };

  const requirePermission = async (interaction, permission, message) => {
    if (interaction.member.permissions.has(permission)) return true;
    await interaction.reply({ content: message, flags: 64 });
    return false;
  };

  return {
    purge: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ManageMessages,
        '❌ Du har ikke tilladelse til at slette beskeder.'
      )) return;

      const amount = Math.max(1, Math.min(100, interaction.options.getInteger('amount', true)));
      const filter = interaction.options.getString('filter') || 'all';
      const targetUser = interaction.options.getUser('user');

      await interaction.deferReply({ flags: 64 });

      try {
        let messages = await interaction.channel.messages.fetch({ limit: 100 });

        if (targetUser) {
          messages = messages.filter((message) => message.author.id === targetUser.id);
        }

        if (filter === 'bots') {
          messages = messages.filter((message) => message.author.bot);
        } else if (filter === 'links') {
          messages = messages.filter((message) => /https?:\/\//i.test(message.content || ''));
        } else if (filter === 'embeds') {
          messages = messages.filter((message) => message.embeds?.length > 0);
        }

        const selected = [...messages.values()].slice(0, amount);
        const deleted = await interaction.channel.bulkDelete(selected, true);

        await insertModerationLog({
          interaction,
          actionType: 'delete',
          target: targetUser || { id: interaction.channel.id, tag: `#${interaction.channel.name}` },
          reason: `Purge: ${filter}`,
          metadata: {
            requested: amount,
            deleted: deleted.size,
            filter,
            channel_id: interaction.channel.id,
            user_filter: targetUser?.id || null,
          },
        });

        await interaction.editReply(`✅ Slettede **${deleted.size}** beskeder.`);
      } catch (error) {
        console.error('[Mod] purge error:', error);
        await interaction.editReply('❌ Kunne ikke purge beskederne.');
      }
    },

    massban: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.BanMembers,
        '❌ Du har ikke tilladelse til at banne brugere.'
      )) return;

      const raw = interaction.options.getString('users', true);
      const reason = interaction.options.getString('reason') || 'Massban';
      const deleteDays = Math.max(0, Math.min(7, interaction.options.getInteger('delete_messages') || 0));
      const ids = [...new Set(raw.split(/[\s,;]+/).map((id) => id.replace(/\D/g, '')).filter(Boolean))].slice(0, 25);

      if (!ids.length) {
        return interaction.reply({ content: '❌ Ingen gyldige Discord bruger-ID’er fundet.', flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      const banned = [];
      const failed = [];

      for (const id of ids) {
        if (id === interaction.user.id || id === client.user?.id) {
          failed.push(id);
          continue;
        }

        try {
          await interaction.guild.members.ban(id, {
            reason: `${reason} | Massban af ${interaction.user.tag}`,
            deleteMessageSeconds: deleteDays * 86400,
          });
          banned.push(id);

          await insertModerationLog({
            interaction,
            actionType: 'ban',
            target: { id, tag: id },
            reason: `Massban: ${reason}`,
            metadata: { massban: true, delete_days: deleteDays },
          });
        } catch {
          failed.push(id);
        }
      }

      await interaction.editReply(
        `🔨 Massban færdig: **${banned.length}** banned, **${failed.length}** fejlede.` +
        (failed.length ? `\nFejlede: ${failed.map((id) => `\`${id}\``).join(', ')}` : '')
      );
    },

    case: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ModerateMembers,
        '❌ Du har ikke moderation-tilladelse.'
      )) return;

      const caseId = interaction.options.getString('case_id', true);
      const { moderationCase, ambiguous } = await findCase(interaction, caseId);

      if (ambiguous) {
        return interaction.reply({ content: '❌ Case-ID’et matcher flere sager. Brug flere tegn.', flags: 64 });
      }
      if (!moderationCase) {
        return interaction.reply({ content: '❌ Sagen blev ikke fundet.', flags: 64 });
      }

      const { data: notes } = await supabase
        .from('moderation_notes')
        .select('note, moderator_name, created_at')
        .eq('case_id', moderationCase.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📁 Moderation Case ${String(moderationCase.id).slice(0, 8)}`)
        .addFields(
          { name: 'Handling', value: String(moderationCase.action_type), inline: true },
          { name: 'Bruger', value: `${moderationCase.target_name || 'Ukendt'} (\`${moderationCase.target_id}\`)`, inline: true },
          { name: 'Moderator', value: moderationCase.moderator_name || moderationCase.moderator_id, inline: true },
          { name: 'Årsag', value: moderationCase.reason || 'Ingen årsag' },
          { name: 'Oprettet', value: `<t:${Math.floor(new Date(moderationCase.created_at).getTime() / 1000)}:F>`, inline: true },
        )
        .setFooter({ text: moderationCase.id });

      if (moderationCase.expires_at) {
        embed.addFields({
          name: 'Udløber',
          value: `<t:${Math.floor(new Date(moderationCase.expires_at).getTime() / 1000)}:R>`,
          inline: true,
        });
      }

      if (notes?.length) {
        embed.addFields({
          name: 'Noter',
          value: notes
            .map((note) => `• ${String(note.note).slice(0, 180)} — ${note.moderator_name || 'Staff'}`)
            .join('\n')
            .slice(0, 1024),
        });
      }

      await interaction.reply({ embeds: [embed], flags: 64 });
    },

    history: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ModerateMembers,
        '❌ Du har ikke moderation-tilladelse.'
      )) return;

      const user = interaction.options.getUser('user', true);
      const guild = await getGuildRecord(interaction.guild.id);
      if (!guild) return interaction.reply({ content: '❌ Serveren findes ikke i databasen.', flags: 64 });

      const [{ data: logs }, { data: notes }] = await Promise.all([
        supabase
          .from('moderation_logs')
          .select('id, action_type, reason, moderator_name, created_at, expires_at')
          .eq('guild_id', guild.id)
          .eq('target_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('moderation_notes')
          .select('id, note, moderator_name, created_at')
          .eq('guild_id', guild.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      const embed = new EmbedBuilder()
        .setColor('#F59E0B')
        .setTitle(`📚 Moderation historik: ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(
          logs?.length
            ? logs.map((row) =>
                `**${String(row.action_type).toUpperCase()}** · \`${String(row.id).slice(0, 8)}\`\n` +
                `${String(row.reason || 'Ingen årsag').slice(0, 180)}\n` +
                `<t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R> · ${row.moderator_name || 'Staff'}`
              ).join('\n\n').slice(0, 3600)
            : 'Ingen moderation-sager fundet.'
        )
        .setFooter({ text: `${logs?.length || 0} handlinger · ${notes?.length || 0} noter vist` });

      if (notes?.length) {
        embed.addFields({
          name: '📝 Staff-noter',
          value: notes
            .map((note) => `• ${String(note.note).slice(0, 180)} — ${note.moderator_name || 'Staff'}`)
            .join('\n')
            .slice(0, 1024),
        });
      }

      await interaction.reply({ embeds: [embed], flags: 64 });
    },

    reason: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ModerateMembers,
        '❌ Du har ikke moderation-tilladelse.'
      )) return;

      const caseId = interaction.options.getString('case_id', true);
      const newReason = interaction.options.getString('reason', true).trim();
      const { moderationCase, ambiguous } = await findCase(interaction, caseId);

      if (ambiguous) return interaction.reply({ content: '❌ Case-ID matcher flere sager.', flags: 64 });
      if (!moderationCase) return interaction.reply({ content: '❌ Sagen blev ikke fundet.', flags: 64 });

      const previousReason = moderationCase.reason;

      const { error } = await supabase
        .from('moderation_logs')
        .update({
          reason: newReason,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(moderationCase.metadata || {}),
            reason_history: [
              ...((moderationCase.metadata?.reason_history || []).slice(-9)),
              {
                previous: previousReason,
                changed_by: interaction.user.id,
                changed_by_name: interaction.user.tag,
                changed_at: new Date().toISOString(),
              },
            ],
          },
        })
        .eq('id', moderationCase.id);

      if (error) throw error;

      await interaction.reply({
        content: `✅ Årsagen på case \`${String(moderationCase.id).slice(0, 8)}\` er opdateret.`,
        flags: 64,
      });
    },

    note: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ModerateMembers,
        '❌ Du har ikke moderation-tilladelse.'
      )) return;

      const user = interaction.options.getUser('user', true);
      const note = interaction.options.getString('note', true).trim();
      const caseInput = interaction.options.getString('case_id');
      const guild = await getGuildRecord(interaction.guild.id);
      if (!guild) return interaction.reply({ content: '❌ Serveren findes ikke i databasen.', flags: 64 });

      let caseId = null;
      if (caseInput) {
        const found = await findCase(interaction, caseInput);
        if (found.ambiguous) return interaction.reply({ content: '❌ Case-ID matcher flere sager.', flags: 64 });
        if (!found.moderationCase) return interaction.reply({ content: '❌ Sagen blev ikke fundet.', flags: 64 });
        caseId = found.moderationCase.id;
      }

      const { data, error } = await supabase
        .from('moderation_notes')
        .insert({
          guild_id: guild.id,
          user_id: user.id,
          user_name: user.tag,
          moderator_id: interaction.user.id,
          moderator_name: interaction.user.tag,
          note,
          case_id: caseId,
        })
        .select('id')
        .single();

      if (error) throw error;

      await interaction.reply({
        content: `📝 Note gemt på **${user.tag}** (\`${String(data.id).slice(0, 8)}\`).`,
        flags: 64,
      });
    },

    tempban: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.BanMembers,
        '❌ Du har ikke tilladelse til at banne.'
      )) return;

      const user = interaction.options.getUser('user', true);
      const durationMinutes = Math.max(1, Math.min(525600, interaction.options.getInteger('duration', true)));
      const reason = interaction.options.getString('reason') || 'Midlertidigt ban';

      if (user.id === interaction.user.id || user.id === client.user?.id) {
        return interaction.reply({ content: '❌ Du kan ikke tempbanne denne bruger.', flags: 64 });
      }

      const guild = await getGuildRecord(interaction.guild.id);
      if (!guild) return interaction.reply({ content: '❌ Serveren findes ikke i databasen.', flags: 64 });

      const executeAt = new Date(Date.now() + durationMinutes * 60_000);

      await interaction.guild.members.ban(user.id, {
        reason: `${reason} | Tempban af ${interaction.user.tag}`,
      });

      const caseId = await insertModerationLog({
        interaction,
        actionType: 'tempban',
        target: user,
        reason,
        durationSeconds: durationMinutes * 60,
        expiresAt: executeAt.toISOString(),
        metadata: { scheduled_unban: true },
      });

      const { error } = await supabase.from('moderation_scheduled_actions').insert({
        guild_id: guild.id,
        discord_guild_id: interaction.guild.id,
        action_type: 'unban',
        target_id: user.id,
        target_name: user.tag,
        reason,
        execute_at: executeAt.toISOString(),
        created_by_id: interaction.user.id,
        created_by_name: interaction.user.tag,
        metadata: { case_id: caseId },
      });
      if (error) throw error;

      await interaction.reply(
        `⏳ **${user.tag}** er tempbanned i **${durationMinutes} minutter**. Udløber <t:${Math.floor(executeAt.getTime() / 1000)}:R>.`
      );
    },

    role: async (interaction) => {
      if (!await requirePermission(
        interaction,
        PermissionFlagsBits.ManageRoles,
        '❌ Du har ikke tilladelse til at administrere roller.'
      )) return;

      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getRole('role', true);
      const action = interaction.options.getString('action', true);
      const reason = interaction.options.getString('reason') || 'Moderation role command';

      const member = await interaction.guild.members.fetch(user.id);
      if (!member.manageable || !role.editable) {
        return interaction.reply({ content: '❌ Botten kan ikke administrere denne bruger eller rolle pga. rollehierarkiet.', flags: 64 });
      }

      if (action === 'add') await member.roles.add(role, reason);
      else await member.roles.remove(role, reason);

      await insertModerationLog({
        interaction,
        actionType: 'role',
        target: user,
        reason,
        metadata: { role_id: role.id, role_name: role.name, role_action: action },
      });

      await interaction.reply({
        content: `✅ Rollen **${role.name}** blev ${action === 'add' ? 'tilføjet til' : 'fjernet fra'} **${user.tag}**.`,
        flags: 64,
      });
    },

    quarantine: async (interaction) => {
      const hasModerate = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);
      const hasRoles = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles);
      if (!hasModerate || !hasRoles) {
        return interaction.reply({
          content: '❌ Du skal have både Moderate Members og Manage Roles.',
          flags: 64,
        });
      }

      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getRole('role', true);
      const durationMinutes = Math.max(0, Math.min(40320, interaction.options.getInteger('duration') || 0));
      const reason = interaction.options.getString('reason') || 'Quarantine';

      const member = await interaction.guild.members.fetch(user.id);
      if (!member.manageable || !role.editable) {
        return interaction.reply({ content: '❌ Botten kan ikke administrere denne bruger eller rolle.', flags: 64 });
      }

      await member.roles.add(role, reason);

      const executeAt = durationMinutes > 0
        ? new Date(Date.now() + durationMinutes * 60_000)
        : null;

      const caseId = await insertModerationLog({
        interaction,
        actionType: 'quarantine',
        target: user,
        reason,
        durationSeconds: durationMinutes > 0 ? durationMinutes * 60 : null,
        expiresAt: executeAt?.toISOString() || null,
        metadata: { role_id: role.id, role_name: role.name },
      });

      if (executeAt) {
        const guild = await getGuildRecord(interaction.guild.id);
        const { error } = await supabase.from('moderation_scheduled_actions').insert({
          guild_id: guild.id,
          discord_guild_id: interaction.guild.id,
          action_type: 'remove_role',
          target_id: user.id,
          target_name: user.tag,
          role_id: role.id,
          reason,
          execute_at: executeAt.toISOString(),
          created_by_id: interaction.user.id,
          created_by_name: interaction.user.tag,
          metadata: { case_id: caseId },
        });
        if (error) throw error;
      }

      await interaction.reply({
        content: executeAt
          ? `🔒 **${user.tag}** er quarantined med **${role.name}** indtil <t:${Math.floor(executeAt.getTime() / 1000)}:R>.`
          : `🔒 **${user.tag}** er quarantined med rollen **${role.name}**.`,
        flags: 64,
      });
    },
  };
}

function setupModerationScheduler(client, { supabase, shouldHandleGuild }) {
  let running = false;

  const processDue = async () => {
    if (running || !client.isReady?.()) return;
    running = true;

    try {
      const { data: actions, error } = await supabase
        .from('moderation_scheduled_actions')
        .select('*')
        .eq('status', 'pending')
        .lte('execute_at', new Date().toISOString())
        .order('execute_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      for (const action of actions || []) {
        if (shouldHandleGuild && !shouldHandleGuild(action.discord_guild_id)) continue;

        const { data: claimed, error: claimError } = await supabase
          .from('moderation_scheduled_actions')
          .update({ status: 'executing', updated_at: new Date().toISOString() })
          .eq('id', action.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (claimError || !claimed) continue;

        try {
          const guild = client.guilds.cache.get(action.discord_guild_id)
            || await client.guilds.fetch(action.discord_guild_id);

          if (action.action_type === 'unban') {
            await guild.members.unban(action.target_id, 'Tempban udløbet');
          } else if (action.action_type === 'remove_role') {
            const member = await guild.members.fetch(action.target_id);
            await member.roles.remove(action.role_id, 'Quarantine udløbet');
          }

          await supabase
            .from('moderation_scheduled_actions')
            .update({
              status: 'executed',
              executed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', action.id);
        } catch (actionError) {
          console.error('[ModScheduler] Scheduled moderation action failed:', actionError);
          await supabase
            .from('moderation_scheduled_actions')
            .update({
              status: 'failed',
              last_error: String(actionError?.message || actionError).slice(0, 1000),
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.id);
        }
      }
    } catch (error) {
      console.error('[ModScheduler] Sweep failed:', error);
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => void processDue(), 30_000);
  setTimeout(() => void processDue(), 5_000);

  return {
    destroy() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  createAdvancedModerationHandlers,
  setupModerationScheduler,
};
