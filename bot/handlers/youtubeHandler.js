/**
 * Bot YouTube Handler
 * 
 * Checker periodisk YouTube kanaler for nye videoer og live streams
 * via YouTube RSS feeds (ingen API-nøgle påkrævet for uploads).
 * Live-detektion bruger yt-dlp / scraping.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { manager } = require('../customBotManager');

// Check interval: 3 minutter
const CHECK_INTERVAL = 180000;
let globalPollerStarted = false;
let globalPollerRegistered = false;
let globalPollInterval = null;
let globalInitialTimeout = null;

/**
 * Fetch latest video from YouTube RSS feed
 */
async function checkYouTubeChannel(channelId) {
  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
      },
    });

    if (!response.ok) return null;

    const xml = await response.text();

    // Parse channel name
    const channelNameMatch = xml.match(/<name>([^<]+)<\/name>/);
    const channelName = channelNameMatch ? channelNameMatch[1] : null;

    // Parse latest video entry
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return { channelName, videoId: null, videoUrl: null, title: null, isLive: false };

    const entry = entryMatch[1];
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const thumbnailMatch = entry.match(/<media:thumbnail url="([^"]+)"/);

    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    const title = titleMatch ? titleMatch[1] : null;
    const published = publishedMatch ? publishedMatch[1] : null;
    const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : null;

    return {
      channelName,
      videoId,
      videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      title,
      published,
      thumbnailUrl: thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
      isLive: false,
    };
  } catch (error) {
    console.error(`[YouTube] RSS check fejl for ${channelId}:`, error.message);
    return null;
  }
}

/**
 * Check if a YouTube channel is currently live
 */
async function checkIfLive(channelId) {
  try {
    const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) return { isLive: false };

    const html = await response.text();

    // Check for live indicators in the page
    const isLive = html.includes('"isLive":true') ||
                   html.includes('"isLiveNow":true') ||
                   html.includes('"liveBroadcastDetails"');

    // Try to get the stream title
    let liveTitle = null;
    if (isLive) {
      const titleMatch = html.match(/"title":"([^"]{1,200})"/);
      liveTitle = titleMatch ? titleMatch[1] : null;
    }

    return { isLive, liveTitle };
  } catch (error) {
    console.error(`[YouTube] Live check fejl for ${channelId}:`, error.message);
    return { isLive: false };
  }
}

/**
 * Send Discord notification for a new YouTube video
 */
