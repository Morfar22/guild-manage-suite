/**
 * Music Module - Lavalink/Kazagumo Integration
 * 
 * Requires:
 *   npm install kazagumo shoukaku
 *   A running Lavalink server (default: localhost:40191)
 * 
 * Env vars (optional):
 *   LAVALINK_HOST (default: localhost)
 *   LAVALINK_PORT (default: 40191)
 *   LAVALINK_PASSWORD (default: youshallnotpass)
 *   LAVALINK_NAME (default: Main)
 *   LAVALINK_SECURE (default: false)
 */

const { Kazagumo, Plugins } = require('kazagumo');
const { Connectors } = require('shoukaku');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ==================== CONFIG ====================

const LAVALINK_HOST = process.env.LAVALINK_HOST || 'localhost';
const LAVALINK_PORT = parseInt(process.env.LAVALINK_PORT || '40191', 10);
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const LAVALINK_NAME = process.env.LAVALINK_NAME || 'Main';
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === 'true';
const LAVALINK_RECONNECT_TRIES = Math.max(1, Number(process.env.LAVALINK_RECONNECT_TRIES || 120));
const LAVALINK_RECONNECT_INTERVAL = Math.max(5, Number(process.env.LAVALINK_RECONNECT_INTERVAL || 30));
const LAVALINK_REST_TIMEOUT = Math.max(10, Number(process.env.LAVALINK_REST_TIMEOUT || 30));

const Nodes = [
  {
    name: LAVALINK_NAME,
    url: `${LAVALINK_HOST}:${LAVALINK_PORT}`,
    auth: LAVALINK_PASSWORD,
    secure: LAVALINK_SECURE,
  },
];

// ==================== STATE ====================

// One Kazagumo/Shoukaku instance per Discord client.
// A custom bot must establish voice with its own gateway session, otherwise
// Discord never sends the VOICE_STATE_UPDATE/VOICE_SERVER_UPDATE pair back
// to the connector and Shoukaku times out after 15 seconds.
const kazagumoByClient = new WeakMap();
const lavalinkHealthByClient = new WeakMap();

// Process-wide throttling so 8+ custom bots don't print the same Lavalink outage
// every second. Each bot still keeps its own connection/session.
const lavalinkErrorThrottle = new Map();
const LAVALINK_ERROR_LOG_INTERVAL_MS = Number(process.env.LAVALINK_ERROR_LOG_INTERVAL_MS || 300000);

// ==================== HELPERS ====================

