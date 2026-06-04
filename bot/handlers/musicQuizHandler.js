/**
 * Music Quiz Handler
 *
 * Text-based music quiz game in a designated channel.
 * - Bot posts hints (artist/lyrics/scrambled title) one at a time
 * - Users guess the song title in chat
 * - Score tracked per guild in music_quiz_scores
 * - Controlled via /musicquiz start | stop | leaderboard | skip
 */

const { EmbedBuilder } = require('discord.js');
const { createRealtimeSubscription } = require('../realtimeRetry');

const settingsCache = new Map();
const CACHE_TTL = 300_000;

// guildDiscordId -> active game state
const activeGames = new Map();

function setupMusicQuizHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;

  // ---------- helpers ----------
  async function getGuildRow(guildDiscordId) {
    const { data } = await supabase
      .from('guilds').select('id').eq('guild_id', guildDiscordId).single();
    return data || null;
  }

  async function getSettings(guildDiscordId) {
    const cached = settingsCache.get(guildDiscordId);
    if (cached && Date.now() - cached._ts < CACHE_TTL) return cached.data;

    const guild = await getGuildRow(guildDiscordId);
    if (!guild) return null;

    const { data } = await supabase
      .from('music_quiz_settings').select('*').eq('guild_id', guild.id).maybeSingle();

    const result = data && data.enabled ? { ...data, _guildUuid: guild.id } : null;
    // Only cache positive results — never cache "not enabled" so users see changes immediately
    if (result) {
      settingsCache.set(guildDiscordId, { data: result, _ts: Date.now() });
    } else {
      settingsCache.delete(guildDiscordId);
    }
    return result;
  }

  function invalidateCache(guildDiscordId) {
    settingsCache.delete(guildDiscordId);
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9æøå ]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    // simple Jaccard on words
    const wa = new Set(a.split(' '));
    const wb = new Set(b.split(' '));
    const inter = [...wa].filter(w => wb.has(w)).length;
    const union = new Set([...wa, ...wb]).size;
    return union ? inter / union : 0;
  }

  function scrambleTitle(title) {
    return title.replace(/[a-zæøåA-ZÆØÅ0-9]/g, (c) => /\s/.test(c) ? c : '▮');
  }

  async function pickSong(guildUuid) {
    const { data } = await supabase
      .from('music_quiz_songs')
      .select('*')
      .or(`guild_id.eq.${guildUuid},guild_id.is.null`)
      .limit(500);
    if (!data || data.length === 0) return null;
    return data[Math.floor(Math.random() * data.length)];
  }

  async function awardPoints(guildUuid, userId, username, points, won) {
    // Try update first
    const { data: existing } = await supabase
      .from('music_quiz_scores')
      .select('id, points, rounds_won, rounds_played')
      .eq('guild_id', guildUuid).eq('user_id', userId).maybeSingle();

    if (existing) {
      await supabase.from('music_quiz_scores').update({
        username,
        points: existing.points + points,
        rounds_won: existing.rounds_won + (won ? 1 : 0),
        rounds_played: existing.rounds_played + 1,
        last_played_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('music_quiz_scores').insert({
        guild_id: guildUuid, user_id: userId, username,
        points, rounds_won: won ? 1 : 0, rounds_played: 1,
        last_played_at: new Date().toISOString(),
      });
    }
  }

  // ---------- game loop ----------
  async function runRound(game) {
    if (!game.active) return;
    const channel = game.channel;
    const song = await pickSong(game.guildUuid);
    if (!song) {
      await channel.send('❌ Ingen sange i pulje. Tilføj sange først.').catch(() => {});
      return endGame(game.guildDiscordId, 'no_songs');
    }

    game.currentSong = song;
    game.roundAnswered = false;
    game.roundNumber += 1;

    const hints = [
      `🎤 **Kunstner:** ${song.artist}`,
      song.lyrics_snippet ? `📜 *"${song.lyrics_snippet}"*` : null,
      `🔤 **Titel-mønster:** \`${scrambleTitle(song.title)}\` (${song.title.replace(/\s/g,'').length} bogstaver)`,
      ...(Array.isArray(song.hints) ? song.hints.map(h => `💡 ${h}`) : []),
    ].filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🎵 Runde ${game.roundNumber}/${game.totalRounds}`)
      .setDescription(hints[0])
      .setFooter({ text: `Du har ${game.timePerRound}s. Skriv titlen i chatten!` });
    await channel.send({ embeds: [embed] }).catch(() => {});

    // Reveal additional hints over time
    let hintIdx = 1;
    const hintInterval = Math.max(5000, Math.floor((game.timePerRound * 1000) / Math.max(hints.length, 1)));
    game.hintTimer = setInterval(async () => {
      if (!game.active || game.roundAnswered || hintIdx >= hints.length) {
        clearInterval(game.hintTimer); game.hintTimer = null; return;
      }
      await channel.send(hints[hintIdx]).catch(() => {});
      hintIdx += 1;
    }, hintInterval);

    // End-of-round timeout
    game.roundTimer = setTimeout(async () => {
      if (game.hintTimer) { clearInterval(game.hintTimer); game.hintTimer = null; }
      if (!game.active) return;
      if (!game.roundAnswered) {
        await channel.send(`⏰ Tiden er gået! Svaret var: **${song.title}** — *${song.artist}*`).catch(() => {});
      }
      if (game.roundNumber >= game.totalRounds) {
        return endGame(game.guildDiscordId, 'completed');
      }
      setTimeout(() => runRound(game), 3000);
    }, game.timePerRound * 1000);
  }

  async function startGame(guildDiscordId, channel, guildUuid, settings) {
    if (activeGames.has(guildDiscordId)) {
      return { ok: false, error: 'Et spil kører allerede her.' };
    }
    const game = {
      active: true,
      guildDiscordId,
      guildUuid,
      channel,
      totalRounds: settings.rounds || 10,
      timePerRound: settings.time_per_round || 30,
      roundNumber: 0,
      currentSong: null,
      roundAnswered: false,
      hintTimer: null,
      roundTimer: null,
      sessionScores: new Map(), // userId -> { username, points }
    };
    activeGames.set(guildDiscordId, game);
    await channel.send(`🎶 **Musik Quiz starter!** ${game.totalRounds} runder · ${game.timePerRound}s per runde.`).catch(() => {});
    setTimeout(() => runRound(game), 2500);
    return { ok: true };
  }

  async function endGame(guildDiscordId, reason = 'manual') {
    const game = activeGames.get(guildDiscordId);
    if (!game) return;
    game.active = false;
    if (game.hintTimer) clearInterval(game.hintTimer);
    if (game.roundTimer) clearTimeout(game.roundTimer);
    activeGames.delete(guildDiscordId);

    const scores = [...game.sessionScores.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.points - a.points);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🏁 Quiz slut!')
      .setDescription(reason === 'no_songs'
        ? 'Ingen sange i puljen.'
        : (scores.length === 0
            ? 'Ingen rigtige svar denne gang.'
            : scores.slice(0, 10).map((s, i) =>
                `**${i + 1}.** <@${s.userId}> — **${s.points}** point`).join('\n')));
    await game.channel.send({ embeds: [embed] }).catch(() => {});
  }

  function skipRound(guildDiscordId) {
    const game = activeGames.get(guildDiscordId);
    if (!game || !game.active) return false;
    if (game.hintTimer) clearInterval(game.hintTimer);
    if (game.roundTimer) clearTimeout(game.roundTimer);
    game.channel.send(`⏭️ Runde sprunget over. Svaret var: **${game.currentSong?.title}** — *${game.currentSong?.artist}*`).catch(() => {});
    if (game.roundNumber >= game.totalRounds) {
      endGame(guildDiscordId, 'completed');
    } else {
      setTimeout(() => runRound(game), 2000);
    }
    return true;
  }

  // ---------- message listener (guesses) ----------
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;
      if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;

      const game = activeGames.get(message.guild.id);
      if (!game || !game.active || game.roundAnswered) return;
      if (message.channel.id !== game.channel.id) return;
      if (!game.currentSong) return;

      const sim = similarity(message.content, game.currentSong.title);
      if (sim >= 0.75) {
        game.roundAnswered = true;
        if (game.hintTimer) { clearInterval(game.hintTimer); game.hintTimer = null; }

        const points = sim === 1 ? 10 : sim >= 0.85 ? 8 : 6;
        const prev = game.sessionScores.get(message.author.id) || { username: message.author.username, points: 0 };
        prev.points += points;
        prev.username = message.author.username;
        game.sessionScores.set(message.author.id, prev);

        await awardPoints(game.guildUuid, message.author.id, message.author.username, points, true).catch(() => {});

        await message.channel.send(`✅ <@${message.author.id}> svarede rigtigt! **${game.currentSong.title}** — *${game.currentSong.artist}* (+${points} point)`).catch(() => {});
      }
    } catch (e) {
      console.error('[MusicQuiz] message error:', e.message);
    }
  });

  // ---------- slash command listener ----------
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'musicquiz') return;
      if (!interaction.guild) return;
      if (shouldHandleGuild && !shouldHandleGuild(interaction.guild.id)) return;

      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {
        const settings = await getSettings(interaction.guild.id);
        if (!settings) {
          return interaction.reply({ content: '❌ Musik Quiz er ikke aktiveret. Aktiver den i dashboardet først.', flags: 64 });
        }
        const channelId = settings.channel_id || interaction.channel.id;
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          return interaction.reply({ content: '❌ Quiz-kanalen findes ikke.', flags: 64 });
        }
        const result = await startGame(interaction.guild.id, channel, settings._guildUuid, settings);
        if (!result.ok) return interaction.reply({ content: `❌ ${result.error}`, flags: 64 });
        return interaction.reply({ content: `✅ Quiz starter i <#${channel.id}>`, flags: 64 });
      }

      if (sub === 'stop') {
        if (!activeGames.has(interaction.guild.id)) {
          return interaction.reply({ content: '❌ Ingen aktiv quiz.', flags: 64 });
        }
        await endGame(interaction.guild.id, 'manual');
        return interaction.reply({ content: '🛑 Quiz stoppet.', flags: 64 });
      }

      if (sub === 'skip') {
        const ok = skipRound(interaction.guild.id);
        return interaction.reply({ content: ok ? '⏭️ Sprunget over.' : '❌ Ingen aktiv runde.', flags: 64 });
      }

      if (sub === 'leaderboard') {
        const guild = await getGuildRow(interaction.guild.id);
        if (!guild) return interaction.reply({ content: '❌ Server ikke fundet.', flags: 64 });
        const { data } = await supabase
          .from('music_quiz_scores')
          .select('user_id, username, points, rounds_won')
          .eq('guild_id', guild.id)
          .order('points', { ascending: false })
          .limit(10);

        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('🏆 Musik Quiz Leaderboard')
          .setDescription((data && data.length)
            ? data.map((r, i) => `**${i + 1}.** <@${r.user_id}> — **${r.points}** pt · ${r.rounds_won} sejre`).join('\n')
            : 'Ingen scores endnu.');
        return interaction.reply({ embeds: [embed] });
      }
    } catch (e) {
      console.error('[MusicQuiz] interaction error:', e.message);
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ content: '❌ Fejl i quiz-kommando.', flags: 64 }).catch(() => {});
      }
    }
  });

  // Realtime: invalidate cache when settings change (with auto-retry)
  try {
    const sub = createRealtimeSubscription(supabase, 'music_quiz_settings_changes', [
      {
        filter: { event: '*', schema: 'public', table: 'music_quiz_settings' },
        callback: (payload) => {
          const guildUuid = payload.new?.guild_id || payload.old?.guild_id;
          if (!guildUuid) return;
          settingsCache.clear();
        },
      },
    ], { label: 'MusicQuizSettings' });
    if (!client._musicQuizSubs) client._musicQuizSubs = [];
    client._musicQuizSubs.push(sub);
  } catch (e) {
    console.warn('[MusicQuiz] realtime setup failed:', e.message);
  }

  console.log('[MusicQuiz] Handler initialized');
  return { getSettings, invalidateCache, endGame, startGame };
}

module.exports = { setupMusicQuizHandler };