async function sendVideoNotification(targetClient, account, videoInfo, settings) {
  try {
    const channel = await client.channels.fetch(account.notification_channel_id).catch(() => null);
    if (!channel) {
      console.error(`[YouTube] Kanal ${account.notification_channel_id} ikke fundet`);
      return false;
    }

    let message = (account.custom_message || settings?.new_video_message || '📺 **{channel}** har uploadet en ny video!')
      .replace(/{channel}/g, account.channel_name || videoInfo.channelName || 'YouTube')
      .replace(/{title}/g, videoInfo.title || 'Ny video')
      .replace(/{url}/g, videoInfo.videoUrl || '');

    const embedColor = settings?.embed_color ? parseInt(settings.embed_color.replace('#', ''), 16) : 0xFF0000;

    const embed = {
      title: videoInfo.title || `Ny video fra ${account.channel_name || 'YouTube'}`,
      url: videoInfo.videoUrl,
      description: message,
      color: embedColor,
      image: videoInfo.thumbnailUrl ? { url: videoInfo.thumbnailUrl } : undefined,
      footer: { text: 'YouTube', icon_url: 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png' },
      timestamp: new Date().toISOString(),
    };

    const sentMessage = await channel.send({
      content: account.mention_role_id ? `<@&${account.mention_role_id}>` : undefined,
      embeds: [embed],
    });

    // Log notification
    if (SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/youtube_notification_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          guild_id: account.guild_id,
          youtube_channel_db_id: account.id,
          youtube_channel_name: account.channel_name || videoInfo.channelName,
          video_id: videoInfo.videoId,
          video_url: videoInfo.videoUrl,
          video_title: videoInfo.title,
          notification_type: 'new_video',
          channel_id: account.notification_channel_id,
          message_id: sentMessage.id,
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('[YouTube] Video notification fejl:', error.message);
    return false;
  }
}

/**
 * Send Discord notification for live status change
 */
async function sendLiveNotification(targetClient, account, isLive, settings, liveTitle) {
  try {
    const targetChannelId = (isLive && account.live_channel_id) ? account.live_channel_id : account.notification_channel_id;
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!channel) return false;

    const messageTemplate = isLive
      ? (settings?.live_message || '🔴 **{channel}** er nu LIVE på YouTube!')
      : (settings?.offline_message || '⚫ **{channel}** er gået offline på YouTube.');

    let message = messageTemplate
      .replace(/{channel}/g, account.channel_name || 'YouTube')
      .replace(/{title}/g, liveTitle || 'Live Stream');

    const embedColor = isLive ? 0xFF0000 : 0x808080;
    const liveUrl = `https://www.youtube.com/channel/${account.youtube_channel_id}/live`;

    const embed = {
      title: isLive
        ? `🔴 ${account.channel_name || 'YouTube'} er LIVE!`
        : `⚫ ${account.channel_name || 'YouTube'} er gået offline`,
      url: isLive ? liveUrl : `https://www.youtube.com/channel/${account.youtube_channel_id}`,
      description: message,
      color: embedColor,
      footer: { text: 'YouTube LIVE', icon_url: 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png' },
      timestamp: new Date().toISOString(),
    };

    if (isLive && liveTitle) {
      embed.fields = [{ name: 'Stream', value: liveTitle, inline: false }];
    }

    const sentMessage = await channel.send({
      content: isLive && account.mention_role_id ? `<@&${account.mention_role_id}>` : undefined,
      embeds: [embed],
    });

    if (SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/youtube_notification_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          guild_id: account.guild_id,
          youtube_channel_db_id: account.id,
          youtube_channel_name: account.channel_name,
          notification_type: isLive ? 'live' : 'offline',
          channel_id: targetChannelId,
          message_id: sentMessage.id,
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('[YouTube] Live notification fejl:', error.message);
    return false;
  }
}

/**
 * Check all tracked YouTube channels
 */
async function checkAllYouTubeChannels(client = null, shouldHandleGuild = null) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[YouTube] SUPABASE_SERVICE_ROLE_KEY mangler');
    return;
  }

  try {
    // Fetch all enabled YouTube channels
    const accountsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/youtube_channels?enabled=eq.true&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!accountsRes.ok) {
      console.error('[YouTube] Kunne ikke hente kanaler:', await accountsRes.text());
      return;
    }

    const accounts = await accountsRes.json();
    if (!accounts.length) return;

    // Get unique guild IDs and fetch settings
    const guildIds = [...new Set(accounts.map(a => a.guild_id))];
    const settingsMap = {};

    // Resolve internal guild UUIDs to Discord guild IDs once per cycle.
    const guildMap = {};
    if (guildIds.length > 0) {
      const filter = encodeURIComponent(`in.(${guildIds.join(',')})`);
      const guildRes = await fetch(
        `${SUPABASE_URL}/rest/v1/guilds?id=${filter}&select=id,guild_id`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (guildRes.ok) {
        const rows = await guildRes.json();
        for (const row of rows) guildMap[row.id] = row.guild_id;
      }
    }

    for (const guildId of guildIds) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/youtube_settings?guild_id=eq.${guildId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.length > 0 && data[0].enabled) {
          settingsMap[guildId] = data[0];
        }
      }
    }

    let checked = 0;
    let notified = 0;

    for (const account of accounts) {
      const guildSettings = settingsMap[account.guild_id];
      if (guildSettings === undefined && Object.keys(settingsMap).length > 0) continue;

      const discordGuildId = guildMap[account.guild_id];
      if (!discordGuildId) continue;

      let targetClient = client;
      if (shouldHandleGuild && client) {
        if (!shouldHandleGuild(discordGuildId)) continue;
      } else {
        targetClient = manager.getClient(discordGuildId);
        if (!targetClient?.isReady?.() || !targetClient.guilds.cache.has(discordGuildId)) {
          continue;
        }
      }

      // Check RSS feed for new videos
      const videoInfo = await checkYouTubeChannel(account.youtube_channel_id);
      checked++;

      if (!videoInfo) {
        await updateAccount(account.id, { last_check_at: new Date().toISOString() });
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Update channel name if discovered
      const updateData = {
        last_check_at: new Date().toISOString(),
      };

      if (videoInfo.channelName && !account.channel_name) {
        updateData.channel_name = videoInfo.channelName;
      }

      // Check live status
      const liveNotificationsEnabled = guildSettings?.live_notifications !== false;
      if (liveNotificationsEnabled && targetClient) {
        const liveInfo = await checkIfLive(account.youtube_channel_id);
        const wasLive = account.is_live || false;
        const isNowLive = liveInfo.isLive || false;

        updateData.is_live = isNowLive;

        if (isNowLive && !wasLive) {
          console.log(`[YouTube] ${account.channel_name || account.youtube_channel_id} er nu LIVE!`);
          await sendLiveNotification(targetClient, account, true, guildSettings, liveInfo.liveTitle);
          updateData.last_live_at = new Date().toISOString();
          notified++;
        } else if (!isNowLive && wasLive) {
          console.log(`[YouTube] ${account.channel_name || account.youtube_channel_id} er gået offline`);
          await sendLiveNotification(targetClient, account, false, guildSettings, null);
          notified++;
        }

        if (isNowLive) {
          updateData.last_live_at = new Date().toISOString();
        }
      }

      // Handle new video
      if (videoInfo.videoId && videoInfo.videoId !== account.last_video_id) {
        // Skip if video is older than 24 hours (to avoid spam on first add)
        const isRecent = videoInfo.published
          ? (Date.now() - new Date(videoInfo.published).getTime()) < 86400000
          : true;

        if (isRecent && account.last_video_id) {
          console.log(`[YouTube] Ny video fra ${account.channel_name || account.youtube_channel_id}: ${videoInfo.videoId}`);
          const success = await sendVideoNotification(targetClient, account, videoInfo, guildSettings);
          if (success) notified++;
        }

        // Always update last_video_id (even on first run to set baseline)
        updateData.last_video_id = videoInfo.videoId;
      }

      await updateAccount(account.id, updateData);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (notified > 0) {
      console.log(`[YouTube] Checked ${checked} kanaler, sendte ${notified} notifikation(er)`);
    }
  } catch (error) {
    console.error('[YouTube] Check fejl:', error.message);
  }
}

async function updateAccount(id, data) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/youtube_channels?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(data),
    }
  );
}

