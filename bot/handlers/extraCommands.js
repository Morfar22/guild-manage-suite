/**
 * Extra Commands Handler
 *
 * Implements the commands that were listed in the dashboard but had no
 * implementation in the bot: utility, fun, economy games, leveling admin,
 * ticket/giveaway aliases and snipe.
 *
 * Usage in bot.js:
 *   const { createExtraHandlers, setupSnipeTracker } = require('./handlers/extraCommands');
 *   ...
 *   Object.assign(handlers, createExtraHandlers(client, { supabase, handlers, shopApi }));
 */

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// ==================== SNIPE CACHE ====================
// guildId:channelId -> { content, author, at, edited }
const deletedCache = new Map();
const editedCache = new Map();

function setupSnipeTracker(client, options = {}) {
  const { shouldHandleGuild } = options;

  client.on('messageDelete', (message) => {
    try {
      if (!message.guild || message.author?.bot) return;
      if (shouldHandleGuild && !shouldHandleGuild(message.guild.id)) return;
      if (!message.content) return;
      deletedCache.set(`${message.guild.id}:${message.channel.id}`, {
        content: message.content.slice(0, 1800),
        author: message.author?.tag || 'Ukendt',
        avatar: message.author?.displayAvatarURL?.() || null,
        at: Date.now(),
      });
    } catch { /* ignore */ }
  });

  client.on('messageUpdate', (oldMessage, newMessage) => {
    try {
      if (!oldMessage.guild || oldMessage.author?.bot) return;
      if (shouldHandleGuild && !shouldHandleGuild(oldMessage.guild.id)) return;
      if (!oldMessage.content || oldMessage.content === newMessage.content) return;
      editedCache.set(`${oldMessage.guild.id}:${oldMessage.channel.id}`, {
        content: oldMessage.content.slice(0, 900),
        newContent: (newMessage.content || '').slice(0, 900),
        author: oldMessage.author?.tag || 'Ukendt',
        at: Date.now(),
      });
    } catch { /* ignore */ }
  });

  console.log('[ExtraCommands] Snipe tracker initialized');
}

// ==================== HELPERS ====================

const cooldowns = new Map(); // `${key}:${guildId}:${userId}` -> timestamp

function checkCooldown(key, interaction, ms) {
  const id = `${key}:${interaction.guild.id}:${interaction.user.id}`;
  const last = cooldowns.get(id) || 0;
  const remaining = last + ms - Date.now();
  if (remaining > 0) return remaining;
  cooldowns.set(id, Date.now());
  return 0;
}

function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h ? `${h}t` : null, m ? `${m}m` : null, `${sec}s`].filter(Boolean).join(' ');
}

// Proxy that re-labels an interaction so an existing handler picks it up
function aliasInteraction(interaction, commandName, overrides = {}) {
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'commandName') return commandName;
      if (prop === 'options' && overrides.options) return overrides.options(target.options);
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const FACTS = [
  'Honning bliver aldrig dårligt — man har fundet spiselig honning i 3000 år gamle grave.',
  'En gruppe flamingoer kaldes en "flamboyance".',
  'Bananer er botanisk set bær, men jordbær er ikke.',
  'Blæksprutter har tre hjerter og blåt blod.',
  'Der er flere stjerner i universet end sandkorn på Jorden.',
  'Danmark har over 400 øer, men kun ca. 70 er beboede.',
  'Et lyn er cirka fem gange varmere end Solens overflade.',
  'Sømænd kaldte tidligere pingviner for "fede gæs".',
  'Din næse kan skelne over 1 billion forskellige dufte.',
  'Vombat-lort er firkantet.',
];

const ASCII_FONT = {
  A: ['█▀█', '█▀█'], B: ['█▄▄', '█▄█'], C: ['█▀▀', '█▄▄'], D: ['█▀▄', '█▄▀'],
  E: ['█▀▀', '██▄'], F: ['█▀▀', '█▀ '], G: ['█▀▀', '█▄█'], H: ['█ █', '█▀█'],
  I: ['█', '█'], J: [' █', '▄█'], K: ['█▄▀', '█ █'], L: ['█  ', '█▄▄'],
  M: ['█▀▄▀█', '█ ▀ █'], N: ['█▄ █', '█ ▀█'], O: ['█▀█', '█▄█'], P: ['█▀█', '█▀▀'],
  Q: ['█▀█', '▀▀█'], R: ['█▀█', '█▀▄'], S: ['█▀', '▄█'], T: ['▀█▀', ' █ '],
  U: ['█ █', '█▄█'], V: ['█ █', '▀▄▀'], W: ['█ █ █', '▀▄▀▄▀'], X: ['▀▄▀', '█ █'],
  Y: ['█▄█', ' █ '], Z: ['▀█', '█▄'], ' ': ['  ', '  '],
};

