/**
 * Bot TikTok Handler
 * 
 * Checker periodisk TikTok konti for nye videoer og sender notifikationer.
 * Understøtter også auto-embedding af TikTok links i chatten.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdqunnttcyuybbofkvz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Check interval: 5 minutter (TikTok er langsomt at polle)
const CHECK_INTERVAL = 300000;

const TIKTOK_URL_REGEX = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/@?[\w.-]+\/video\/(\d+)/gi;
const TIKTOK_SHORT_URL_REGEX = /https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/gi;

/**
 * Fetch TikTok video info via oEmbed API
 */
async function getTikTokOEmbed(url) {
  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[TikTok] oEmbed fejl:', error.message);
    return null;
  }
}

/**
 * Fetch latest video from a TikTok user via RSS/scraping
 * Also checks if user is currently LIVE
 */
async function checkForNewVideos(username) {
  try {
    // Try fetching the user's page to find latest video
    const response = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Check if user is LIVE
    const isLive = html.includes('"isLiveBroadcasting":true') || 
                   html.includes('"liveRoom"') ||
                   html.includes('LIVE') && html.includes('"uniqueId":"' + username + '"');
    
    // Try to find video IDs in the page
    const videoIdMatch = html.match(/video\/(\d{15,25})/);
    
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    const videoUrl = videoId ? `https://www.tiktok.com/@${username}/video/${videoId}` : null;
    
    // Get video details via oEmbed if we have a video
    let oembed = null;
    if (videoUrl) {
      oembed = await getTikTokOEmbed(videoUrl);
    }
    
    return {
      videoId,
      videoUrl,
      title: oembed?.title || null,
      authorName: oembed?.author_name || username,
      thumbnailUrl: oembed?.thumbnail_url || null,
      isLive,
    };
  } catch (error) {
    console.error(`[TikTok] Fejl ved check af @${username}:`, error.message);
    return null;
  }
}

/**
 * Send Discord notification for a new TikTok video
 */
