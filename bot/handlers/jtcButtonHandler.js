/**
 * JTC Button Handler
 * 
 * Handles button + modal interactions on the JTC control panel
 * (sent by supabase/functions/jtc-handler when a channel is created).
 * 
 * Custom IDs used:
 *   jtc_lock_<channelId>    - Toggle channel lock (deny CONNECT to @everyone)
 *   jtc_hide_<channelId>    - Toggle channel visibility (deny VIEW_CHANNEL)
 *   jtc_rename_<channelId>  - Open modal to rename channel
 *   jtc_limit_<channelId>   - Open modal to set user limit
 *   jtc_kick_<channelId>    - Open user-select to kick a user from VC
 *   jtc_block_<channelId>   - Open user-select to block a user
 *   jtc_allow_<channelId>   - Open user-select to allow a user
 *
 * Modal IDs:
 *   jtc_rename_modal_<channelId>
 *   jtc_limit_modal_<channelId>
 *
 * User select IDs:
 *   jtc_kick_select_<channelId>
 *   jtc_block_select_<channelId>
 *   jtc_allow_select_<channelId>
 */

const {
  Events,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const JTC_PREFIXES = [
  'jtc_lock_', 'jtc_hide_', 'jtc_rename_', 'jtc_limit_',
  'jtc_kick_', 'jtc_block_', 'jtc_allow_', 'jtc_stream_',
  'jtc_rename_modal_', 'jtc_limit_modal_',
  'jtc_kick_select_', 'jtc_block_select_', 'jtc_allow_select_',
];

function isJTCInteraction(customId) {
  return customId && JTC_PREFIXES.some(p => customId.startsWith(p));
}

function parseChannelId(customId) {
  // Strip the longest matching prefix
  const prefix = JTC_PREFIXES
    .filter(p => customId.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? customId.slice(prefix.length) : null;
}

let supabase = null;

function getSupabase(url, key) {
  if (!supabase) supabase = createClient(url, key);
  return supabase;
}

function init(client, supabaseUrl, supabaseKey, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);
  const sb = getSupabase(supabaseUrl, supabaseKey);

  console.log('🎛️  JTC Button Handler initialized');

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const customId = interaction.customId;
      if (!customId || !isJTCInteraction(customId)) return;
      if (!interaction.guild || !shouldHandleGuild(interaction.guild.id)) return;

      const channelId = parseChannelId(customId);
      if (!channelId) return;

      // Verify channel is a JTC channel and the interactor is the owner
      const { data: jtcChannel } = await sb
        .from('jtc_channels')
        .select('owner_id')
        .eq('channel_id', channelId)
        .maybeSingle();

      if (!jtcChannel) {
        return interaction.reply({ content: '❌ Denne kanal er ikke længere en JTC-kanal.', flags: 64 }).catch(() => {});
      }
      if (String(jtcChannel.owner_id) !== String(interaction.user.id)) {
        return interaction.reply({ content: '❌ Kun ejeren af kanalen kan bruge disse knapper.', flags: 64 }).catch(() => {});
      }

      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: '❌ Kanalen findes ikke længere.', flags: 64 }).catch(() => {});
      }

      // ===== BUTTONS =====
      if (interaction.isButton()) {
        if (customId.startsWith('jtc_lock_')) {
          const everyone = interaction.guild.roles.everyone;
          const current = channel.permissionOverwrites.cache.get(everyone.id);
          const isLocked = current?.deny?.has(PermissionFlagsBits.Connect);
          await channel.permissionOverwrites.edit(everyone, {
            Connect: isLocked ? null : false,
          });
          return interaction.reply({
            content: isLocked ? '🔓 Kanalen er nu låst op.' : '🔒 Kanalen er nu låst.',
            flags: 64,
          });
        }

        if (customId.startsWith('jtc_hide_')) {
          const everyone = interaction.guild.roles.everyone;
          const current = channel.permissionOverwrites.cache.get(everyone.id);
          const isHidden = current?.deny?.has(PermissionFlagsBits.ViewChannel);
          await channel.permissionOverwrites.edit(everyone, {
            ViewChannel: isHidden ? null : false,
          });
          return interaction.reply({
            content: isHidden ? '👁️ Kanalen er nu synlig.' : '🙈 Kanalen er nu skjult.',
            flags: 64,
          });
        }

        if (customId.startsWith('jtc_stream_')) {
          const everyone = interaction.guild.roles.everyone;
          const current = channel.permissionOverwrites.cache.get(everyone.id);
          const canStream = current?.allow?.has(PermissionFlagsBits.Stream);
          await channel.permissionOverwrites.edit(everyone, {
            Stream: canStream ? null : true,
          });
          return interaction.reply({
            content: canStream ? '📺 Andre kan ikke længere streame.' : '📺 Andre kan nu streame i kanalen.',
            flags: 64,
          });
        }

        if (customId.startsWith('jtc_rename_')) {
          const modal = new ModalBuilder()
            .setCustomId(`jtc_rename_modal_${channelId}`)
            .setTitle('Omdøb kanal')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('name')
                  .setLabel('Nyt navn (max 100 tegn)')
                  .setStyle(TextInputStyle.Short)
                  .setMinLength(1)
                  .setMaxLength(100)
                  .setRequired(true)
                  .setValue(channel.name.slice(0, 100))
              )
            );
          return interaction.showModal(modal);
        }

        if (customId.startsWith('jtc_limit_')) {
          const modal = new ModalBuilder()
            .setCustomId(`jtc_limit_modal_${channelId}`)
            .setTitle('Sæt brugergrænse')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('limit')
                  .setLabel('Brugergrænse (0 = ingen, max 99)')
                  .setStyle(TextInputStyle.Short)
                  .setMinLength(1)
                  .setMaxLength(2)
                  .setRequired(true)
                  .setValue(String(channel.userLimit ?? 0))
              )
            );
          return interaction.showModal(modal);
        }

        if (customId.startsWith('jtc_kick_') || customId.startsWith('jtc_block_') || customId.startsWith('jtc_allow_')) {
          const action = customId.startsWith('jtc_kick_') ? 'kick'
                       : customId.startsWith('jtc_block_') ? 'block' : 'allow';
          const labels = {
            kick: 'Vælg bruger der skal kickes',
            block: 'Vælg bruger der skal blokeres',
            allow: 'Vælg bruger der skal tillades',
          };
          const select = new UserSelectMenuBuilder()
            .setCustomId(`jtc_${action}_select_${channelId}`)
            .setPlaceholder(labels[action])
            .setMinValues(1)
            .setMaxValues(1);
          return interaction.reply({
            content: labels[action],
            components: [new ActionRowBuilder().addComponents(select)],
            flags: 64,
          });
        }
      }

      // ===== MODALS =====
      if (interaction.isModalSubmit()) {
        if (customId.startsWith('jtc_rename_modal_')) {
          const newName = interaction.fields.getTextInputValue('name').trim().slice(0, 100);
          if (!newName) {
            return interaction.reply({ content: '❌ Navn må ikke være tomt.', flags: 64 });
          }
          await channel.setName(newName, `JTC rename by ${interaction.user.tag}`);
          return interaction.reply({ content: `✏️ Kanal omdøbt til **${newName}**.`, flags: 64 });
        }

        if (customId.startsWith('jtc_limit_modal_')) {
          const raw = interaction.fields.getTextInputValue('limit').trim();
          const limit = parseInt(raw, 10);
          if (Number.isNaN(limit) || limit < 0 || limit > 99) {
            return interaction.reply({ content: '❌ Brugergrænse skal være et tal mellem 0 og 99.', flags: 64 });
          }
          await channel.setUserLimit(limit, `JTC limit by ${interaction.user.tag}`);
          return interaction.reply({
            content: limit === 0 ? '👥 Brugergrænse fjernet.' : `👥 Brugergrænse sat til **${limit}**.`,
            flags: 64,
          });
        }
      }

      // ===== USER SELECT =====
      if (interaction.isUserSelectMenu()) {
        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);

        if (customId.startsWith('jtc_kick_select_')) {
          if (!targetMember) {
            return interaction.update({ content: '❌ Bruger ikke fundet.', components: [] });
          }
          if (targetMember.voice?.channelId === channelId) {
            await targetMember.voice.disconnect(`Kicked from JTC by ${interaction.user.tag}`).catch(() => {});
            return interaction.update({ content: `🚫 <@${targetId}> blev kicket.`, components: [] });
          }
          return interaction.update({ content: '❌ Brugeren er ikke i din kanal.', components: [] });
        }

        if (customId.startsWith('jtc_block_select_')) {
          await channel.permissionOverwrites.edit(targetId, { Connect: false, ViewChannel: false });
          if (targetMember?.voice?.channelId === channelId) {
            await targetMember.voice.disconnect('JTC blocked').catch(() => {});
          }
          return interaction.update({ content: `⛔ <@${targetId}> blev blokeret.`, components: [] });
        }

        if (customId.startsWith('jtc_allow_select_')) {
          await channel.permissionOverwrites.edit(targetId, { Connect: true, ViewChannel: true });
          return interaction.update({ content: `✅ <@${targetId}> blev tilladt.`, components: [] });
        }
      }
    } catch (err) {
      console.error('JTC button handler error:', err);
      try {
        const msg = { content: `❌ Noget gik galt: ${err.message || 'ukendt fejl'}`, flags: 64 };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      } catch {}
    }
  });
}

module.exports = { init };
