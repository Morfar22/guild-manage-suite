/**
 * Admin / Config / Reaction Role / Leveling-admin / Music-extra / Utility Commands
 *
 * Implements the commands that the dashboard lists but the bot did not have:
 *   admin:        setup, config, prefix, setlog, autorole, setwelcome, setleave,
 *                 automod, backup, restore
 *   reactionroles: reactionrole, rr-add, rr-remove, rr-list, rr-clear
 *   leveling:     levelroles, setlevelrole, xpmultiplier
 *   music:        seek, lyrics, autoplay, filter
 *   utility:      support, translate, weather
 *   tickets:      transcript
 *   giveaway:     gpause
 *   economy:      sell
 *
 * Usage in bot.js:
 *   const { createAdminHandlers } = require('./handlers/adminCommands');
 *   Object.assign(handlers, createAdminHandlers(client, { supabase, handlers, getKazagumo }));
 */

const {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const BRAND = '#6366F1';

function ephemeral(content) {
  return { content, flags: 64 };
}

function createAdminHandlers(client, { supabase, handlers, getKazagumo } = {}) {
  // ==================== HELPERS ====================

  async function getGuildUuid(interaction) {
    const { data } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', interaction.guild.id)
      .maybeSingle();
    return data?.id || null;
  }

  function requireManageGuild(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      interaction.reply(ephemeral('❌ Du skal have "Administrer server" for at bruge denne kommando.'));
      return false;
    }
    return true;
  }

  function requireAdmin(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      interaction.reply(ephemeral('❌ Du skal være administrator for at bruge denne kommando.'));
      return false;
    }
    return true;
  }

  async function upsertRow(table, guildUuid, patch) {
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('guild_id', guildUuid)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from(table).update(patch).eq('id', existing.id);
      if (error) throw error;
      return existing.id;
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ guild_id: guildUuid, ...patch })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  function player(interaction) {
    const kazagumo = getKazagumo?.();
    return kazagumo?.players?.get(interaction.guildId) || null;
  }

  function parseTimeToMs(input) {
    const str = String(input).trim();
    if (/^\d+$/.test(str)) return Number(str) * 1000;
    const parts = str.split(':').map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p))) return null;
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    return null;
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  // ==================== HANDLERS ====================

  return {
    // ---------- ADMIN: setup ----------
    setup: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret i dashboardet.');

      const [{ data: guild }, { data: logs }, { data: welcome }, { data: modules }] = await Promise.all([
        supabase.from('guilds').select('*').eq('id', guildUuid).maybeSingle(),
        supabase.from('log_settings').select('log_channel_id').eq('guild_id', guildUuid).maybeSingle(),
        supabase.from('welcome_settings').select('*').eq('guild_id', guildUuid).maybeSingle(),
        supabase.from('guild_modules').select('module_type, enabled').eq('guild_id', guildUuid),
      ]);

      const on = (v) => (v ? '✅' : '❌');
      const chan = (id) => (id ? `<#${id}>` : '_ikke sat_');

      const embed = new EmbedBuilder()
        .setColor(BRAND)
        .setTitle('⚙️ Server-opsætning')
        .setDescription('Status for de vigtigste indstillinger. Brug kommandoerne herunder for at ændre dem.')
        .addFields(
          { name: 'Prefix', value: `\`${guild?.command_prefix || '!'}\` — \`/prefix\``, inline: true },
          { name: 'Log-kanal', value: `${chan(logs?.log_channel_id || guild?.log_channel_id)} — \`/setlog\``, inline: true },
          { name: 'Automod', value: `${on(guild?.auto_moderation_enabled)} — \`/automod\``, inline: true },
          { name: 'Velkomst', value: `${chan(welcome?.welcome_channel_id)} — \`/setwelcome\``, inline: true },
          { name: 'Farvel', value: `${chan(welcome?.leave_channel_id)} — \`/setleave\``, inline: true },
          {
            name: 'Autorole',
            value: `${on(welcome?.auto_role_enabled)} ${(welcome?.auto_role_ids || []).map((r) => `<@&${r}>`).join(' ') || ''} — \`/autorole\``,
            inline: true,
          },
          {
            name: 'Moduler',
            value:
              (modules || []).map((m) => `${on(m.enabled)} ${m.module_type}`).join('\n') ||
              '_Ingen moduler konfigureret_',
          },
        )
        .setFooter({ text: 'Alle indstillinger kan også styres fra dashboardet.' });

      await interaction.editReply({ embeds: [embed] });
    },

    // ---------- ADMIN: config ----------
    config: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret i dashboardet.');

      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value');

      if (!setting) {
        const { data: guild } = await supabase.from('guilds').select('*').eq('id', guildUuid).maybeSingle();
        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('🔧 Konfiguration')
          .addFields(
            { name: 'prefix', value: `\`${guild?.command_prefix || '!'}\``, inline: true },
            { name: 'staff_role', value: guild?.staff_role_id ? `<@&${guild.staff_role_id}>` : '_ikke sat_', inline: true },
            { name: 'whitelist_role', value: guild?.whitelist_role_id ? `<@&${guild.whitelist_role_id}>` : '_ikke sat_', inline: true },
            { name: 'automod', value: guild?.auto_moderation_enabled ? 'til' : 'fra', inline: true },
          )
          .setFooter({ text: 'Brug /config setting:<prefix|staff_role|whitelist_role|automod> value:<værdi>' });
        return interaction.editReply({ embeds: [embed] });
      }

      if (!value) return interaction.editReply('❌ Angiv en værdi med `value:`.');

      const patch = {};
      switch (setting) {
        case 'prefix':
          if (value.length > 5) return interaction.editReply('❌ Prefix må højst være 5 tegn.');
          patch.command_prefix = value;
          break;
        case 'staff_role':
          patch.staff_role_id = value.replace(/[<@&>]/g, '');
          break;
        case 'whitelist_role':
          patch.whitelist_role_id = value.replace(/[<@&>]/g, '');
          break;
        case 'automod':
          patch.auto_moderation_enabled = ['true', 'til', 'on', 'ja', '1'].includes(value.toLowerCase());
          break;
        default:
          return interaction.editReply('❌ Ukendt indstilling. Brug: prefix, staff_role, whitelist_role, automod.');
      }

      const { error } = await supabase.from('guilds').update(patch).eq('id', guildUuid);
      if (error) return interaction.editReply(`❌ Kunne ikke gemme: ${error.message}`);
      await interaction.editReply(`✅ **${setting}** er opdateret.`);
    },

    // ---------- ADMIN: prefix ----------
    prefix: async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');
      const value = interaction.options.getString('prefix');

      if (!value) {
        const { data } = await supabase.from('guilds').select('command_prefix').eq('id', guildUuid).maybeSingle();
        return interaction.editReply(`ℹ️ Nuværende prefix: \`${data?.command_prefix || '!'}\``);
      }
      if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply('❌ Du skal have "Administrer server" for at ændre prefix.');
      }
      if (value.length > 5) return interaction.editReply('❌ Prefix må højst være 5 tegn.');

      const { error } = await supabase.from('guilds').update({ command_prefix: value }).eq('id', guildUuid);
      if (error) return interaction.editReply(`❌ Kunne ikke gemme: ${error.message}`);
      await interaction.editReply(`✅ Prefix er nu \`${value}\` — f.eks. \`${value}ping\`. (Kan tage op til 60 sek.)`);
    },

    // ---------- ADMIN: setlog ----------
    setlog: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');
      const channel = interaction.options.getChannel('channel');

      try {
        await upsertRow('log_settings', guildUuid, { log_channel_id: channel?.id || null });
        await supabase.from('guilds').update({ log_channel_id: channel?.id || null }).eq('id', guildUuid);
      } catch (e) {
        return interaction.editReply(`❌ Kunne ikke gemme: ${e.message}`);
      }
      await interaction.editReply(channel ? `✅ Log-kanal sat til <#${channel.id}>.` : '✅ Log-kanal fjernet.');
    },

    // ---------- ADMIN: autorole ----------
    autorole: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const action = interaction.options.getString('action') || 'list';
      const role = interaction.options.getRole('role');

      const { data: settings } = await supabase
        .from('welcome_settings')
        .select('id, auto_role_ids, auto_role_enabled')
        .eq('guild_id', guildUuid)
        .maybeSingle();
      const current = settings?.auto_role_ids || [];

      if (action === 'list') {
        return interaction.editReply(
          current.length
            ? `🎭 Autoroller (${settings?.auto_role_enabled ? 'aktiv' : 'deaktiveret'}):\n${current.map((r) => `<@&${r}>`).join('\n')}`
            : '🎭 Ingen autoroller er sat. Brug `/autorole action:add role:@rolle`.',
        );
      }

      if (action === 'clear') {
        await upsertRow('welcome_settings', guildUuid, { auto_role_ids: [], auto_role_enabled: false });
        return interaction.editReply('✅ Alle autoroller er fjernet.');
      }

      if (!role) return interaction.editReply('❌ Angiv en rolle.');
      if (role.managed || role.id === interaction.guild.id) {
        return interaction.editReply('❌ Den rolle kan ikke bruges som autorole.');
      }
      const me = await interaction.guild.members.fetchMe();
      if (role.position >= me.roles.highest.position) {
        return interaction.editReply('❌ Rollen er højere end min egen — flyt min rolle op i rolle-listen.');
      }

      let next = current;
      if (action === 'add') {
        if (current.includes(role.id)) return interaction.editReply('⚠️ Rollen er allerede tilføjet.');
        next = [...current, role.id];
      } else if (action === 'remove') {
        next = current.filter((r) => r !== role.id);
      }

      await upsertRow('welcome_settings', guildUuid, {
        auto_role_ids: next,
        auto_role_enabled: next.length > 0,
      });
      await interaction.editReply(
        action === 'add' ? `✅ <@&${role.id}> gives nu automatisk til nye medlemmer.` : `✅ <@&${role.id}> er fjernet fra autoroller.`,
      );
    },

    // ---------- ADMIN: setwelcome ----------
    setwelcome: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const patch = { enabled: true };
      if (channel) patch.welcome_channel_id = channel.id;
      if (message) patch.welcome_message = message;

      if (!channel && !message) {
        const { data } = await supabase
          .from('welcome_settings').select('*').eq('guild_id', guildUuid).maybeSingle();
        return interaction.editReply(
          `👋 Velkomst: ${data?.enabled ? '✅ aktiv' : '❌ inaktiv'}\nKanal: ${data?.welcome_channel_id ? `<#${data.welcome_channel_id}>` : '_ikke sat_'}\nBesked: ${data?.welcome_message || '_standard_'}`,
        );
      }

      try {
        await upsertRow('welcome_settings', guildUuid, patch);
      } catch (e) {
        return interaction.editReply(`❌ Kunne ikke gemme: ${e.message}`);
      }
      await interaction.editReply(
        `✅ Velkomstbesked opdateret.${channel ? ` Kanal: <#${channel.id}>.` : ''}\nVariabler: \`{user}\`, \`{server}\`, \`{membercount}\``,
      );
    },

    // ---------- ADMIN: setleave ----------
    setleave: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const patch = { leave_enabled: true };
      if (channel) patch.leave_channel_id = channel.id;
      if (message) patch.leave_message = message;

      if (!channel && !message) {
        const { data } = await supabase
          .from('welcome_settings').select('*').eq('guild_id', guildUuid).maybeSingle();
        return interaction.editReply(
          `👋 Farvel: ${data?.leave_enabled ? '✅ aktiv' : '❌ inaktiv'}\nKanal: ${data?.leave_channel_id ? `<#${data.leave_channel_id}>` : '_ikke sat_'}\nBesked: ${data?.leave_message || '_standard_'}`,
        );
      }

      try {
        await upsertRow('welcome_settings', guildUuid, patch);
      } catch (e) {
        return interaction.editReply(`❌ Kunne ikke gemme: ${e.message}`);
      }
      await interaction.editReply(`✅ Farvel-besked opdateret.${channel ? ` Kanal: <#${channel.id}>.` : ''}`);
    },

    // ---------- ADMIN: automod ----------
    automod: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const action = interaction.options.getString('action') || 'status';
      const ruleType = interaction.options.getString('rule');

      if (action === 'status') {
        const [{ data: guild }, { data: rules }] = await Promise.all([
          supabase.from('guilds').select('auto_moderation_enabled').eq('id', guildUuid).maybeSingle(),
          supabase.from('automod_rules').select('rule_type, enabled, action').eq('guild_id', guildUuid),
        ]);
        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('🛡️ Automod')
          .setDescription(`Global status: ${guild?.auto_moderation_enabled ? '✅ aktiv' : '❌ deaktiveret'}`)
          .addFields({
            name: 'Regler',
            value:
              (rules || []).map((r) => `${r.enabled ? '✅' : '❌'} \`${r.rule_type}\` → ${r.action}`).join('\n') ||
              '_Ingen regler oprettet — opret dem i dashboardet._',
          });
        return interaction.editReply({ embeds: [embed] });
      }

      if (action === 'on' || action === 'off') {
        const enabled = action === 'on';
        if (ruleType) {
          const { data: rule } = await supabase
            .from('automod_rules').select('id').eq('guild_id', guildUuid).eq('rule_type', ruleType).maybeSingle();
          if (!rule) return interaction.editReply(`❌ Reglen \`${ruleType}\` findes ikke. Opret den i dashboardet.`);
          await supabase.from('automod_rules').update({ enabled }).eq('id', rule.id);
          return interaction.editReply(`✅ Reglen \`${ruleType}\` er nu ${enabled ? 'aktiveret' : 'deaktiveret'}.`);
        }
        await supabase.from('guilds').update({ auto_moderation_enabled: enabled }).eq('id', guildUuid);
        return interaction.editReply(`✅ Automod er nu ${enabled ? 'aktiveret' : 'deaktiveret'} for hele serveren.`);
      }

      await interaction.editReply('❌ Ukendt handling. Brug: status, on, off.');
    },

    // ---------- ADMIN: backup ----------
    backup: async (interaction) => {
      if (!requireAdmin(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const action = interaction.options.getString('action') || 'create';

      if (action === 'list') {
        const { data: backups } = await supabase
          .from('server_backups')
          .select('id, description, backup_type, created_at')
          .eq('guild_id', guildUuid)
          .order('created_at', { ascending: false })
          .limit(15);
        if (!backups?.length) return interaction.editReply('📦 Ingen backups fundet.');
        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('📦 Backups')
          .setDescription(
            backups
              .map(
                (b) =>
                  `\`${b.id.slice(0, 8)}\` — ${b.description || b.backup_type} · <t:${Math.floor(new Date(b.created_at).getTime() / 1000)}:R>`,
              )
              .join('\n'),
          )
          .setFooter({ text: 'Gendan med /restore backup_id:<id>' });
        return interaction.editReply({ embeds: [embed] });
      }

      // create
      const guild = interaction.guild;
      await guild.roles.fetch();
      await guild.channels.fetch();

      const backupData = {
        name: guild.name,
        icon: guild.iconURL(),
        roles: guild.roles.cache
          .filter((r) => !r.managed && r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => ({
            name: r.name,
            color: r.hexColor,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: r.permissions.bitfield.toString(),
            position: r.position,
          })),
        channels: guild.channels.cache
          .sort((a, b) => a.rawPosition - b.rawPosition)
          .map((c) => ({
            name: c.name,
            type: c.type,
            parent: c.parent?.name || null,
            topic: c.topic || null,
            nsfw: c.nsfw || false,
            position: c.rawPosition,
          })),
      };

      const { data: created, error } = await supabase
        .from('server_backups')
        .insert({
          guild_id: guildUuid,
          backup_type: 'full',
          backup_data: backupData,
          description: interaction.options.getString('description') || `Backup af ${guild.name}`,
          created_by: interaction.user.id,
        })
        .select('id')
        .single();

      if (error) return interaction.editReply(`❌ Backup fejlede: ${error.message}`);
      await interaction.editReply(
        `✅ Backup oprettet: \`${created.id.slice(0, 8)}\`\n📊 ${backupData.roles.length} roller · ${backupData.channels.length} kanaler\nGendan med \`/restore backup_id:${created.id.slice(0, 8)}\``,
      );
    },

    // ---------- ADMIN: restore ----------
    restore: async (interaction) => {
      if (!requireAdmin(interaction)) return;
      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply(ephemeral('❌ Kun serverejeren kan gendanne en backup.'));
      }
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const idPart = (interaction.options.getString('backup_id') || '').trim();
      const { data: backups } = await supabase
        .from('server_backups')
        .select('id, backup_data, description, created_at')
        .eq('guild_id', guildUuid)
        .order('created_at', { ascending: false })
        .limit(30);

      const backup = idPart
        ? backups?.find((b) => b.id === idPart || b.id.startsWith(idPart))
        : backups?.[0];
      if (!backup) return interaction.editReply('❌ Backup ikke fundet. Se listen med `/backup action:list`.');

      const data = backup.backup_data || {};
      const mode = interaction.options.getString('mode') || 'roles';
      let createdRoles = 0;
      let createdChannels = 0;
      const errors = [];

      if (mode === 'roles' || mode === 'all') {
        const existing = new Set(interaction.guild.roles.cache.map((r) => r.name));
        for (const role of [...(data.roles || [])].reverse()) {
          if (existing.has(role.name)) continue;
          try {
            await interaction.guild.roles.create({
              name: role.name,
              color: role.color,
              hoist: role.hoist,
              mentionable: role.mentionable,
              permissions: BigInt(role.permissions || '0'),
              reason: `Restore fra backup ${backup.id.slice(0, 8)}`,
            });
            createdRoles++;
          } catch (e) {
            errors.push(`rolle ${role.name}: ${e.message}`);
          }
        }
      }

      if (mode === 'channels' || mode === 'all') {
        const existing = new Set(interaction.guild.channels.cache.map((c) => c.name));
        const categories = (data.channels || []).filter((c) => c.type === ChannelType.GuildCategory);
        const others = (data.channels || []).filter((c) => c.type !== ChannelType.GuildCategory);
        const catMap = new Map();

        for (const cat of categories) {
          if (existing.has(cat.name)) {
            const found = interaction.guild.channels.cache.find(
              (c) => c.name === cat.name && c.type === ChannelType.GuildCategory,
            );
            if (found) catMap.set(cat.name, found.id);
            continue;
          }
          try {
            const made = await interaction.guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
            catMap.set(cat.name, made.id);
            createdChannels++;
          } catch (e) {
            errors.push(`kategori ${cat.name}: ${e.message}`);
          }
        }

        for (const ch of others) {
          if (existing.has(ch.name)) continue;
          try {
            await interaction.guild.channels.create({
              name: ch.name,
              type: ch.type,
              parent: ch.parent ? catMap.get(ch.parent) || undefined : undefined,
              topic: ch.topic || undefined,
              nsfw: ch.nsfw || false,
            });
            createdChannels++;
          } catch (e) {
            errors.push(`kanal ${ch.name}: ${e.message}`);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND)
        .setTitle('♻️ Gendannelse færdig')
        .setDescription(`Backup \`${backup.id.slice(0, 8)}\` — ${backup.description || ''}`)
        .addFields(
          { name: 'Roller oprettet', value: String(createdRoles), inline: true },
          { name: 'Kanaler oprettet', value: String(createdChannels), inline: true },
        );
      if (errors.length) {
        embed.addFields({ name: `Fejl (${errors.length})`, value: errors.slice(0, 5).join('\n').slice(0, 1000) });
      }
      await interaction.editReply({ embeds: [embed] });
    },

    // ---------- REACTION ROLES ----------
    reactionrole: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const title = interaction.options.getString('title') || 'Vælg dine roller';
      const description = interaction.options.getString('description') || 'Klik på knapperne herunder for at få/fjerne roller.';

      const embed = new EmbedBuilder().setColor(BRAND).setTitle(title).setDescription(description);
      let message;
      try {
        message = await channel.send({ embeds: [embed] });
      } catch {
        return interaction.editReply('❌ Kunne ikke sende beskeden — tjek mine tilladelser i kanalen.');
      }

      const { error } = await supabase.from('reaction_role_panels').insert({
        guild_id: guildUuid,
        channel_id: channel.id,
        message_id: message.id,
        title,
        description,
        color: BRAND,
      });
      if (error) {
        await message.delete().catch(() => {});
        return interaction.editReply(`❌ Kunne ikke gemme panelet: ${error.message}`);
      }

      await interaction.editReply(
        `✅ Panel oprettet i <#${channel.id}>.\nTilføj roller med \`/rr-add message_id:${message.id} emoji:🎮 role:@rolle\``,
      );
    },

    'rr-add': async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji') || '🎯';
      const role = interaction.options.getRole('role');
      const description = interaction.options.getString('description') || null;

      const { data: panel } = await supabase
        .from('reaction_role_panels')
        .select('id, channel_id, title, description')
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId)
        .maybeSingle();
      if (!panel) return interaction.editReply('❌ Panel ikke fundet. Opret det først med `/reactionrole`.');

      const me = await interaction.guild.members.fetchMe();
      if (role.managed || role.position >= me.roles.highest.position) {
        return interaction.editReply('❌ Jeg kan ikke tildele den rolle — flyt min rolle højere op.');
      }

      const { error } = await supabase.from('reaction_roles').insert({
        guild_id: guildUuid,
        channel_id: panel.channel_id,
        message_id: messageId,
        emoji,
        role_id: role.id,
        role_name: role.name,
        description,
      });
      if (error) return interaction.editReply(`❌ Kunne ikke gemme: ${error.message}`);

      await rebuildPanel(interaction, guildUuid, panel, messageId);
      await interaction.editReply(`✅ ${emoji} → <@&${role.id}> tilføjet til panelet.`);
    },

    'rr-remove': async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const messageId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');

      const { data: panel } = await supabase
        .from('reaction_role_panels')
        .select('id, channel_id, title, description')
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId)
        .maybeSingle();
      if (!panel) return interaction.editReply('❌ Panel ikke fundet.');

      const { error } = await supabase
        .from('reaction_roles')
        .delete()
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId)
        .eq('role_id', role.id);
      if (error) return interaction.editReply(`❌ Kunne ikke fjerne: ${error.message}`);

      await rebuildPanel(interaction, guildUuid, panel, messageId);
      await interaction.editReply(`✅ <@&${role.id}> er fjernet fra panelet.`);
    },

    'rr-list': async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const { data: panels } = await supabase
        .from('reaction_role_panels')
        .select('message_id, channel_id, title')
        .eq('guild_id', guildUuid);
      const { data: roles } = await supabase
        .from('reaction_roles')
        .select('message_id, emoji, role_id')
        .eq('guild_id', guildUuid);

      if (!panels?.length) return interaction.editReply('🎭 Ingen reaction role-paneler er oprettet.');

      const embed = new EmbedBuilder().setColor(BRAND).setTitle('🎭 Reaction role-paneler');
      for (const panel of panels.slice(0, 10)) {
        const rows = (roles || []).filter((r) => r.message_id === panel.message_id);
        embed.addFields({
          name: `${panel.title || 'Panel'} (${panel.message_id})`,
          value:
            `<#${panel.channel_id}>\n` +
            (rows.map((r) => `${r.emoji} → <@&${r.role_id}>`).join('\n') || '_Ingen roller tilføjet_'),
        });
      }
      await interaction.editReply({ embeds: [embed] });
    },

    'rr-clear': async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const messageId = interaction.options.getString('message_id');
      if (!messageId) {
        await supabase.from('reaction_roles').delete().eq('guild_id', guildUuid);
        await supabase.from('reaction_role_panels').delete().eq('guild_id', guildUuid);
        return interaction.editReply('✅ Alle reaction role-paneler er slettet fra databasen.');
      }

      const { data: panel } = await supabase
        .from('reaction_role_panels')
        .select('id, channel_id, title, description')
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId)
        .maybeSingle();

      await supabase.from('reaction_roles').delete().eq('guild_id', guildUuid).eq('message_id', messageId);
      if (panel) {
        await rebuildPanel(interaction, guildUuid, panel, messageId);
      }
      await interaction.editReply('✅ Alle roller er ryddet fra panelet.');
    },

    // ---------- LEVELING ADMIN ----------
    levelroles: async (interaction) => {
      await interaction.deferReply();
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const { data: rows } = await supabase
        .from('level_roles')
        .select('level_required, role_id, role_name')
        .eq('guild_id', guildUuid)
        .order('level_required', { ascending: true });

      if (!rows?.length) {
        return interaction.editReply('📊 Ingen level-roller er sat. Brug `/setlevelrole level:5 role:@rolle`.');
      }
      const embed = new EmbedBuilder()
        .setColor(BRAND)
        .setTitle('📊 Level-roller')
        .setDescription(rows.map((r) => `**Level ${r.level_required}** → <@&${r.role_id}>`).join('\n'));
      await interaction.editReply({ embeds: [embed] });
    },

    setlevelrole: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      const remove = interaction.options.getBoolean('remove') || false;

      if (remove) {
        await supabase.from('level_roles').delete().eq('guild_id', guildUuid).eq('level_required', level);
        return interaction.editReply(`✅ Level-rollen for level ${level} er fjernet.`);
      }
      if (!role) return interaction.editReply('❌ Angiv en rolle (eller brug `remove:true`).');

      const me = await interaction.guild.members.fetchMe();
      if (role.managed || role.position >= me.roles.highest.position) {
        return interaction.editReply('❌ Jeg kan ikke tildele den rolle — flyt min rolle højere op.');
      }

      const { data: existing } = await supabase
        .from('level_roles').select('id').eq('guild_id', guildUuid).eq('level_required', level).maybeSingle();

      if (existing) {
        await supabase.from('level_roles').update({ role_id: role.id, role_name: role.name }).eq('id', existing.id);
      } else {
        const { error } = await supabase.from('level_roles').insert({
          guild_id: guildUuid, level_required: level, role_id: role.id, role_name: role.name,
        });
        if (error) return interaction.editReply(`❌ Kunne ikke gemme: ${error.message}`);
      }
      await interaction.editReply(`✅ Medlemmer får <@&${role.id}> ved **level ${level}**.`);
    },

    xpmultiplier: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const action = interaction.options.getString('action') || 'list';
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const multiplier = interaction.options.getNumber('multiplier');

      if (action === 'list') {
        const { data: rows } = await supabase
          .from('xp_multipliers').select('*').eq('guild_id', guildUuid).order('created_at');
        if (!rows?.length) return interaction.editReply('⚡ Ingen XP-multipliers. Brug `/xpmultiplier action:set role:@rolle multiplier:2`.');
        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('⚡ XP-multipliers')
          .setDescription(
            rows
              .map((r) => {
                const target = r.multiplier_type === 'role' ? `<@&${r.target_id}>` : r.multiplier_type === 'channel' ? `<#${r.target_id}>` : 'Hele serveren';
                return `${r.enabled ? '✅' : '❌'} ${target} — **x${r.multiplier}**`;
              })
              .join('\n'),
          );
        return interaction.editReply({ embeds: [embed] });
      }

      const target = role || channel;
      const type = role ? 'role' : channel ? 'channel' : 'server';

      if (action === 'remove') {
        const q = supabase.from('xp_multipliers').delete().eq('guild_id', guildUuid).eq('multiplier_type', type);
        if (target) await q.eq('target_id', target.id);
        else await q;
        return interaction.editReply('✅ Multiplier fjernet.');
      }

      if (!multiplier || multiplier <= 0 || multiplier > 10) {
        return interaction.editReply('❌ Angiv en multiplier mellem 0.1 og 10.');
      }

      const { data: existing } = await supabase
        .from('xp_multipliers')
        .select('id')
        .eq('guild_id', guildUuid)
        .eq('multiplier_type', type)
        .eq('target_id', target?.id || guildUuid)
        .maybeSingle();

      const payload = {
        guild_id: guildUuid,
        name: role ? `Rolle: ${role.name}` : channel ? `Kanal: ${channel.name}` : 'Server-wide',
        multiplier_type: type,
        target_id: target?.id || guildUuid,
        multiplier,
        enabled: true,
      };

      if (existing) await supabase.from('xp_multipliers').update(payload).eq('id', existing.id);
      else {
        const { error } = await supabase.from('xp_multipliers').insert(payload);
        if (error) return interaction.editReply(`❌ Kunne ikke gemme: ${error.message}`);
      }
      await interaction.editReply(`✅ XP-multiplier **x${multiplier}** sat for ${role ? `<@&${role.id}>` : channel ? `<#${channel.id}>` : 'hele serveren'}.`);
    },

    // ---------- MUSIC EXTRAS ----------
    seek: async (interaction) => {
      const p = player(interaction);
      if (!p || !p.queue.current) return interaction.reply(ephemeral('❌ Der afspilles ingen musik.'));
      const raw = interaction.options.getString('position');
      const ms = parseTimeToMs(raw);
      if (ms === null) return interaction.reply(ephemeral('❌ Ugyldigt tidsformat. Brug `90`, `1:30` eller `1:02:30`.'));
      const length = p.queue.current.length || 0;
      if (length && ms > length) return interaction.reply(ephemeral(`❌ Sangen er kun ${fmt(length)} lang.`));
      try {
        await p.shoukaku.seekTo(ms);
      } catch {
        return interaction.reply(ephemeral('❌ Kunne ikke spole i denne sang (livestream?).'));
      }
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#1DB954').setDescription(`⏩ Spolet til **${fmt(ms)}**`)],
      });
    },

    lyrics: async (interaction) => {
      await interaction.deferReply();
      const p = player(interaction);
      const query = interaction.options.getString('song') || p?.queue?.current?.title;
      if (!query) return interaction.editReply('❌ Ingen sang angivet, og der afspilles ikke noget.');

      const cleaned = String(query)
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/official|video|lyrics|audio|hd|4k|mv/gi, '')
        .trim();
      let artist = p?.queue?.current?.author || '';
      let title = cleaned;
      if (cleaned.includes('-')) {
        const [a, ...rest] = cleaned.split('-');
        artist = a.trim();
        title = rest.join('-').trim();
      }

      try {
        const res = await fetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || title)}/${encodeURIComponent(title)}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) throw new Error('not found');
        const json = await res.json();
        const text = (json.lyrics || '').trim();
        if (!text) throw new Error('empty');

        const chunks = text.match(/[\s\S]{1,3800}/g) || [];
        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle(`🎤 ${artist ? `${artist} — ` : ''}${title}`.slice(0, 250))
          .setDescription(chunks[0]);
        await interaction.editReply({ embeds: [embed] });
        for (const chunk of chunks.slice(1, 3)) {
          await interaction.followUp({ embeds: [new EmbedBuilder().setColor(BRAND).setDescription(chunk)] });
        }
      } catch {
        await interaction.editReply(`❌ Kunne ikke finde tekst til **${title}**. Prøv \`/lyrics song:Kunstner - Titel\`.`);
      }
    },

    autoplay: async (interaction) => {
      const p = player(interaction);
      if (!p) return interaction.reply(ephemeral('❌ Der afspilles ingen musik.'));
      const next = !p.data?.get?.('autoplay');
      p.data?.set?.('autoplay', next);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(`${next ? '🔀 Autoplay **aktiveret** — jeg finder lignende sange når køen er tom.' : '⏹️ Autoplay **deaktiveret**.'}`),
        ],
      });
    },

    filter: async (interaction) => {
      const p = player(interaction);
      if (!p || !p.queue.current) return interaction.reply(ephemeral('❌ Der afspilles ingen musik.'));
      const name = (interaction.options.getString('filter') || 'clear').toLowerCase();
      await interaction.deferReply();

      const presets = {
        clear: {},
        bassboost: { equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.55 }, { band: 2, gain: 0.4 }, { band: 3, gain: 0.25 }] },
        nightcore: { timescale: { speed: 1.2, pitch: 1.2, rate: 1 } },
        vaporwave: { timescale: { speed: 0.8, pitch: 0.8, rate: 1 } },
        '8d': { rotation: { rotationHz: 0.2 } },
        karaoke: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } },
        tremolo: { tremolo: { frequency: 4, depth: 0.75 } },
        vibrato: { vibrato: { frequency: 4, depth: 0.75 } },
      };

      if (!(name in presets)) {
        return interaction.editReply(`❌ Ukendt filter. Vælg: ${Object.keys(presets).join(', ')}`);
      }

      try {
        const node = p.shoukaku;
        if (name === 'clear') {
          await node.clearFilters?.();
          if (!node.clearFilters) await node.setFilters({});
        } else {
          await node.setFilters(presets[name]);
        }
      } catch (e) {
        return interaction.editReply(`❌ Kunne ikke anvende filteret: ${e.message}`);
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#1DB954')
            .setDescription(name === 'clear' ? '🎚️ Alle filtre er fjernet.' : `🎚️ Filter **${name}** anvendt.`),
        ],
      });
    },

    // ---------- UTILITY ----------
    support: async (interaction) => {
      // Alias: åbner ticket-flowet
      if (handlers?.ticket) return handlers.ticket(interaction);
      await interaction.reply(ephemeral('❌ Ticket-systemet er ikke aktiveret på denne server.'));
    },

    translate: async (interaction) => {
      await interaction.deferReply();
      const text = interaction.options.getString('text');
      const to = (interaction.options.getString('to') || 'da').toLowerCase();
      try {
        const url =
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const translated = (json?.[0] || []).map((p) => p?.[0]).filter(Boolean).join('');
        const detected = json?.[2] || 'auto';
        if (!translated) throw new Error('tom oversættelse');

        const embed = new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('🌍 Oversættelse')
          .addFields(
            { name: `Original (${detected})`, value: text.slice(0, 1000) },
            { name: `Oversat (${to})`, value: translated.slice(0, 1000) },
          );
        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        await interaction.editReply(`❌ Oversættelse fejlede: ${e.message}`);
      }
    },

    weather: async (interaction) => {
      await interaction.deferReply();
      const place = interaction.options.getString('location');
      try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(place)}?format=j1&lang=da`, {
          headers: { 'User-Agent': 'curl/8' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const cur = json.current_condition?.[0];
        const area = json.nearest_area?.[0];
        if (!cur) throw new Error('ingen data');

        const name = [area?.areaName?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join(', ') || place;
        const today = json.weather?.[0];

        const embed = new EmbedBuilder()
          .setColor('#38BDF8')
          .setTitle(`🌤️ Vejret i ${name}`)
          .setDescription(cur.lang_da?.[0]?.value || cur.weatherDesc?.[0]?.value || '')
          .addFields(
            { name: 'Temperatur', value: `${cur.temp_C}°C (føles som ${cur.FeelsLikeC}°C)`, inline: true },
            { name: 'Vind', value: `${cur.windspeedKmph} km/t ${cur.winddir16Point}`, inline: true },
            { name: 'Luftfugtighed', value: `${cur.humidity}%`, inline: true },
            { name: 'I dag', value: today ? `⬆️ ${today.maxtempC}°C / ⬇️ ${today.mintempC}°C` : '—', inline: true },
            { name: 'Sigtbarhed', value: `${cur.visibility} km`, inline: true },
            { name: 'Tryk', value: `${cur.pressure} hPa`, inline: true },
          )
          .setFooter({ text: 'Data: wttr.in' });
        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        await interaction.editReply(`❌ Kunne ikke hente vejret for **${place}**: ${e.message}`);
      }
    },

    // ---------- TICKETS: transcript ----------
    transcript: async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const explicitId = interaction.options.getString('ticket_id');
      let ticket = null;

      if (explicitId) {
        const { data } = await supabase
          .from('tickets')
          .select('id, subject, creator_name, status, created_at')
          .eq('guild_id', guildUuid)
          .or(`id.eq.${explicitId},channel_id.eq.${explicitId}`)
          .maybeSingle();
        ticket = data;
      } else {
        const { data } = await supabase
          .from('tickets')
          .select('id, subject, creator_name, status, created_at')
          .eq('guild_id', guildUuid)
          .eq('channel_id', interaction.channel.id)
          .maybeSingle();
        ticket = data;
      }

      if (!ticket) {
        return interaction.editReply('❌ Ingen ticket fundet. Brug kommandoen i en ticket-kanal, eller angiv `ticket_id`.');
      }

      const { data: transcript } = await supabase
        .from('ticket_transcripts')
        .select('html_url, message_count, created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (transcript?.html_url) {
        return interaction.editReply(
          `📄 **Transkript for ticket \`${ticket.id.slice(0, 8)}\`**\n${transcript.message_count || 0} beskeder\n${transcript.html_url}`,
        );
      }

      // Fald tilbage til en tekst-transskription fra databasen
      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('author_name, content, created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })
        .limit(500);

      if (!messages?.length) return interaction.editReply('❌ Der er ingen gemte beskeder for denne ticket endnu.');

      const body = messages
        .map((m) => `[${new Date(m.created_at).toLocaleString('da-DK')}] ${m.author_name}: ${m.content || ''}`)
        .join('\n');

      await interaction.editReply({
        content: `📄 Transkript for ticket \`${ticket.id.slice(0, 8)}\` (${messages.length} beskeder)`,
        files: [{ attachment: Buffer.from(body, 'utf8'), name: `transcript-${ticket.id.slice(0, 8)}.txt` }],
      });
    },

    // ---------- GIVEAWAY: gpause ----------
    gpause: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const messageId = interaction.options.getString('message_id');
      const { data: giveaway } = await supabase
        .from('giveaways')
        .select('id, prize, paused')
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId)
        .maybeSingle();

      if (!giveaway) return interaction.editReply('❌ Giveaway ikke fundet. Se aktive med `/glist`.');

      const next = !giveaway.paused;
      const { error } = await supabase.from('giveaways').update({ paused: next }).eq('id', giveaway.id);
      if (error) return interaction.editReply(`❌ Kunne ikke opdatere: ${error.message}`);

      await interaction.editReply(
        next
          ? `⏸️ Giveawayen **${giveaway.prize}** er sat på pause — den slutter ikke automatisk før den genoptages.`
          : `▶️ Giveawayen **${giveaway.prize}** kører igen.`,
      );
    },

    // ---------- ECONOMY: sell ----------
    sell: async (interaction) => {
      await interaction.deferReply();
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Serveren er ikke registreret.');

      const itemName = interaction.options.getString('item');
      const [{ data: settings }, { data: account }] = await Promise.all([
        supabase.from('economy_settings').select('*').eq('guild_id', guildUuid).maybeSingle(),
        supabase
          .from('economy_accounts')
          .select('*')
          .eq('guild_id', guildUuid)
          .eq('user_id', interaction.user.id)
          .maybeSingle(),
      ]);
      const symbol = settings?.currency_symbol || '🪙';

      if (!account) return interaction.editReply('❌ Du har ingen konto endnu — brug `/balance` først.');

      const { data: items } = await supabase
        .from('economy_shop_items')
        .select('id, name, price, role_id')
        .eq('guild_id', guildUuid)
        .eq('enabled', true);

      const item = (items || []).find((i) => i.name.toLowerCase() === itemName.toLowerCase());
      if (!item) {
        return interaction.editReply(
          `❌ Varen findes ikke i shoppen. Se \`/shop\`.${items?.length ? `\nTilgængelige: ${items.map((i) => i.name).join(', ')}` : ''}`,
        );
      }
      if (!item.role_id) return interaction.editReply('❌ Denne vare kan ikke sælges tilbage.');

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(item.role_id)) {
        return interaction.editReply(`❌ Du ejer ikke **${item.name}**.`);
      }

      const refund = Math.floor((item.price || 0) * 0.5);
      try {
        await member.roles.remove(item.role_id, 'Solgt tilbage til shoppen');
      } catch {
        return interaction.editReply('❌ Jeg kunne ikke fjerne rollen — tjek mine tilladelser.');
      }

      const newWallet = (account.wallet || 0) + refund;
      await supabase.from('economy_accounts').update({ wallet: newWallet }).eq('id', account.id);
      await supabase.from('economy_transactions').insert({
        guild_id: guildUuid,
        to_user_id: interaction.user.id,
        amount: refund,
        transaction_type: 'sell',
        description: `Solgte ${item.name}`,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#22C55E')
            .setTitle('💰 Vare solgt')
            .setDescription(`Du solgte **${item.name}** for ${symbol} **${refund}** (50% af købsprisen).`)
            .addFields({ name: 'Ny saldo', value: `${symbol} ${newWallet}` }),
        ],
      });
    },
  };

  // ==================== PANEL RENDERING ====================
  async function rebuildPanel(interaction, guildUuid, panel, messageId) {
    try {
      const { data: rows } = await supabase
        .from('reaction_roles')
        .select('emoji, role_id, role_name, description')
        .eq('guild_id', guildUuid)
        .eq('message_id', messageId);

      const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
      if (!channel) return;
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return;

      const embed = new EmbedBuilder()
        .setColor(BRAND)
        .setTitle(panel.title || 'Vælg dine roller')
        .setDescription(
          `${panel.description || 'Klik på knapperne herunder for at få/fjerne roller.'}\n\n` +
            ((rows || [])
              .map((r) => `${r.emoji} — <@&${r.role_id}>${r.description ? ` · ${r.description}` : ''}`)
              .join('\n') || '_Ingen roller endnu_'),
        );

      const components = [];
      const chunks = [];
      for (let i = 0; i < (rows || []).length; i += 5) chunks.push(rows.slice(i, i + 5));
      for (const chunk of chunks.slice(0, 5)) {
        const row = new ActionRowBuilder();
        for (const r of chunk) {
          const button = new ButtonBuilder()
            .setCustomId(`rr_${r.role_id}`)
            .setLabel((r.role_name || 'Rolle').slice(0, 60))
            .setStyle(ButtonStyle.Secondary);
          if (/^\p{Emoji}/u.test(r.emoji || '') && !/^:/.test(r.emoji || '')) {
            try { button.setEmoji(r.emoji); } catch { /* ignore invalid emoji */ }
          }
          row.addComponents(button);
        }
        components.push(row);
      }

      await message.edit({ embeds: [embed], components });
    } catch (e) {
      console.error('[AdminCommands] rebuildPanel fejl:', e.message);
    }
  }
}

module.exports = { createAdminHandlers };