/**
 * Resolve a YouTube URL or username to a channel ID
 */
async function resolveYouTubeChannelId(input) {
  try {
    // Already a channel ID (starts with UC)
    if (/^UC[\w-]{22}$/.test(input)) return { channelId: input };

    // Clean input
    let url = input.trim();
    if (!url.startsWith('http')) {
      // Could be @handle or username
      url = `https://www.youtube.com/@${url.replace('@', '')}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const html = await response.text();
    const channelIdMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
    const nameMatch = html.match(/"name":"([^"]+)"/);

    if (!channelIdMatch) return null;

    return {
      channelId: channelIdMatch[1],
      channelName: nameMatch ? nameMatch[1] : null,
    };
  } catch (error) {
    console.error('[YouTube] Resolve fejl:', error.message);
    return null;
  }
}

/**
 * Start YouTube checker service
 */
function startYouTubeChecker(client) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[YouTube] SUPABASE_SERVICE_ROLE_KEY mangler! YouTube checker deaktiveret.');
    return;
  }

  const startGlobalPoller = () => {
    if (globalPollerStarted) return;
    globalPollerStarted = true;
    console.log('[YouTube] Starter én global poller (ruter via korrekt bot-klient)');

    globalInitialTimeout = setTimeout(() => {
      checkAllYouTubeChannels().catch(() => {});
      globalPollInterval = setInterval(
        () => checkAllYouTubeChannels().catch(() => {}),
        CHECK_INTERVAL
      );
    }, 45000);
  };

  if (!globalPollerRegistered && !globalPollerStarted) {
    globalPollerRegistered = true;
    if (client?.isReady?.()) {
      startGlobalPoller();
    } else if (client) {
      client.once('clientReady', startGlobalPoller);
    } else {
      startGlobalPoller();
    }
  }
}

module.exports = {
  startYouTubeChecker,
  checkAllYouTubeChannels,
  resolveYouTubeChannelId,
  checkYouTubeChannel,
  checkIfLive,
};
