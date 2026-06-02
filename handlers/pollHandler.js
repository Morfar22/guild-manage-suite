/**
 * Poll Handler
 * 
 * Listens for new polls via Supabase Realtime and sends them to Discord.
 * Handles reaction-based voting via button interactions.
 */

const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createRealtimeSubscription } = require('./realtimeRetry');

function setupPollHandler(client, supabase, options = {}) {
  const { shouldHandleGuild, isCustomBot } = options;

  // ── Build the poll embed + buttons ──
  function buildPollMessage(poll) {
    const opts = poll.options || [];
    const description = opts.map((o, i) => `**${i + 1}.** ${o.label}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${poll.question}`)
      .setDescription(description)
      .setColor(0x5865F2)
      .setFooter({ text: poll.ends_at ? `Slutter: ${new Date(poll.ends_at).toLocaleString('da-DK')}` : 'Ingen tidsfrist' })
      .setTimestamp();

    if (poll.votes?.created_by_name) {
      embed.setAuthor({ name: `Oprettet af ${poll.votes.created_by_name}` });
    }

    // Create vote buttons (max 5 per row, max 2 rows = 10 options)
    const rows = [];
    for (let i = 0; i < opts.length; i += 5) {
      const row = new ActionRowBuilder();
      const chunk = opts.slice(i, i + 5);
      chunk.forEach((o, j) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${poll.id}_${i + j}`)
            .setLabel(o.label.slice(0, 80))
            .setStyle(ButtonStyle.Primary)
        );
      });
      rows.push(row);
    }

    return { embeds: [embed], components: rows };
  }

  // ── Send poll to Discord when inserted from dashboard ──
  async function sendPollToDiscord(poll) {
    if (!poll.channel_id) {
      console.log('[Poll] No channel_id, skipping send');
      return;
    }

    // Look up the guild's Discord ID
    const { data: guildRow } = await supabase
      .from('guilds')
      .select('guild_id')
      .eq('id', poll.guild_id)
      .single();

    if (!guildRow) {
      console.error('[Poll] Guild not found in DB:', poll.guild_id);
      return;
    }

    if (shouldHandleGuild && !shouldHandleGuild(guildRow.guild_id)) return;

    const guild = client.guilds.cache.get(guildRow.guild_id);
    if (!guild) {
      console.log('[Poll] Bot not in guild:', guildRow.guild_id);
      return;
    }

    try {
      const channel = await guild.channels.fetch(poll.channel_id);
      if (!channel || !channel.isTextBased()) {
        console.error('[Poll] Channel not found or not text-based:', poll.channel_id);
        return;
      }

      const message = await channel.send(buildPollMessage(poll));

      // Save the message_id so voting buttons reference the right message
      await supabase
        .from('polls')
        .update({ message_id: message.id })
        .eq('id', poll.id);

      console.log(`[Poll] ✅ Sent poll "${poll.question}" to #${channel.name}`);
    } catch (err) {
      console.error('[Poll] Failed to send poll:', err.message);
    }
  }

  // ── Realtime: listen for new polls (default bot only) ──
  let realtimeSub = null;
  if (!isCustomBot) {
    realtimeSub = createRealtimeSubscription(supabase, 'polls-realtime', [{
      filter: { event: 'INSERT', schema: 'public', table: 'polls' },
      callback: (payload) => {
        const poll = payload.new;
        console.log(`[Poll] New poll detected: "${poll.question}"`);
        sendPollToDiscord(poll);
      }
    }], { label: 'Polls' });
  }

  // ── Handle button interactions for voting ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('poll_vote_')) return;
    if (shouldHandleGuild && !shouldHandleGuild(interaction.guild?.id)) return;

    const parts = interaction.customId.split('_');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3]);

    try {
      const { data: poll, error } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (error || !poll || poll.ended) {
        return interaction.reply({ content: '❌ Denne afstemning er afsluttet.', ephemeral: true });
      }

      const pollOptions = poll.options;
      const userId = interaction.user.id;

      if (pollOptions[optionIndex].voters.includes(userId)) {
        return interaction.reply({ content: '❌ Du har allerede stemt på denne mulighed.', ephemeral: true });
      }

      const allowMultiple = poll.votes?.allow_multiple ?? false;
      if (!allowMultiple) {
        for (const opt of pollOptions) {
          opt.voters = opt.voters.filter(v => v !== userId);
          opt.votes = opt.voters.length;
        }
      }

      pollOptions[optionIndex].voters.push(userId);
      pollOptions[optionIndex].votes = pollOptions[optionIndex].voters.length;

      await supabase
        .from('polls')
        .update({ options: pollOptions })
        .eq('id', pollId);

      // Update the original message with new vote counts
      if (poll.message_id && interaction.message) {
        try {
          const totalVotes = pollOptions.reduce((sum, o) => sum + o.votes, 0);
          const updatedDesc = pollOptions
            .map((o, i) => {
              const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
              const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
              return `**${i + 1}.** ${o.label}\n${bar} ${pct}% (${o.votes})`;
            })
            .join('\n\n');

          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(updatedDesc);

          await interaction.message.edit({ embeds: [updatedEmbed] });
        } catch { /* ignore edit errors */ }
      }

      await interaction.reply({
        content: `✅ Du stemte på **${pollOptions[optionIndex].label}**!`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('[Poll] Vote error:', err.message);
      await interaction.reply({ content: '❌ Kunne ikke registrere din stemme.', ephemeral: true }).catch(() => {});
    }
  });

  console.log('[Poll] Handler initialized');

  return {
    destroy: () => {
      if (realtimeSub) realtimeSub.destroy();
      console.log('[Poll] Handler destroyed');
    },
  };
}

module.exports = { setupPollHandler };
