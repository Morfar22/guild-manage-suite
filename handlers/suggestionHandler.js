/**
 * Suggestion Handler
 * 
 * Listens for new messages in the configured suggestion channel,
 * creates embed with upvote/downvote buttons, and saves to DB.
 * Also handles vote button interactions.
 */

const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createRealtimeSubscription } = require('./realtimeRetry');

function setupSuggestionHandler(client, supabase, options = {}) {
  const { shouldHandleGuild, isCustomBot } = options;

  // Cache suggestion settings per guild (guild_id -> settings)
  const settingsCache = new Map();
  // Dedup: track recently processed messages to prevent double-processing
  const recentlyProcessed = new Set();

  async function getSettings(guildDbId) {
    if (settingsCache.has(guildDbId)) {
      const cached = settingsCache.get(guildDbId);
      if (Date.now() - cached.ts < 60_000) return cached.data;
    }
    const { data } = await supabase
      .from('suggestion_settings')
      .select('*')
      .eq('guild_id', guildDbId)
      .eq('enabled', true)
      .maybeSingle();
    settingsCache.set(guildDbId, { data, ts: Date.now() });
    return data;
  }

  async function getGuildDbId(discordGuildId) {
    const { data } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', discordGuildId)
      .single();
    return data?.id;
  }

  // ── Listen for new messages in suggestion channels ──
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

      // Dedup: skip if this message was already processed by another bot instance
      const dedupKey = message.id;
      if (recentlyProcessed.has(dedupKey)) return;
      recentlyProcessed.add(dedupKey);
      setTimeout(() => recentlyProcessed.delete(dedupKey), 10_000);

      const guildDbId = await getGuildDbId(message.guild.id);
      if (!guildDbId) return;

      const settings = await getSettings(guildDbId);
      if (!settings || !settings.channel_id) return;

      // Only process messages in the configured suggestion channel
      if (message.channel.id !== settings.channel_id) return;

      const content = message.content.trim();
      if (!content) return;

      // DB-level dedup: check if this exact message was already processed
      const { data: existing } = await supabase
        .from('suggestions')
        .select('id')
        .eq('guild_id', guildDbId)
        .eq('author_id', message.author.id)
        .eq('content', content)
        .gte('created_at', new Date(Date.now() - 10_000).toISOString())
        .maybeSingle();

      if (existing) {
        // Already processed by another bot instance, just delete the message
        try { await message.delete(); } catch (_) {}
        return;
      }

      // Delete the original message
      try {
        await message.delete();
      } catch (e) {
        console.log('[Suggestion] Could not delete original message:', e.message);
      }

      // Save suggestion to database
      const { data: suggestion, error } = await supabase
        .from('suggestions')
        .insert({
          guild_id: guildDbId,
          channel_id: settings.channel_id,
          author_id: message.author.id,
          author_name: settings.anonymous_mode ? 'Anonym' : message.author.username,
          content,
          status: 'pending',
          upvotes: 0,
          downvotes: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('[Suggestion] Failed to save suggestion:', error.message);
        return;
      }

      // Build the suggestion embed
      const color = settings.color ? parseInt(settings.color.replace('#', ''), 16) : 0x5865F2;
      const embed = new EmbedBuilder()
        .setTitle('💡 Nyt Forslag')
        .setDescription(content)
        .setColor(color)
        .addFields(
          { name: '👍 Upvotes', value: '0', inline: true },
          { name: '👎 Downvotes', value: '0', inline: true },
          { name: '📊 Status', value: 'Afventer', inline: true },
        )
        .setFooter({ text: `Forslag #${suggestion.id.slice(0, 8)}` })
        .setTimestamp();

      if (!settings.anonymous_mode) {
        embed.setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ size: 32 }),
        });
      }

      // Build vote buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`suggestion_upvote_${suggestion.id}`)
          .setLabel('👍 Upvote')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`suggestion_downvote_${suggestion.id}`)
          .setLabel('👎 Downvote')
          .setStyle(ButtonStyle.Danger),
      );

      // Send the embed
      const sent = await message.channel.send({ embeds: [embed], components: [row] });

      // Update suggestion with message_id
      await supabase
        .from('suggestions')
        .update({ message_id: sent.id })
        .eq('id', suggestion.id);

      console.log(`[Suggestion] ✅ Created suggestion from ${message.author.username}: "${content.slice(0, 50)}"`);
    } catch (err) {
      console.error('[Suggestion] Message handler error:', err.message);
    }
  });

  // ── Handle vote button interactions ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('suggestion_')) return;
    if (shouldHandleGuild && interaction.guild && !shouldHandleGuild(interaction.guild.id)) return;

    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'upvote' or 'downvote'
    const suggestionId = parts[2];
    if (!action || !suggestionId || (action !== 'upvote' && action !== 'downvote')) return;

    try {
      const { data: suggestion, error } = await supabase
        .from('suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (error || !suggestion) {
        return interaction.reply({ content: '❌ Forslag ikke fundet.', flags: 64 });
      }

      const userId = interaction.user.id;
      const upvoters = suggestion.upvoters || [];
      const downvoters = suggestion.downvoters || [];

      // Check if user already voted in this direction
      if (action === 'upvote' && upvoters.includes(userId)) {
        return interaction.reply({ content: '❌ Du har allerede upvoted dette forslag.', flags: 64 });
      }
      if (action === 'downvote' && downvoters.includes(userId)) {
        return interaction.reply({ content: '❌ Du har allerede downvoted dette forslag.', flags: 64 });
      }

      // Remove from opposite vote list if switching vote
      const updates = {};
      let newUpvoters = [...upvoters];
      let newDownvoters = [...downvoters];

      if (action === 'upvote') {
        newDownvoters = newDownvoters.filter(id => id !== userId);
        newUpvoters.push(userId);
      } else {
        newUpvoters = newUpvoters.filter(id => id !== userId);
        newDownvoters.push(userId);
      }

      updates.upvoters = newUpvoters;
      updates.downvoters = newDownvoters;
      updates.upvotes = newUpvoters.length;
      updates.downvotes = newDownvoters.length;

      await supabase.from('suggestions').update(updates).eq('id', suggestionId);

      // Update the embed with new vote counts
      const embed = interaction.message.embeds[0];
      if (embed) {
        const statusText = suggestion.status === 'approved' ? '✅ Godkendt' :
                          suggestion.status === 'denied' ? '❌ Afvist' : 'Afventer';
        const updatedEmbed = EmbedBuilder.from(embed).setFields(
          { name: '👍 Upvotes', value: `${updates.upvotes}`, inline: true },
          { name: '👎 Downvotes', value: `${updates.downvotes}`, inline: true },
          { name: '📊 Status', value: statusText, inline: true },
        );
        await interaction.update({ embeds: [updatedEmbed] });
      } else {
        await interaction.reply({ content: '✅ Din stemme er registreret!', flags: 64 });
      }
    } catch (err) {
      console.error('[Suggestion] Vote error:', err.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Der opstod en fejl.', flags: 64 });
      }
    }
  });

  // ── Realtime: listen for status updates from dashboard (default bot only) ──
  let realtimeSub = null;
  if (!isCustomBot) {
    realtimeSub = createRealtimeSubscription(supabase, 'suggestions-realtime', [{
      filter: { event: 'UPDATE', schema: 'public', table: 'suggestions' },
      callback: async (payload) => {
        const suggestion = payload.new;
        const old = payload.old;

        if (!suggestion || suggestion.status === old?.status) return;
        if (!suggestion.message_id || !suggestion.channel_id) return;

        try {
          const { data: guildRow } = await supabase
            .from('guilds')
            .select('guild_id')
            .eq('id', suggestion.guild_id)
            .single();

          if (!guildRow) return;
          if (shouldHandleGuild && !shouldHandleGuild(guildRow.guild_id)) return;

          const guild = client.guilds.cache.get(guildRow.guild_id);
          if (!guild) return;

          const discordChannel = await guild.channels.fetch(suggestion.channel_id).catch(() => null);
          if (!discordChannel) return;

          const msg = await discordChannel.messages.fetch(suggestion.message_id).catch(() => null);
          if (!msg) return;

          const embed = msg.embeds[0];
          if (!embed) return;

          const statusText = suggestion.status === 'approved' ? '✅ Godkendt' :
                            suggestion.status === 'denied' ? '❌ Afvist' : 'Afventer';

          const updatedEmbed = EmbedBuilder.from(embed).setFields(
            { name: '👍 Upvotes', value: `${suggestion.upvotes || 0}`, inline: true },
            { name: '👎 Downvotes', value: `${suggestion.downvotes || 0}`, inline: true },
            { name: '📊 Status', value: statusText, inline: true },
          );

          if (suggestion.status === 'approved') updatedEmbed.setColor(0x57F287);
          if (suggestion.status === 'denied') updatedEmbed.setColor(0xED4245);

          await msg.edit({ embeds: [updatedEmbed] });
          console.log(`[Suggestion] ✅ Updated suggestion status to ${suggestion.status}`);
        } catch (err) {
          console.error('[Suggestion] Realtime update error:', err.message);
        }
      }
    }], { label: 'Suggestions' });
  }

  console.log('✅ Suggestion handler loaded');

  return {
    destroy: () => {
      if (realtimeSub) realtimeSub.destroy();
    },
  };
}

module.exports = { setupSuggestionHandler };