function formatDuration(ms) {
  if (!ms || ms === 0) return 'Live';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function progressBar(current, total, length = 15) {
  if (!total) return '▬'.repeat(length);
  const progress = Math.round((current / total) * length);
  return '▓'.repeat(progress) + '▬'.repeat(length - progress);
}

function truncate(str, max = 60) {
  if (!str) return 'Ukendt';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function getConnectedNode(kazagumo) {
  if (!kazagumo?.shoukaku?.nodes) return null;

  // Shoukaku v4 NodeState.CONNECTED = 1.
  for (const node of kazagumo.shoukaku.nodes.values()) {
    if (node?.state === 1) return node;
  }

  return null;
}

function isLavalinkReady(kazagumo) {
  return Boolean(getConnectedNode(kazagumo));
}

function getLavalinkHealth(client) {
  const current = lavalinkHealthByClient.get(client);
  if (current) return current;

  const health = {
    connected: false,
    nodeName: null,
    lastError: null,
    lastErrorAt: null,
    connectedAt: null,
  };
  lavalinkHealthByClient.set(client, health);
  return health;
}

function normalizeLavalinkError(error) {
  return error?.code || error?.message || error?.name || String(error || 'Unknown Lavalink error');
}

function logLavalinkErrorThrottled(name, error, client) {
  const details = normalizeLavalinkError(error);
  // Collapse ECONNREFUSED / websocket-close variants into one process-wide
  // outage bucket per node so 8+ bot clients don't flood PM2 logs.
  const key = String(name || LAVALINK_NAME);
  const now = Date.now();
  const previous = lavalinkErrorThrottle.get(key);

  if (!previous || now - previous.lastLoggedAt >= LAVALINK_ERROR_LOG_INTERVAL_MS) {
    const suppressed = previous?.suppressed || 0;
    const suffix = suppressed > 0 ? ` (undertrykte ${suppressed} gentagelser)` : '';
    console.error(`[Music] Lavalink node "${name}" utilgængelig: ${details}${suffix}`);
    lavalinkErrorThrottle.set(key, { lastLoggedAt: now, suppressed: 0 });
  } else {
    previous.suppressed += 1;
    lavalinkErrorThrottle.set(key, previous);
  }

  if (client) {
    const health = getLavalinkHealth(client);
    health.connected = false;
    health.nodeName = name || health.nodeName;
    health.lastError = details;
    health.lastErrorAt = new Date().toISOString();
  }
}

// ==================== INIT ====================

function initMusic(client) {
  const existing = kazagumoByClient.get(client);
  if (existing) return existing;

  const connector = new Connectors.DiscordJS(client);

  const kazagumo = new Kazagumo(
    {
      defaultSearchEngine: 'youtube',
      send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
    },
    connector,
    Nodes,
    {
      resume: true,
      resumeTimeout: 60,
      reconnectTries: LAVALINK_RECONNECT_TRIES,
      reconnectInterval: LAVALINK_RECONNECT_INTERVAL,
      restTimeout: LAVALINK_REST_TIMEOUT,
      moveOnDisconnect: false,
    }
  );

  // Forward raw voice packets to Shoukaku when nodes are added manually
  // Raw forwarding not needed — connector handles it when initialized before login

  // Events
  kazagumo.shoukaku.on('ready', (name) => {
    const health = getLavalinkHealth(client);
    health.connected = true;
    health.nodeName = name;
    health.lastError = null;
    health.connectedAt = new Date().toISOString();

    lavalinkErrorThrottle.delete(String(name || LAVALINK_NAME));
    console.log(`[Music] ✅ Lavalink node "${name}" connected for ${client.user?.tag || client.user?.id || 'bot'}`);
  });

  kazagumo.shoukaku.on('error', (name, error) => {
    logLavalinkErrorThrottled(name, error, client);
  });

  kazagumo.shoukaku.on('close', (name, code, reason) => {
    const health = getLavalinkHealth(client);
    health.connected = false;
    health.nodeName = name;
    health.lastError = `WebSocket closed (${code}): ${reason || 'no reason'}`;
    health.lastErrorAt = new Date().toISOString();

    logLavalinkErrorThrottled(name, health.lastError, client);
  });

  kazagumo.shoukaku.on('disconnect', (name, players, moved) => {
    const health = getLavalinkHealth(client);
    health.connected = false;
    health.nodeName = name;
    health.lastError = 'Disconnected';
    health.lastErrorAt = new Date().toISOString();

    console.warn(`[Music] Lavalink node "${name}" disconnected. Players: ${players?.size || 0}, Moved: ${moved || 0}`);
  });

  // Player events
  kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 Afspiller nu')
      .setDescription(`[${truncate(track.title, 80)}](${track.uri})`)
      .addFields(
        { name: 'Varighed', value: formatDuration(track.length), inline: true },
        { name: 'Anmodet af', value: track.requester?.toString() || 'Ukendt', inline: true }
      )
      .setTimestamp();

    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    channel.send({ embeds: [embed] }).catch(() => {});
  });

  kazagumo.on('playerEnd', (player) => {
    // Handled automatically by Kazagumo
  });

  kazagumo.on('playerEmpty', (player) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('📭 Køen er tom — forlader voice kanalen.')
        ]
      }).catch(() => {});
    }
    player.destroy();
  });

  kazagumo.on('playerError', (player, error) => {
    console.error('[Music] Player error:', error.message);
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription(`❌ Afspilningsfejl: ${error.message}`)
        ]
      }).catch(() => {});
    }
  });

  kazagumoByClient.set(client, kazagumo);

  console.log(
    `[Music] Kazagumo initialiseret for ${client.user?.tag || client.user?.id || 'pending client'} · ` +
    `Lavalink ${LAVALINK_SECURE ? 'wss' : 'ws'}://${LAVALINK_HOST}:${LAVALINK_PORT} · ` +
    `reconnect ${LAVALINK_RECONNECT_TRIES}x/${LAVALINK_RECONNECT_INTERVAL}s`
  );

  return kazagumo;
}