function toAscii(text) {
  const chars = text.toUpperCase().slice(0, 12).split('');
  const rows = ['', ''];
  for (const c of chars) {
    const glyph = ASCII_FONT[c] || ['?', '?'];
    rows[0] += glyph[0] + ' ';
    rows[1] += glyph[1] + ' ';
  }
  return rows.join('\n');
}

function safeMath(expression) {
  const cleaned = String(expression).replace(/[^0-9+\-*/(). %]/g, '');
  if (!cleaned.trim()) throw new Error('Tomt udtryk');
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${cleaned});`)();
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Ugyldigt resultat');
  return { cleaned, result };
}

// ==================== FACTORY ====================

function createExtraHandlers(client, { supabase, handlers, shopApi } = {}) {
  async function getGuildUuid(interaction) {
    const { data } = await supabase.from('guilds').select('id').eq('guild_id', interaction.guild.id).single();
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
      const { data: created } = await supabase.from('economy_accounts').insert({
        guild_id: guildUuid,
        user_id: interaction.user.id,
        discord_username: interaction.user.tag,
        wallet: settings?.starting_balance || 0,
      }).select().single();
      account = created;
    }
    return {
      guildUuid,
      account,
      symbol: settings?.currency_symbol || '🪙',
      name: settings?.currency_name || 'coins',
    };
  }

  async function addBalance(eco, delta, type, description) {
    const newWallet = Math.max(0, (eco.account.wallet || 0) + delta);
    await supabase.from('economy_accounts').update({
      wallet: newWallet,
      total_earned: delta > 0 ? (eco.account.total_earned || 0) + delta : eco.account.total_earned,
      discord_username: eco.account.discord_username,
    }).eq('id', eco.account.id);
    await supabase.from('economy_transactions').insert({
      guild_id: eco.guildUuid,
      to_user_id: delta > 0 ? eco.account.user_id : null,
      from_user_id: delta < 0 ? eco.account.user_id : null,
      amount: Math.abs(delta),
      transaction_type: type,
      description,
    });
    return newWallet;
  }

  function requireManageGuild(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      interaction.reply({ content: '❌ Du skal have "Administrer server" for at bruge denne kommando.', flags: 64 });
      return false;
    }
    return true;
  }

  async function updateLevel(interaction, userId, mutate) {
    const guildUuid = await getGuildUuid(interaction);
    if (!guildUuid) return null;
    const { data: existing } = await supabase.from('user_levels').select('*')
      .eq('guild_id', guildUuid).eq('user_id', userId).maybeSingle();
    const current = existing || { xp: 0, level: 0 };
    const next = mutate(current);
    const payload = {
      guild_id: guildUuid,
      user_id: userId,
      xp: Math.max(0, Math.round(next.xp)),
      level: Math.max(0, Math.round(next.level)),
    };
    if (existing) {
      await supabase.from('user_levels').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('user_levels').insert(payload);
    }
    return payload;
  }

  return {
    // ==================== UTILITY ====================

    uptime: async (interaction) => {
      const ms = client.uptime || 0;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⏱️ Bot Uptime')
        .addFields(
          { name: 'Oppetid', value: formatDuration(ms), inline: true },
          { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
          { name: 'Servere', value: `${client.guilds.cache.size}`, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    },

    stats: async (interaction) => {
      await interaction.deferReply();
      const guild = interaction.guild;
      const members = guild.memberCount;
      const bots = guild.members.cache.filter((m) => m.user.bot).size;
      const channels = guild.channels.cache;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📈 Statistik for ${guild.name}`)
        .setThumbnail(guild.iconURL() || null)
        .addFields(
          { name: 'Medlemmer', value: `${members}`, inline: true },
          { name: 'Bots (cached)', value: `${bots}`, inline: true },
          { name: 'Roller', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Tekstkanaler', value: `${channels.filter((c) => c.type === ChannelType.GuildText).size}`, inline: true },
          { name: 'Talekanaler', value: `${channels.filter((c) => c.type === ChannelType.GuildVoice).size}`, inline: true },
          { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
          { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: 'Oprettet', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    },

    invite: async (interaction) => {
      const appId = client.application?.id || client.user?.id;
      const url = `https://discord.com/oauth2/authorize?client_id=${appId}&permissions=8&scope=bot%20applications.commands`;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔗 Inviter botten')
        .setDescription(`[Klik her for at tilføje botten til din server](${url})`);
      await interaction.reply({ embeds: [embed], flags: 64 });
    },

    calculate: async (interaction) => {
      const expression = interaction.options.getString('expression');
      try {
        const { cleaned, result } = safeMath(expression);
        await interaction.reply(`🧮 \`${cleaned}\` = **${result}**`);
      } catch {
        await interaction.reply({ content: '❌ Kunne ikke beregne udtrykket. Brug kun tal og + - * / ( ).', flags: 64 });
      }
    },

    channelinfo: async (interaction) => {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`#️⃣ ${channel.name}`)
        .addFields(
          { name: 'ID', value: channel.id, inline: true },
          { name: 'Type', value: `${ChannelType[channel.type] ?? channel.type}`, inline: true },
          { name: 'Kategori', value: channel.parent?.name || 'Ingen', inline: true },
          { name: 'NSFW', value: channel.nsfw ? 'Ja' : 'Nej', inline: true },
          { name: 'Slowmode', value: `${channel.rateLimitPerUser || 0}s`, inline: true },
          { name: 'Oprettet', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (channel.topic) embed.setDescription(channel.topic.slice(0, 1000));
      await interaction.reply({ embeds: [embed] });
    },

    roleinfo: async (interaction) => {
      const role = interaction.options.getRole('role');
      const perms = role.permissions.toArray();
      const embed = new EmbedBuilder()
        .setColor(role.color || '#5865F2')
        .setTitle(`🎭 ${role.name}`)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Medlemmer', value: `${role.members.size}`, inline: true },
          { name: 'Farve', value: role.hexColor, inline: true },
          { name: 'Vises separat', value: role.hoist ? 'Ja' : 'Nej', inline: true },
          { name: 'Kan nævnes', value: role.mentionable ? 'Ja' : 'Nej', inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Rettigheder', value: (perms.length ? perms.slice(0, 15).join(', ') : 'Ingen').slice(0, 1000) },
        );
      await interaction.reply({ embeds: [embed] });
    },

    roles: async (interaction) => {
      const roles = interaction.guild.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}> — ${r.members.size}`);
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎭 Roller (${roles.length})`)
        .setDescription(roles.join('\n').slice(0, 4000) || 'Ingen roller');
      await interaction.reply({ embeds: [embed] });
    },

    members: async (interaction) => {
      await interaction.deferReply();
      const guild = interaction.guild;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('👥 Medlemmer')
        .addFields(
          { name: 'Total', value: `${guild.memberCount}`, inline: true },
          { name: 'Online (cached)', value: `${guild.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size}`, inline: true },
          { name: 'Bots (cached)', value: `${guild.members.cache.filter((m) => m.user.bot).size}`, inline: true },
        );
      await interaction.editReply({ embeds: [embed] });
    },

    emojis: async (interaction) => {
      const emojis = interaction.guild.emojis.cache.map((e) => e.toString());
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`😀 Emojis (${emojis.length})`)
        .setDescription(emojis.join(' ').slice(0, 4000) || 'Ingen emojis på denne server');
      await interaction.reply({ embeds: [embed] });
    },

    banner: async (interaction) => {
      const user = interaction.options.getUser('user') || interaction.user;
      const fetched = await client.users.fetch(user.id, { force: true });
      const url = fetched.bannerURL({ size: 1024 });
      if (!url) return interaction.reply({ content: '❌ Brugeren har ikke et banner.', flags: 64 });
      const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🖼️ Banner - ${user.tag}`).setImage(url);
      await interaction.reply({ embeds: [embed] });
    },

    snipe: async (interaction) => {
      const cached = deletedCache.get(`${interaction.guild.id}:${interaction.channel.id}`);
      if (!cached) return interaction.reply({ content: '❌ Ingen slettede beskeder at snipe her.', flags: 64 });
      const embed = new EmbedBuilder()
        .setColor('#FF7043')
        .setAuthor({ name: cached.author, iconURL: cached.avatar || undefined })
        .setDescription(cached.content)
        .setFooter({ text: 'Slettet' })
        .setTimestamp(cached.at);
      await interaction.reply({ embeds: [embed] });
    },

    editsnipe: async (interaction) => {
      const cached = editedCache.get(`${interaction.guild.id}:${interaction.channel.id}`);
      if (!cached) return interaction.reply({ content: '❌ Ingen redigerede beskeder at snipe her.', flags: 64 });
      const embed = new EmbedBuilder()
        .setColor('#FFB300')
        .setTitle(`✏️ Redigeret besked - ${cached.author}`)
        .addFields(
          { name: 'Før', value: cached.content || '*tom*' },
          { name: 'Efter', value: cached.newContent || '*tom*' },
        )
        .setTimestamp(cached.at);
      await interaction.reply({ embeds: [embed] });
    },

    embed: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color') || '#5865F2';
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const embed = new EmbedBuilder().setColor(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith('#') ? color : `#${color}`) : '#5865F2');
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
      try {
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Embed sendt til ${channel}.`, flags: 64 });
      } catch {
        await interaction.reply({ content: '❌ Kunne ikke sende embed i den kanal.', flags: 64 });
      }
    },

    announce: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const ping = interaction.options.getString('ping');
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📢 Meddelelse')
        .setDescription(message.replace(/\\n/g, '\n'))
        .setFooter({ text: `Af ${interaction.user.tag}` })
        .setTimestamp();
      const content = ping === 'everyone' ? '@everyone' : ping === 'here' ? '@here' : undefined;
      try {
        await channel.send({ content, embeds: [embed] });
        await interaction.reply({ content: `✅ Meddelelse sendt til ${channel}.`, flags: 64 });
      } catch {
        await interaction.reply({ content: '❌ Kunne ikke sende meddelelsen.', flags: 64 });
      }
    },

    quote: async (interaction) => {
      const messageId = interaction.options.getString('message_id');
      try {
        const message = await interaction.channel.messages.fetch(messageId);
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
          .setDescription(message.content || '*Ingen tekst*')
          .addFields({ name: '\u200b', value: `[Hop til besked](${message.url})` })
          .setTimestamp(message.createdTimestamp);
        await interaction.reply({ embeds: [embed] });
      } catch {
        await interaction.reply({ content: '❌ Kunne ikke finde beskeden i denne kanal.', flags: 64 });
      }
    },

    vote: async (interaction) => {
      const question = interaction.options.getString('question');
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🗳️ Afstemning')
        .setDescription(question)
        .setFooter({ text: `Startet af ${interaction.user.tag}` })
        .setTimestamp();
      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      await reply.react('👍').catch(() => {});
      await reply.react('👎').catch(() => {});
      await reply.react('🤷').catch(() => {});
    },

    // ==================== FUN ====================

    ascii: async (interaction) => {
      const text = interaction.options.getString('text');
      await interaction.reply(`\`\`\`\n${toAscii(text)}\n\`\`\``);
    },

    mock: async (interaction) => {
      const text = interaction.options.getString('text').slice(0, 1500);
      const mocked = text.split('').map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('');
      await interaction.reply(`🐔 ${mocked}`);
    },

    reverse: async (interaction) => {
      const text = interaction.options.getString('text').slice(0, 1500);
      await interaction.reply(`🔄 ${text.split('').reverse().join('')}`);
    },

    fact: async (interaction) => {
      const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle('💡 Vidste du at...')
        .setDescription(FACTS[Math.floor(Math.random() * FACTS.length)]);
      await interaction.reply({ embeds: [embed] });
    },

    // ==================== ECONOMY ====================

    shop: async (interaction) => {
      if (!shopApi?.handleShopCommand) return interaction.reply({ content: '❌ Butikken er ikke tilgængelig.', flags: 64 });
      await shopApi.handleShopCommand(interaction);
    },

    buy: async (interaction) => {
      if (!shopApi?.handleBuyCommand) return interaction.reply({ content: '❌ Butikken er ikke tilgængelig.', flags: 64 });
      await shopApi.handleBuyCommand(interaction);
    },

    inventory: async (interaction) => {
      await interaction.deferReply({ flags: 64 });
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Server ikke fundet.');
      const { data: purchases } = await supabase
        .from('economy_purchases')
        .select('item_id, created_at')
        .eq('guild_id', guildUuid)
        .eq('user_id', interaction.user.id)
        .order('created_at', { ascending: false })
        .limit(25);
      if (!purchases?.length) return interaction.editReply('🎒 Du har ikke købt noget endnu.');
      const { data: items } = await supabase
        .from('economy_shop_items').select('id, name').in('id', purchases.map((p) => p.item_id));
      const nameById = new Map((items || []).map((i) => [i.id, i.name]));
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🎒 Dit inventar')
        .setDescription(purchases.map((p) => `• ${nameById.get(p.item_id) || 'Ukendt vare'} — <t:${Math.floor(new Date(p.created_at).getTime() / 1000)}:R>`).join('\n'));
      await interaction.editReply({ embeds: [embed] });
    },

    crime: async (interaction) => {
      const wait = checkCooldown('crime', interaction, 30 * 60 * 1000);
      if (wait) return interaction.reply({ content: `⏰ Du kan begå kriminalitet igen om **${formatDuration(wait)}**.`, flags: 64 });
      await interaction.deferReply();
      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Server ikke fundet.');
      const success = Math.random() < 0.55;
      const amount = Math.floor(Math.random() * 400) + 100;
      const delta = success ? amount : -Math.min(amount, eco.account.wallet || 0);
      const balance = await addBalance(eco, delta, 'crime', success ? 'Kriminalitet lykkedes' : 'Kriminalitet mislykkedes');
      const embed = new EmbedBuilder()
        .setColor(success ? '#00FF00' : '#FF0000')
        .setTitle(success ? '🕵️ Kuppet lykkedes!' : '🚔 Du blev fanget!')
        .setDescription(success
          ? `Du stjal **${amount} ${eco.name}**.`
          : `Du mistede **${Math.abs(delta)} ${eco.name}** i bøde.`)
        .addFields({ name: 'Ny balance', value: `${eco.symbol} ${balance}` });
      await interaction.editReply({ embeds: [embed] });
    },

    weekly: async (interaction) => {
      const wait = checkCooldown('weekly', interaction, 7 * 24 * 3600 * 1000);
      if (wait) return interaction.reply({ content: `⏰ Din ugentlige belønning er klar om **${formatDuration(wait)}**.`, flags: 64 });
      await interaction.deferReply();
      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Server ikke fundet.');
      const amount = 1000;
      const balance = await addBalance(eco, amount, 'weekly', 'Ugentlig belønning');
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${eco.symbol} Ugentlig belønning`)
        .setDescription(`Du har modtaget **${amount} ${eco.name}**!`)
        .addFields({ name: 'Ny balance', value: `${eco.symbol} ${balance}` });
      await interaction.editReply({ embeds: [embed] });
    },

    slots: async (interaction) => {
      await interaction.deferReply();
      const bet = interaction.options.getInteger('bet');
      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Server ikke fundet.');
      if (bet <= 0) return interaction.editReply('❌ Indsatsen skal være over 0.');
      if ((eco.account.wallet || 0) < bet) return interaction.editReply('❌ Du har ikke nok penge.');

      const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
      const roll = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
      let multiplier = 0;
      if (roll[0] === roll[1] && roll[1] === roll[2]) multiplier = roll[0] === '7️⃣' ? 10 : 5;
      else if (roll[0] === roll[1] || roll[1] === roll[2] || roll[0] === roll[2]) multiplier = 1.5;

      const delta = Math.round(bet * multiplier) - bet;
      const balance = await addBalance(eco, delta, 'slots', `Slots (${roll.join('')})`);
      const embed = new EmbedBuilder()
        .setColor(delta >= 0 ? '#00FF00' : '#FF0000')
        .setTitle('🎰 Slots')
        .setDescription(`${roll.join(' | ')}\n\n${delta >= 0 ? `Du vandt **${delta} ${eco.name}**!` : `Du tabte **${Math.abs(delta)} ${eco.name}**.`}`)
        .addFields({ name: 'Ny balance', value: `${eco.symbol} ${balance}` });
      await interaction.editReply({ embeds: [embed] });
    },

    gamble: async (interaction) => {
      await interaction.deferReply();
      const bet = interaction.options.getInteger('bet');
      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Server ikke fundet.');
      if (bet <= 0) return interaction.editReply('❌ Indsatsen skal være over 0.');
      if ((eco.account.wallet || 0) < bet) return interaction.editReply('❌ Du har ikke nok penge.');
      const won = Math.random() < 0.45;
      const delta = won ? bet : -bet;
      const balance = await addBalance(eco, delta, 'gamble', won ? 'Gamble vundet' : 'Gamble tabt');
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(won ? '#00FF00' : '#FF0000')
          .setTitle(won ? '🎲 Du vandt!' : '🎲 Du tabte!')
          .setDescription(`${won ? '+' : '-'}**${bet} ${eco.name}**`)
          .addFields({ name: 'Ny balance', value: `${eco.symbol} ${balance}` })],
      });
    },

    roulette: async (interaction) => {
      await interaction.deferReply();
      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice');
      const eco = await getEconomy(interaction);
      if (!eco) return interaction.editReply('❌ Server ikke fundet.');
      if (bet <= 0) return interaction.editReply('❌ Indsatsen skal være over 0.');
      if ((eco.account.wallet || 0) < bet) return interaction.editReply('❌ Du har ikke nok penge.');

      const number = Math.floor(Math.random() * 37); // 0-36
      const isRed = number !== 0 && number % 2 === 1;
      const color = number === 0 ? 'green' : isRed ? 'red' : 'black';
      let multiplier = 0;
      if (choice === color) multiplier = color === 'green' ? 14 : 2;
      else if (choice === 'even' && number !== 0 && number % 2 === 0) multiplier = 2;
      else if (choice === 'odd' && number % 2 === 1) multiplier = 2;

      const delta = Math.round(bet * multiplier) - bet;
      const balance = await addBalance(eco, delta, 'roulette', `Roulette (${number} ${color})`);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(delta >= 0 ? '#00FF00' : '#FF0000')
          .setTitle('🎡 Roulette')
          .setDescription(`Kuglen landede på **${number}** (${color}).\n${delta >= 0 ? `Du vandt **${delta} ${eco.name}**!` : `Du tabte **${Math.abs(delta)} ${eco.name}**.`}`)
          .addFields({ name: 'Ny balance', value: `${eco.symbol} ${balance}` })],
      });
    },

    // ==================== LEVELING ADMIN ====================

    addxp: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const result = await updateLevel(interaction, user.id, (c) => {
        const xp = (c.xp || 0) + amount;
        return { xp, level: Math.floor(xp / 100) };
      });
      if (!result) return interaction.editReply('❌ Server ikke fundet.');
      await interaction.editReply(`✅ Tilføjede **${amount} XP** til ${user}. Ny total: **${result.xp} XP** (level ${result.level}).`);
    },

    removexp: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const result = await updateLevel(interaction, user.id, (c) => {
        const xp = Math.max(0, (c.xp || 0) - amount);
        return { xp, level: Math.floor(xp / 100) };
      });
      if (!result) return interaction.editReply('❌ Server ikke fundet.');
      await interaction.editReply(`✅ Fjernede **${amount} XP** fra ${user}. Ny total: **${result.xp} XP** (level ${result.level}).`);
    },

    setxp: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const result = await updateLevel(interaction, user.id, () => ({ xp: amount, level: Math.floor(amount / 100) }));
      if (!result) return interaction.editReply('❌ Server ikke fundet.');
      await interaction.editReply(`✅ Satte ${user} til **${result.xp} XP** (level ${result.level}).`);
    },

    setlevel: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const level = interaction.options.getInteger('level');
      const result = await updateLevel(interaction, user.id, () => ({ xp: level * 100, level }));
      if (!result) return interaction.editReply('❌ Server ikke fundet.');
      await interaction.editReply(`✅ Satte ${user} til **level ${result.level}** (${result.xp} XP).`);
    },

    resetxp: async (interaction) => {
      if (!requireManageGuild(interaction)) return;
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const result = await updateLevel(interaction, user.id, () => ({ xp: 0, level: 0 }));
      if (!result) return interaction.editReply('❌ Server ikke fundet.');
      await interaction.editReply(`✅ Nulstillede XP for ${user}.`);
    },

    resetleaderboard: async (interaction) => {
      if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Kun administratorer kan nulstille leaderboardet.', flags: 64 });
      }
      await interaction.deferReply();
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Server ikke fundet.');
      const { error } = await supabase.from('user_levels').delete().eq('guild_id', guildUuid);
      if (error) return interaction.editReply('❌ Kunne ikke nulstille leaderboardet.');
      await interaction.editReply('✅ Leaderboardet er nulstillet for hele serveren.');
    },

    // ==================== ALIASER ====================

    close: async (interaction) => {
      client.emit('interactionCreate', aliasInteraction(interaction, 'ticket-close'));
    },
    claim: async (interaction) => {
      client.emit('interactionCreate', aliasInteraction(interaction, 'ticket-claim'));
    },
    add: async (interaction) => {
      client.emit('interactionCreate', aliasInteraction(interaction, 'ticket-add'));
    },
    unclaim: async (interaction) => {
      if (!interaction.channel?.isThread()) {
        return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en ticket-tråd.', flags: 64 });
      }
      const { data: ticket } = await supabase
        .from('tickets').select('id, claimed_by').eq('thread_id', interaction.channel.id).maybeSingle();
      if (!ticket) return interaction.reply({ content: '❌ Ingen ticket fundet for denne tråd.', flags: 64 });
      await supabase.from('tickets').update({ claimed_by: null, claimed_at: null }).eq('id', ticket.id);
      await interaction.reply(`🔓 ${interaction.user} har frigivet denne ticket.`);
    },
    rename: async (interaction) => {
      if (!interaction.channel?.isThread()) {
        return interaction.reply({ content: '❌ Denne kommando kan kun bruges i en tråd.', flags: 64 });
      }
      const name = interaction.options.getString('name').slice(0, 90);
      try {
        await interaction.channel.setName(name);
        await interaction.reply({ content: `✅ Tråden er omdøbt til **${name}**.`, flags: 64 });
      } catch {
        await interaction.reply({ content: '❌ Kunne ikke omdøbe tråden.', flags: 64 });
      }
    },

    gstart: async (interaction) => handlers?.giveaway?.(aliasInteraction(interaction, 'giveaway', {
      options: (o) => new Proxy(o, { get: (t, p) => (p === 'getSubcommand' ? () => 'start' : (typeof t[p] === 'function' ? t[p].bind(t) : t[p])) }),
    })),
    gend: async (interaction) => handlers?.giveaway?.(aliasInteraction(interaction, 'giveaway', {
      options: (o) => new Proxy(o, { get: (t, p) => (p === 'getSubcommand' ? () => 'end' : (typeof t[p] === 'function' ? t[p].bind(t) : t[p])) }),
    })),
    greroll: async (interaction) => handlers?.giveaway?.(aliasInteraction(interaction, 'giveaway', {
      options: (o) => new Proxy(o, { get: (t, p) => (p === 'getSubcommand' ? () => 'reroll' : (typeof t[p] === 'function' ? t[p].bind(t) : t[p])) }),
    })),
    glist: async (interaction) => {
      await interaction.deferReply();
      const guildUuid = await getGuildUuid(interaction);
      if (!guildUuid) return interaction.editReply('❌ Server ikke fundet.');
      const { data: giveaways } = await supabase
        .from('giveaways').select('prize, ends_at, winners_count, message_id, status')
        .eq('guild_id', guildUuid).eq('status', 'active').order('ends_at', { ascending: true }).limit(15);
      if (!giveaways?.length) return interaction.editReply('🎉 Der er ingen aktive giveaways.');
      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎉 Aktive giveaways')
        .setDescription(giveaways.map((g) => `**${g.prize}** — ${g.winners_count || 1} vinder(e), slutter <t:${Math.floor(new Date(g.ends_at).getTime() / 1000)}:R>\nID: \`${g.message_id}\``).join('\n\n'));
      await interaction.editReply({ embeds: [embed] });
    },
  };
}

module.exports = { createExtraHandlers, setupSnipeTracker };
