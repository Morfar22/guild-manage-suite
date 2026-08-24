/**
 * Game Commands Handler
 *
 * fun:     trivia, ttt (tic-tac-toe), connect4, hangman, wordle
 * economy: blackjack
 *
 * All games are self-contained: they use message component collectors on their
 * own reply, so no global button routing is required.
 *
 * Usage in bot.js:
 *   const { createGameHandlers } = require('./handlers/gameCommands');
 *   Object.assign(handlers, createGameHandlers(client, { supabase }));
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BRAND = '#6366F1';

// One active game per channel/user where relevant
const activeGames = new Set();

function gameKey(interaction, name) {
  return `${name}:${interaction.channel.id}:${interaction.user.id}`;
}

// ==================== DATA ====================

const TRIVIA = [
  { q: 'Hvad er hovedstaden i Australien?', a: 'Canberra', options: ['Sydney', 'Canberra', 'Melbourne', 'Perth'] },
  { q: 'Hvor mange knogler har et voksent menneske?', a: '206', options: ['198', '206', '215', '187'] },
  { q: 'Hvilket grundstof har symbolet "Au"?', a: 'Guld', options: ['Sølv', 'Aluminium', 'Guld', 'Kobber'] },
  { q: 'Hvilket år faldt Berlinmuren?', a: '1989', options: ['1987', '1989', '1991', '1985'] },
  { q: 'Hvad hedder Danmarks længste å?', a: 'Gudenåen', options: ['Skjern Å', 'Gudenåen', 'Storåen', 'Suså'] },
  { q: 'Hvor mange spillere er der på et fodboldhold på banen?', a: '11', options: ['9', '10', '11', '12'] },
  { q: 'Hvilken planet er tættest på Solen?', a: 'Merkur', options: ['Venus', 'Mars', 'Merkur', 'Jorden'] },
  { q: 'Hvem malede "Mona Lisa"?', a: 'Leonardo da Vinci', options: ['Michelangelo', 'Leonardo da Vinci', 'Rafael', 'Donatello'] },
  { q: 'Hvad er det største hav på Jorden?', a: 'Stillehavet', options: ['Atlanterhavet', 'Det Indiske Ocean', 'Stillehavet', 'Det Arktiske Ocean'] },
  { q: 'Hvor mange sider har en dodekaeder-terning?', a: '12', options: ['10', '12', '20', '8'] },
  { q: 'Hvilket sprog har flest modersmålstalende?', a: 'Mandarin', options: ['Engelsk', 'Spansk', 'Mandarin', 'Hindi'] },
  { q: 'Hvem skrev "Den lille havfrue"?', a: 'H.C. Andersen', options: ['Astrid Lindgren', 'H.C. Andersen', 'Brødrene Grimm', 'Karen Blixen'] },
  { q: 'Hvad er kemisk formel for vand?', a: 'H2O', options: ['CO2', 'H2O', 'O2', 'NaCl'] },
  { q: 'Hvilket land vandt VM i fodbold i 2018?', a: 'Frankrig', options: ['Tyskland', 'Brasilien', 'Frankrig', 'Kroatien'] },
  { q: 'Hvor mange minutter er der i et døgn?', a: '1440', options: ['1200', '1440', '1600', '2400'] },
];

const WORDS_HANGMAN = [
  'computer', 'discord', 'kaffemaskine', 'fodbold', 'programmering', 'danmark', 'elefant',
  'sommerfugl', 'kalender', 'guitar', 'vandmelon', 'astronaut', 'bibliotek', 'chokolade',
  'jordskælv', 'lommelygte', 'regnbue', 'skovtur', 'telefon', 'vinter',
];

const WORDS_WORDLE = [
  'huset', 'stole', 'plade', 'bilen', 'grine', 'skovl', 'rejse', 'kaffe', 'mus1k'.replace('1', 'i'),
  'vinde', 'blade', 'stien', 'kroge', 'ramme', 'lampe', 'sofae'.slice(0, 5), 'brand', 'slange',
].filter((w) => w.length === 5);

const HANGMAN_STAGES = [
  '```\n      \n      \n      \n      \n=========```',
  '```\n  +---+\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n  |   |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|   |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n /    |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n=========```',
];

// ==================== FACTORY ====================

function createGameHandlers(client, { supabase } = {}) {
  async function getGuildUuid(interaction) {
    const { data } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).maybeSingle();
    return data?.id || null;
  }

  async function getEconomy(interaction) {
    const guildUuid = await getGuildUuid(interaction);
    if (!guildUuid) return null;
    const { data: settings } = await supabase
      .from('economy_settings').select('*').eq('guild_id', guildUuid).maybeSingle();
    let { data: account } = await supabase
      .from('economy_accounts').select('*')
      .eq('guild_id', guildUuid).eq('user_id', interaction.user.id).maybeSingle();
    if (!account) {
      const { data: created } = await supabase
        .from('economy_accounts')
        .insert({
          guild_id: guildUuid,
          user_id: interaction.user.id,
          discord_username: interaction.user.tag,
          wallet: settings?.starting_balance || 0,
        })
        .select()
        .single();
      account = created;
    }
    return { guildUuid, account, symbol: settings?.currency_symbol || '🪙' };
  }

  async function settleBet(eco, delta, description) {
    const newWallet = Math.max(0, (eco.account.wallet || 0) + delta);
    await supabase.from('economy_accounts').update({ wallet: newWallet }).eq('id', eco.account.id);
    await supabase.from('economy_transactions').insert({
      guild_id: eco.guildUuid,
      to_user_id: delta > 0 ? eco.account.user_id : null,
      from_user_id: delta < 0 ? eco.account.user_id : null,
      amount: Math.abs(delta),
      transaction_type: 'gambling',
      description,
    });
    return newWallet;
  }

  return {
    // ==================== TRIVIA ====================
    trivia: async (interaction) => {
      const question = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
      const options = [...question.options].sort(() => Math.random() - 0.5);

      const row = new ActionRowBuilder().addComponents(
        options.map((opt, i) =>
          new ButtonBuilder().setCustomId(`trivia_${i}`).setLabel(opt.slice(0, 70)).setStyle(ButtonStyle.Secondary),
        ),
      );

      const embed = new EmbedBuilder()
        .setColor(BRAND)
        .setTitle('🧠 Trivia')
        .setDescription(`**${question.q}**`)
        .setFooter({ text: 'Du har 20 sekunder' });

      const reply = await interaction.reply({ embeds: [embed], components: [row], withResponse: true }).catch(() => null);
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({ time: 20000, max: 1 });
      let answered = false;

      collector.on('collect', async (btn) => {
        answered = true;
        const chosen = options[Number(btn.customId.split('_')[1])];
        const correct = chosen === question.a;
        await btn.update({
          embeds: [
            EmbedBuilder.from(embed)
              .setColor(correct ? '#22C55E' : '#EF4444')
              .setDescription(
                `**${question.q}**\n\n${correct ? '✅' : '❌'} ${btn.user} svarede **${chosen}**\nRigtigt svar: **${question.a}**`,
              )
              .setFooter({ text: correct ? 'Korrekt!' : 'Bedre held næste gang' }),
          ],
          components: [],
        });
      });

      collector.on('end', async () => {
        if (answered) return;
        await message
          .edit({
            embeds: [
              EmbedBuilder.from(embed)
                .setColor('#94A3B8')
                .setDescription(`**${question.q}**\n\n⏰ Tiden er udløbet!\nRigtigt svar: **${question.a}**`)
                .setFooter({ text: 'Ingen svarede' }),
            ],
            components: [],
          })
          .catch(() => {});
      });

      void reply;
    },

    // ==================== TIC TAC TOE ====================
    ttt: async (interaction) => {
      const opponent = interaction.options.getUser('opponent');
      if (!opponent || opponent.bot || opponent.id === interaction.user.id) {
        return interaction.reply({ content: '❌ Vælg en anden (ikke-bot) spiller.', flags: 64 });
      }

      const board = Array(9).fill(null);
      const players = [interaction.user, opponent];
      let turn = 0;

      const marks = ['❌', '⭕'];
      const render = () => {
        const rows = [];
        for (let r = 0; r < 3; r++) {
          const row = new ActionRowBuilder();
          for (let c = 0; c < 3; c++) {
            const i = r * 3 + c;
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`ttt_${i}`)
                .setLabel(board[i] === null ? '\u200b' : marks[board[i]])
                .setStyle(board[i] === null ? ButtonStyle.Secondary : board[i] === 0 ? ButtonStyle.Danger : ButtonStyle.Primary)
                .setDisabled(board[i] !== null),
            );
          }
          rows.push(row);
        }
        return rows;
      };

      const winner = () => {
        const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        for (const [a, b, c] of lines) {
          if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) return board[a];
        }
        return null;
      };

      const embed = () =>
        new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('⭕ Kryds og bolle')
          .setDescription(`${marks[0]} ${players[0]} vs ${marks[1]} ${players[1]}\n\n**Tur:** ${players[turn]}`);

      await interaction.reply({ embeds: [embed()], components: render() });
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({ time: 180000 });

      collector.on('collect', async (btn) => {
        if (btn.user.id !== players[turn].id) {
          return btn.reply({ content: '⏳ Det er ikke din tur.', flags: 64 });
        }
        const idx = Number(btn.customId.split('_')[1]);
        if (board[idx] !== null) return btn.deferUpdate();
        board[idx] = turn;

        const win = winner();
        const full = board.every((c) => c !== null);

        if (win !== null || full) {
          collector.stop();
          const done = new EmbedBuilder()
            .setColor(win !== null ? '#22C55E' : '#94A3B8')
            .setTitle('⭕ Kryds og bolle')
            .setDescription(win !== null ? `🏆 ${players[win]} vandt!` : '🤝 Uafgjort!');
          return btn.update({
            embeds: [done],
            components: render().map((r) => {
              r.components.forEach((c) => c.setDisabled(true));
              return r;
            }),
          });
        }

        turn = 1 - turn;
        await btn.update({ embeds: [embed()], components: render() });
      });

      collector.on('end', async (_c, reason) => {
        if (reason === 'time') {
          await message.edit({ content: '⏰ Spillet udløb.', components: [] }).catch(() => {});
        }
      });
    },

    // ==================== CONNECT 4 ====================
    connect4: async (interaction) => {
      const opponent = interaction.options.getUser('opponent');
      if (!opponent || opponent.bot || opponent.id === interaction.user.id) {
        return interaction.reply({ content: '❌ Vælg en anden (ikke-bot) spiller.', flags: 64 });
      }

      const COLS = 7;
      const ROWS = 6;
      const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      const players = [interaction.user, opponent];
      const discs = ['🔴', '🟡'];
      let turn = 0;

      const renderBoard = () =>
        board.map((row) => row.map((cell) => (cell === null ? '⚪' : discs[cell])).join('')).join('\n') +
        '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';

      const rows = () => {
        const out = [];
        for (let chunk = 0; chunk < 2; chunk++) {
          const row = new ActionRowBuilder();
          for (let c = chunk * 4; c < Math.min(COLS, chunk * 4 + 4); c++) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`c4_${c}`)
                .setLabel(String(c + 1))
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(board[0][c] !== null),
            );
          }
          out.push(row);
        }
        return out;
      };

      const drop = (col) => {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r][col] === null) {
            board[r][col] = turn;
            return { r, c: col };
          }
        }
        return null;
      };

      const wins = (r, c, p) => {
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        return dirs.some(([dr, dc]) => {
          let count = 1;
          for (const sign of [1, -1]) {
            let rr = r + dr * sign;
            let cc = c + dc * sign;
            while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === p) {
              count++;
              rr += dr * sign;
              cc += dc * sign;
            }
          }
          return count >= 4;
        });
      };

      const embed = () =>
        new EmbedBuilder()
          .setColor(BRAND)
          .setTitle('🔴 Fire på stribe')
          .setDescription(`${renderBoard()}\n\n${discs[0]} ${players[0]} vs ${discs[1]} ${players[1]}\n**Tur:** ${players[turn]}`);

      await interaction.reply({ embeds: [embed()], components: rows() });
      const message = await interaction.fetchReply();
      const collector = message.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async (btn) => {
        if (btn.user.id !== players[turn].id) {
          return btn.reply({ content: '⏳ Det er ikke din tur.', flags: 64 });
        }
        const col = Number(btn.customId.split('_')[1]);
        const placed = drop(col);
        if (!placed) return btn.deferUpdate();

        if (wins(placed.r, placed.c, turn)) {
          collector.stop();
          return btn.update({
            embeds: [
              new EmbedBuilder()
                .setColor('#22C55E')
                .setTitle('🔴 Fire på stribe')
                .setDescription(`${renderBoard()}\n\n🏆 ${players[turn]} vandt!`),
            ],
            components: [],
          });
        }

        if (board.every((row) => row.every((cell) => cell !== null))) {
          collector.stop();
          return btn.update({
            embeds: [
              new EmbedBuilder().setColor('#94A3B8').setTitle('🔴 Fire på stribe').setDescription(`${renderBoard()}\n\n🤝 Uafgjort!`),
            ],
            components: [],
          });
        }

        turn = 1 - turn;
        await btn.update({ embeds: [embed()], components: rows() });
      });

      collector.on('end', async (_c, reason) => {
        if (reason === 'time') await message.edit({ components: [] }).catch(() => {});
      });
    },

    // ==================== HANGMAN ====================
    hangman: async (interaction) => {
      const key = gameKey(interaction, 'hangman');
      if (activeGames.has(key)) {
        return interaction.reply({ content: '⚠️ Du har allerede et galgeleg i gang her.', flags: 64 });
      }
      activeGames.add(key);

      const word = WORDS_HANGMAN[Math.floor(Math.random() * WORDS_HANGMAN.length)];
      const guessed = new Set();
      let wrong = 0;

      const masked = () =>
        word
          .split('')
          .map((c) => (guessed.has(c) ? c : '\\_'))
          .join(' ');

      const embed = (color = BRAND, extra = '') =>
        new EmbedBuilder()
          .setColor(color)
          .setTitle('🪢 Galgeleg')
          .setDescription(`${HANGMAN_STAGES[wrong]}\n**${masked()}**\n\n${extra}`)
          .addFields(
            { name: 'Gættede bogstaver', value: [...guessed].join(', ') || '_ingen_', inline: true },
            { name: 'Fejl', value: `${wrong}/${HANGMAN_STAGES.length - 1}`, inline: true },
          )
          .setFooter({ text: 'Skriv ét bogstav i chatten — eller hele ordet' });

      await interaction.reply({ embeds: [embed()] });

      const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id && m.content.length > 0,
        time: 300000,
      });

      collector.on('collect', async (msg) => {
        const guess = msg.content.trim().toLowerCase();

        if (guess.length > 1) {
          if (guess === word) {
            collector.stop('won');
            word.split('').forEach((c) => guessed.add(c));
            return interaction.followUp({ embeds: [embed('#22C55E', `🎉 ${msg.author} gættede ordet **${word}**!`)] });
          }
          wrong++;
        } else if (/^[a-zæøå]$/.test(guess)) {
          if (guessed.has(guess)) return;
          guessed.add(guess);
          if (!word.includes(guess)) wrong++;
        } else {
          return;
        }

        if (wrong >= HANGMAN_STAGES.length - 1) {
          collector.stop('lost');
          return interaction.followUp({ embeds: [embed('#EF4444', `💀 Du tabte! Ordet var **${word}**.`)] });
        }
        if (word.split('').every((c) => guessed.has(c))) {
          collector.stop('won');
          return interaction.followUp({ embeds: [embed('#22C55E', `🎉 Du gættede ordet **${word}**!`)] });
        }
        await interaction.followUp({ embeds: [embed()] });
      });

      collector.on('end', async (_c, reason) => {
        activeGames.delete(key);
        if (reason === 'time') {
          await interaction.followUp({ content: `⏰ Tiden er udløbet. Ordet var **${word}**.` }).catch(() => {});
        }
      });
    },

    // ==================== WORDLE ====================
    wordle: async (interaction) => {
      const key = gameKey(interaction, 'wordle');
      if (activeGames.has(key)) {
        return interaction.reply({ content: '⚠️ Du har allerede et wordle i gang her.', flags: 64 });
      }
      activeGames.add(key);

      const word = WORDS_WORDLE[Math.floor(Math.random() * WORDS_WORDLE.length)];
      const guesses = [];
      const MAX = 6;

      const score = (guess) => {
        const result = Array(5).fill('⬛');
        const remaining = word.split('');
        guess.split('').forEach((c, i) => {
          if (c === word[i]) {
            result[i] = '🟩';
            remaining[i] = null;
          }
        });
        guess.split('').forEach((c, i) => {
          if (result[i] === '🟩') return;
          const idx = remaining.indexOf(c);
          if (idx !== -1) {
            result[i] = '🟨';
            remaining[idx] = null;
          }
        });
        return result.join('');
      };

      const embed = (color = BRAND, extra = '') =>
        new EmbedBuilder()
          .setColor(color)
          .setTitle('🟩 Wordle')
          .setDescription(
            (guesses.map((g) => `${g.marks}  \`${g.word.toUpperCase()}\``).join('\n') || '_Ingen gæt endnu_') +
              `\n\nForsøg: ${guesses.length}/${MAX}${extra ? `\n\n${extra}` : ''}`,
          )
          .setFooter({ text: 'Skriv et dansk ord på 5 bogstaver i chatten' });

      await interaction.reply({ embeds: [embed()] });

      const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id,
        time: 300000,
      });

      collector.on('collect', async (msg) => {
        const guess = msg.content.trim().toLowerCase();
        if (!/^[a-zæøå]{5}$/.test(guess)) return;

        guesses.push({ word: guess, marks: score(guess) });

        if (guess === word) {
          collector.stop('won');
          return interaction.followUp({ embeds: [embed('#22C55E', `🎉 Korrekt! Ordet var **${word}** — klaret på ${guesses.length} forsøg.`)] });
        }
        if (guesses.length >= MAX) {
          collector.stop('lost');
          return interaction.followUp({ embeds: [embed('#EF4444', `💀 Ingen flere forsøg. Ordet var **${word}**.`)] });
        }
        await interaction.followUp({ embeds: [embed()] });
      });

      collector.on('end', async (_c, reason) => {
        activeGames.delete(key);
        if (reason === 'time') {
          await interaction.followUp({ content: `⏰ Tiden er udløbet. Ordet var **${word}**.` }).catch(() => {});
        }
      });
    },

    // ==================== BLACKJACK ====================
    blackjack: async (interaction) => {
      const bet = interaction.options.getInteger('bet') || 0;
      await interaction.deferReply();

      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Serveren er ikke registreret.');
      if (bet < 0) return interaction.editReply('❌ Indsatsen kan ikke være negativ.');
      if (bet > (eco.account.wallet || 0)) {
        return interaction.editReply(`❌ Du har kun ${eco.symbol} ${eco.account.wallet || 0} i din pung.`);
      }

      const deck = [];
      const suits = ['♠️', '♥️', '♦️', '♣️'];
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      for (const s of suits) for (const r of ranks) deck.push({ r, s });
      deck.sort(() => Math.random() - 0.5);

      const total = (hand) => {
        let sum = 0;
        let aces = 0;
        for (const c of hand) {
          if (c.r === 'A') { aces++; sum += 11; }
          else if (['J', 'Q', 'K'].includes(c.r)) sum += 10;
          else sum += Number(c.r);
        }
        while (sum > 21 && aces > 0) { sum -= 10; aces--; }
        return sum;
      };
      const show = (hand, hide = false) =>
        hand.map((c, i) => (hide && i === 1 ? '`??`' : `\`${c.r}${c.s}\``)).join(' ');

      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];
      let finished = false;

      const embed = (hideDealer = true, result = null, color = BRAND) =>
        new EmbedBuilder()
          .setColor(color)
          .setTitle('🃏 Blackjack')
          .addFields(
            { name: `${interaction.user.username} (${total(playerHand)})`, value: show(playerHand), inline: false },
            {
              name: `Dealer (${hideDealer ? '?' : total(dealerHand)})`,
              value: show(dealerHand, hideDealer),
              inline: false,
            },
          )
          .setDescription(bet > 0 ? `Indsats: ${eco.symbol} **${bet}**` : 'Venskabelig omgang (ingen indsats)')
          .setFooter({ text: result || 'Hit eller Stand?' });

      const controls = (disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(disabled),
          new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
        );

      const finish = async (target, outcome) => {
        finished = true;
        let delta = 0;
        let color = '#94A3B8';
        let text;
        if (outcome === 'win') { delta = bet; color = '#22C55E'; text = `🎉 Du vandt ${eco.symbol} ${bet}!`; }
        else if (outcome === 'blackjack') { delta = Math.floor(bet * 1.5); color = '#22C55E'; text = `🃏 Blackjack! Du vandt ${eco.symbol} ${delta}!`; }
        else if (outcome === 'lose') { delta = -bet; color = '#EF4444'; text = `💥 Du tabte ${eco.symbol} ${bet}.`; }
        else { text = '🤝 Uafgjort — din indsats returneres.'; }

        let wallet = eco.account.wallet || 0;
        if (bet > 0 && delta !== 0) wallet = await settleBet(eco, delta, `Blackjack: ${outcome}`);

        await target.update({
          embeds: [embed(false, `${text}${bet > 0 ? ` · Saldo: ${eco.symbol} ${wallet}` : ''}`, color)],
          components: [controls(true)],
        });
      };

      await interaction.editReply({ embeds: [embed()], components: [controls()] });
      const message = await interaction.fetchReply();

      // Instant blackjack
      if (total(playerHand) === 21) {
        const fake = { update: (payload) => message.edit(payload) };
        await finish(fake, total(dealerHand) === 21 ? 'push' : 'blackjack');
        return;
      }

      const collector = message.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async (btn) => {
        if (btn.user.id !== interaction.user.id) {
          return btn.reply({ content: '❌ Det er ikke dit spil.', flags: 64 });
        }
        if (finished) return btn.deferUpdate();

        if (btn.customId === 'bj_hit') {
          playerHand.push(deck.pop());
          if (total(playerHand) > 21) {
            collector.stop();
            return finish(btn, 'lose');
          }
          if (total(playerHand) === 21) {
            collector.stop();
            while (total(dealerHand) < 17) dealerHand.push(deck.pop());
            const d = total(dealerHand);
            return finish(btn, d > 21 || d < 21 ? 'win' : 'push');
          }
          return btn.update({ embeds: [embed()], components: [controls()] });
        }

        // Stand
        collector.stop();
        while (total(dealerHand) < 17) dealerHand.push(deck.pop());
        const p = total(playerHand);
        const d = total(dealerHand);
        const outcome = d > 21 || p > d ? 'win' : p === d ? 'push' : 'lose';
        return finish(btn, outcome);
      });

      collector.on('end', async () => {
        if (!finished) {
          await message.edit({ components: [controls(true)] }).catch(() => {});
        }
      });
    },
  };
}

module.exports = { createGameHandlers };