function getKazagumo(client) {
  return client ? (kazagumoByClient.get(client) || null) : null;
}

function getKazagumoForInteraction(interaction) {
  return getKazagumo(interaction?.client);
}

// ==================== COMMANDS ====================

const commands = {
  // ---- PLAY ----
  play: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const query = interaction.options.getString('query');
    const { channel } = interaction.member.voice;

    if (!channel) {
      return interaction.editReply({ content: '❌ Du skal være i en voice kanal for at afspille musik.' });
    }

    if (!kazagumo) {
      return interaction.editReply({ content: '❌ Musik-systemet er ikke initialiseret for denne bot endnu.' });
    }

    if (!isLavalinkReady(kazagumo)) {
      const health = getLavalinkHealth(interaction.client);
      const detail = health.lastError
        ? ` Seneste fejl: \`${truncate(health.lastError, 120)}\`.`
        : '';

      return interaction.editReply({
        content: `⚠️ Musikserveren er midlertidigt utilgængelig.${detail} Prøv igen om lidt.`,
      });
    }

    const me = interaction.guild?.members?.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    if (!permissions?.has(PermissionFlagsBits.Connect)) {
      return interaction.editReply({ content: '❌ Jeg mangler **Connect**-tilladelse i din voice-kanal.' });
    }
    if (!permissions?.has(PermissionFlagsBits.Speak)) {
      return interaction.editReply({ content: '❌ Jeg mangler **Speak**-tilladelse i din voice-kanal.' });
    }

    let player = kazagumo.players.get(interaction.guildId);
    if (!player) {
      try {
        player = await kazagumo.createPlayer({
          guildId: interaction.guildId,
          textId: interaction.channelId,
          voiceId: channel.id,
          volume: 80,
          deaf: true,
        });
      } catch (error) {
        const message = normalizeLavalinkError(error);
        if (/no node found/i.test(message)) {
          const health = getLavalinkHealth(interaction.client);
          health.connected = false;
          health.lastError = message;
          health.lastErrorAt = new Date().toISOString();

          return interaction.editReply({
            content: '⚠️ Musikserveren er ikke forbundet lige nu. Prøv igen, når Lavalink er online.',
          });
        }
        throw error;
      }
    }

    // Determine search engine based on input type
    let searchQuery = query;
    let searchOptions = { requester: interaction.user };
    
    if (query.startsWith('http')) {
      // Direct URL — no search engine prefix needed
      console.log(`[Music] Loading URL: "${query}"`);
    } else {
      // Text search — use youtube search
      searchQuery = `ytsearch:${query}`;
      console.log(`[Music] Searching: "${searchQuery}"`);
    }

    const result = await kazagumo.search(searchQuery, searchOptions);
    console.log(`[Music] Search result: type=${result.type}, tracks=${result.tracks.length}`);

    if (!result.tracks.length) {
      console.log(`[Music] No tracks found. Raw result:`, JSON.stringify(result).slice(0, 500));
      return interaction.editReply({ content: '❌ Ingen resultater fundet. Prøv et andet søgeord eller link.' });
    }

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('📋 Playliste tilføjet')
        .setDescription(`**${result.playlistName}**`)
        .addFields(
          { name: 'Sange', value: `${result.tracks.length}`, inline: true },
          { name: 'Anmodet af', value: interaction.user.toString(), inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      const position = player.queue.size;

      if (position > 0) {
        const embed = new EmbedBuilder()
          .setColor('#1DB954')
          .setTitle('🎶 Tilføjet til kø')
          .setDescription(`[${truncate(track.title, 80)}](${track.uri})`)
          .addFields(
            { name: 'Varighed', value: formatDuration(track.length), inline: true },
            { name: 'Position', value: `#${position}`, inline: true },
            { name: 'Anmodet af', value: interaction.user.toString(), inline: true }
          )
          .setTimestamp();
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: `🎵 Søger og afspiller: **${truncate(track.title)}**` });
      }
    }

    if (!player.playing && !player.paused) player.play();
  },

  // ---- SKIP ----
  skip: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    const skipped = player.queue.current;
    player.skip();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setDescription(`⏭️ Skippet: **${truncate(skipped.title)}**`)
      ]
    });
  },

  // ---- STOP ----
  stop: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    player.destroy();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription('⏹️ Musikken er stoppet og køen ryddet.')
      ]
    });
  },

  // ---- PAUSE ----
  pause: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    if (player.paused) {
      return interaction.editReply({ content: '⚠️ Musikken er allerede sat på pause.' });
    }

    player.pause(true);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setDescription('⏸️ Musikken er sat på pause. Brug `/resume` for at genoptage.')
      ]
    });
  },

  // ---- RESUME ----
  resume: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    if (!player.paused) {
      return interaction.editReply({ content: '⚠️ Musikken er ikke på pause.' });
    }

    player.pause(false);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription('▶️ Musikken er genoptaget!')
      ]
    });
  },

  // ---- QUEUE ----
  queue: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Køen er tom.' });
    }

    const current = player.queue.current;
    const tracks = player.queue;
    const totalDuration = tracks.reduce((acc, t) => acc + (t.length || 0), current.length || 0);

    let description = `**Afspiller nu:**\n[${truncate(current.title, 60)}](${current.uri}) \`${formatDuration(current.length)}\`\n\n`;

    if (tracks.length > 0) {
      description += '**Kø:**\n';
      const pageSize = 10;
      for (let i = 0; i < Math.min(tracks.length, pageSize); i++) {
        const t = tracks[i];
        description += `\`${i + 1}.\` [${truncate(t.title, 50)}](${t.uri}) \`${formatDuration(t.length)}\`\n`;
      }
      if (tracks.length > pageSize) {
        description += `\n*...og ${tracks.length - pageSize} flere*`;
      }
    }

    const loopModes = { 0: 'Ingen', 1: 'Sang', 2: 'Kø' };

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle(`🎶 Musikkø — ${tracks.length} sang${tracks.length !== 1 ? 'e' : ''}`)
      .setDescription(description)
      .addFields(
        { name: 'Total varighed', value: formatDuration(totalDuration), inline: true },
        { name: 'Loop', value: loopModes[player.loop] || 'Ingen', inline: true },
        { name: 'Lydstyrke', value: `${player.volume}%`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  // ---- NOWPLAYING ----
  nowplaying: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    const track = player.queue.current;
    const position = player.shoukaku.position || 0;
    const bar = progressBar(position, track.length);

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 Afspiller nu')
      .setDescription(`[${truncate(track.title, 80)}](${track.uri})`)
      .addFields(
        { name: 'Fremskridt', value: `\`${formatDuration(position)}\` ${bar} \`${formatDuration(track.length)}\`` },
        { name: 'Kilde', value: track.sourceName || 'Ukendt', inline: true },
        { name: 'Anmodet af', value: track.requester?.toString() || 'Ukendt', inline: true }
      )
      .setTimestamp();

    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    await interaction.editReply({ embeds: [embed] });
  },

  // ---- VOLUME ----
  volume: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    const level = interaction.options.getInteger('level');
    if (level < 0 || level > 100) {
      return interaction.editReply({ content: '❌ Lydstyrken skal være mellem 0 og 100.' });
    }

    player.setVolume(level);
    const icon = level === 0 ? '🔇' : level < 30 ? '🔈' : level < 70 ? '🔉' : '🔊';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`${icon} Lydstyrke sat til **${level}%**`)
      ]
    });
  },

  // ---- LOOP ----
  loop: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '❌ Der afspilles ingen musik.' });
    }

    const mode = interaction.options.getString('mode');
    const modeMap = { off: 0, track: 1, queue: 2 };
    const modeNames = { off: 'Deaktiveret', track: 'Sang', queue: 'Kø' };
    const modeIcons = { off: '➡️', track: '🔂', queue: '🔁' };

    if (!(mode in modeMap)) {
      return interaction.editReply({ content: '❌ Ugyldigt loop-mode. Brug: `off`, `track` eller `queue`.' });
    }

    player.setLoop(modeMap[mode]);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`${modeIcons[mode]} Loop: **${modeNames[mode]}**`)
      ]
    });
  },

  // ---- SHUFFLE ----
  shuffle: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || player.queue.length < 2) {
      return interaction.editReply({ content: '❌ Der skal være mindst 2 sange i køen for at blande.' });
    }

    player.queue.shuffle();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`🔀 Køen er blandet! (${player.queue.length} sange)`)
      ]
    });
  },

  // ---- REMOVE ----
  remove: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.length) {
      return interaction.editReply({ content: '❌ Køen er tom.' });
    }

    const position = interaction.options.getInteger('position');
    if (position < 1 || position > player.queue.length) {
      return interaction.editReply({ content: `❌ Ugyldig position. Brug 1-${player.queue.length}.` });
    }

    const removed = player.queue.splice(position - 1, 1);
    const track = removed[0];

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setDescription(`🗑️ Fjernet: **${truncate(track?.title || 'Ukendt')}** fra position #${position}`)
      ]
    });
  },

  // ---- MOVE ----
  move: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || player.queue.length < 2) {
      return interaction.editReply({ content: '❌ Der skal være mindst 2 sange i køen.' });
    }

    const from = interaction.options.getInteger('from');
    const to = interaction.options.getInteger('to');
    const qLen = player.queue.length;

    if (from < 1 || from > qLen || to < 1 || to > qLen) {
      return interaction.editReply({ content: `❌ Positioner skal være mellem 1 og ${qLen}.` });
    }

    if (from === to) {
      return interaction.editReply({ content: '⚠️ Fra og til position er ens.' });
    }

    const [track] = player.queue.splice(from - 1, 1);
    player.queue.splice(to - 1, 0, track);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`↕️ Flyttet **${truncate(track?.title || 'Ukendt')}** fra #${from} til #${to}`)
      ]
    });
  },

  // ---- JUMP ----
  jump: async (interaction) => {
    const kazagumo = getKazagumoForInteraction(interaction);
    const player = kazagumo?.players.get(interaction.guildId);
    if (!player || !player.queue.length) {
      return interaction.editReply({ content: '❌ Køen er tom.' });
    }

    const position = interaction.options.getInteger('position');
    if (position < 1 || position > player.queue.length) {
      return interaction.editReply({ content: `❌ Ugyldig position. Brug 1-${player.queue.length}.` });
    }

    // Remove tracks before the target position
    player.queue.splice(0, position - 1);
    player.skip();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setDescription(`⏩ Hoppet til position #${position} i køen`)
      ]
    });
  },
};

// ==================== EXPORTS ====================

function getKazagumoForClient(client) {
  return getKazagumo(client);
}

function getMusicHealth(client) {
  const kazagumo = getKazagumo(client);
  const health = getLavalinkHealth(client);

  return {
    initialized: Boolean(kazagumo),
    connected: isLavalinkReady(kazagumo),
    nodeName: health.nodeName,
    lastError: health.lastError,
    lastErrorAt: health.lastErrorAt,
    connectedAt: health.connectedAt,
  };
}

module.exports = {
  initMusic,
  commands,
  getKazagumo: getKazagumoForClient,
  getMusicHealth,
  isLavalinkReady,
};