async function sendTikTokNotification(client, account, videoInfo, settings, guildDiscordId) {
  try {
    const channel = await client.channels.fetch(account.notification_channel_id).catch(() => null);
    if (!channel) {
      console.error(`[TikTok] Kanal ${account.notification_channel_id} ikke fundet`);
      return false;
    }

    // Build message
    let message = (settings?.new_video_message || '🎵 **{username}** har uploadet en ny TikTok!')
      .replace(/{username}/g, account.tiktok_username)
      .replace(/{url}/g, videoInfo.videoUrl)
      .replace(/{title}/g, videoInfo.title || 'Ny video');

    // Add role mention
    if (account.mention_role_id) {
      message = `<@&${account.mention_role_id}>\n${message}`;
    }

    const embedColor = settings?.embed_color ? parseInt(settings.embed_color.replace('#', ''), 16) : 0x000000;

    const embed = {
      title: videoInfo.title || `Ny TikTok fra @${account.tiktok_username}`,
      url: videoInfo.videoUrl,
      description: message,
      color: embedColor,
      thumbnail: videoInfo.thumbnailUrl ? { url: videoInfo.thumbnailUrl } : undefined,
      footer: { text: 'TikTok' },
      timestamp: new Date().toISOString(),
    };

    const sentMessage = await channel.send({ 
      content: account.mention_role_id ? `<@&${account.mention_role_id}>` : undefined,
      embeds: [embed],
    });

    // Log the notification
    if (SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/tiktok_notification_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          guild_id: account.guild_id,
          tiktok_account_id: account.id,
          tiktok_username: account.tiktok_username,
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
    console.error('[TikTok] Notification fejl:', error.message);
    return false;
  }
}

/**
 * Send Discord notification for TikTok LIVE status change
 */
async function sendTikTokLiveNotification(client, account, isLive, settings) {
  try {
    const channel = await client.channels.fetch(account.notification_channel_id).catch(() => null);
    if (!channel) return false;

    const messageTemplate = isLive
      ? (settings?.live_message || '🔴 **{username}** er nu LIVE på TikTok!')
      : (settings?.offline_message || '⚫ **{username}** er gået offline på TikTok.');

    let message = messageTemplate
      .replace(/{username}/g, account.tiktok_username);

    const embedColor = isLive ? 0xEE1D52 : 0x69C9D0;
    const liveUrl = `https://www.tiktok.com/@${account.tiktok_username}/live`;

    const embed = {
      title: isLive ? `🔴 @${account.tiktok_username} er LIVE!` : `⚫ @${account.tiktok_username} er gået offline`,
      url: isLive ? liveUrl : `https://www.tiktok.com/@${account.tiktok_username}`,
      description: message,
      color: embedColor,
      footer: { text: 'TikTok LIVE' },
      timestamp: new Date().toISOString(),
    };

    const sentMessage = await channel.send({
      content: isLive && account.mention_role_id ? `<@&${account.mention_role_id}>` : undefined,
      embeds: [embed],
    });

    // Log the notification
    if (SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/tiktok_notification_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          guild_id: account.guild_id,
          tiktok_account_id: account.id,
          tiktok_username: account.tiktok_username,
          notification_type: isLive ? 'live' : 'offline',
          channel_id: account.notification_channel_id,
          message_id: sentMessage.id,
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('[TikTok] Live notification fejl:', error.message);
    return false;
  }
}

/**
 * Check all tracked TikTok accounts for new videos
 */
async function checkAllTikTokAccounts(client, shouldHandleGuild) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[TikTok] SUPABASE_SERVICE_ROLE_KEY mangler');
    return;
  }

  try {
    // Fetch all enabled TikTok accounts
    const accountsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tiktok_accounts?enabled=eq.true&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!accountsRes.ok) {
      console.error('[TikTok] Kunne ikke hente konti:', await accountsRes.text());
      return;
    }

    const accounts = await accountsRes.json();
    if (!accounts.length) return;

    // Get unique guild IDs and fetch settings
    const guildIds = [...new Set(accounts.map(a => a.guild_id))];
    const settingsMap = {};

    for (const guildId of guildIds) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/tiktok_settings?guild_id=eq.${guildId}&select=*`,
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

      // Guild filter: resolve internal guild_id to Discord guild_id
      if (shouldHandleGuild && client) {
        const guildRes = await fetch(
          `${SUPABASE_URL}/rest/v1/guilds?id=eq.${account.guild_id}&select=guild_id`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const guildData = await guildRes.json();
        const discordGuildId = guildData[0]?.guild_id;
        if (discordGuildId && !shouldHandleGuild(discordGuildId)) continue;
      }

      // Check for new videos and live status
      const videoInfo = await checkForNewVideos(account.tiktok_username);
      checked++;

      if (!videoInfo) {
        // Update last_check_at even on failure
        await fetch(
          `${SUPABASE_URL}/rest/v1/tiktok_accounts?id=eq.${account.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ last_check_at: new Date().toISOString() }),
          }
        );
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      // Handle LIVE status change
      const liveNotificationsEnabled = guildSettings?.live_notifications !== false;
      if (liveNotificationsEnabled && client) {
        const wasLive = account.is_live || false;
        const isNowLive = videoInfo.isLive || false;

        if (isNowLive && !wasLive) {
          // Just went LIVE
          console.log(`[TikTok] @${account.tiktok_username} er nu LIVE!`);
          await sendTikTokLiveNotification(client, account, true, guildSettings);
          notified++;
        } else if (!isNowLive && wasLive) {
          // Went offline
          console.log(`[TikTok] @${account.tiktok_username} er gået offline`);
          await sendTikTokLiveNotification(client, account, false, guildSettings);
          notified++;
        }
      }

      // Handle new video
      const updateData = {
        last_check_at: new Date().toISOString(),
        is_live: videoInfo.isLive || false,
      };

      if (videoInfo.isLive) {
        updateData.last_live_at = new Date().toISOString();
      }

      if (videoInfo.videoId && videoInfo.videoId !== account.last_video_id) {
        console.log(`[TikTok] Ny video fra @${account.tiktok_username}: ${videoInfo.videoId}`);

        const guildRes = await fetch(
          `${SUPABASE_URL}/rest/v1/guilds?id=eq.${account.guild_id}&select=guild_id`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const guildData = await guildRes.json();
        const guildDiscordId = guildData[0]?.guild_id;

        const success = await sendTikTokNotification(
          client, account, videoInfo, guildSettings, guildDiscordId
        );

        if (success) {
          notified++;
          updateData.last_video_id = videoInfo.videoId;
        }
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/tiktok_accounts?id=eq.${account.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Rate limiting: wait 3 seconds between each account check
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (notified > 0) {
      console.log(`[TikTok] Checked ${checked} konti, sendte ${notified} notifikation(er)`);
    }
  } catch (error) {
    console.error('[TikTok] Check fejl:', error.message);
  }
}

/**
 * Handle TikTok link auto-embedding in messages
 */
async function handleTikTokLink(message, client) {
  if (message.author.bot) return;

  const content = message.content;
  const tiktokUrls = [...(content.match(TIKTOK_URL_REGEX) || []), ...(content.match(TIKTOK_SHORT_URL_REGEX) || [])];

  if (tiktokUrls.length === 0) return;

  // Check if guild has auto-embed enabled
  if (!SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    // Get guild internal ID
    const guildRes = await fetch(
      `${SUPABASE_URL}/rest/v1/guilds?guild_id=eq.${message.guild.id}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const guildData = await guildRes.json();
    if (!guildData.length) return;

    const internalGuildId = guildData[0].id;

    // Check settings
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tiktok_settings?guild_id=eq.${internalGuildId}&select=auto_embed_links,enabled`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const settingsData = await settingsRes.json();
    
    // If no settings exist or auto_embed is off, skip
    if (settingsData.length > 0 && (!settingsData[0].enabled || !settingsData[0].auto_embed_links)) return;

    // Process each TikTok URL (max 3 to avoid spam)
    for (const url of tiktokUrls.slice(0, 3)) {
      const oembed = await getTikTokOEmbed(url);
      if (!oembed) continue;

      const embed = {
        author: { name: oembed.author_name ? `@${oembed.author_name}` : 'TikTok' },
        title: oembed.title || 'TikTok Video',
        url: url,
        color: 0x000000,
        thumbnail: oembed.thumbnail_url ? { url: oembed.thumbnail_url } : undefined,
        footer: { text: `TikTok • ${oembed.author_name || 'Video'}` },
      };

      await message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error) {
    console.error('[TikTok] Auto-embed fejl:', error.message);
  }
}

/**
 * Start TikTok checker service
 */
function startTikTokChecker(client, config = {}) {
  const shouldHandleGuild = config.shouldHandleGuild || (() => true);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[TikTok] SUPABASE_SERVICE_ROLE_KEY mangler! TikTok checker deaktiveret.');
    return;
  }

  console.log('[TikTok] Starter TikTok checker service...');

  if (client) {
    client.once('ready', () => {
      console.log('[TikTok] Bot er klar - starter periodisk check');

      // First check after 30 seconds
      setTimeout(() => {
        checkAllTikTokAccounts(client, shouldHandleGuild);

        // Check every 5 minutes
        setInterval(() => checkAllTikTokAccounts(client, shouldHandleGuild), CHECK_INTERVAL);
      }, 30000);
    });

    // Listen for TikTok links in messages
    client.on('messageCreate', (message) => {
      if (message.guild && shouldHandleGuild(message.guild.id)) {
        handleTikTokLink(message, client).catch(() => {});
      }
    });
  } else {
    checkAllTikTokAccounts(null, shouldHandleGuild);
    setInterval(() => checkAllTikTokAccounts(null, shouldHandleGuild), CHECK_INTERVAL);
  }

  console.log('[TikTok] Service initialiseret (checker hvert 5. minut)');
}

module.exports = {
  startTikTokChecker,
  checkAllTikTokAccounts,
  handleTikTokLink,
  getTikTokOEmbed,
  sendTikTokLiveNotification,
};
