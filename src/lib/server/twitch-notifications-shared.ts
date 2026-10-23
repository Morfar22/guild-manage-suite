/** Pure Twitch notification rendering shared by the dashboard and Edge runtime. */
export interface PartnerProgress {
  quota_type?: string | null;
  quota_hours_per_week?: number | null;
  quota_streams_per_week?: number | null;
  current_week_minutes?: number | null;
  current_week_streams?: number | null;
}

export interface TwitchNotificationSettings {
  live_embed_color?: string | null;
  offline_embed_color?: string | null;
  show_game?: boolean;
  show_viewers?: boolean;
  show_thumbnail?: boolean;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  is_mature: boolean;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
}

export interface TwitchVideo {
  id: string;
  stream_id: string | null;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string; // 'archive', 'highlight', 'upload'
  duration: string;
}

export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function describeProgress(streamer: PartnerProgress): {
  progress: string;
  goal: string;
  met: boolean;
} {
  const qt = streamer.quota_type || "streams";
  const hours = (streamer.current_week_minutes || 0) / 60;
  if (qt === "hours") {
    const goal = Number(streamer.quota_hours_per_week || 0);
    return {
      progress: `${hours.toFixed(1)}t`,
      goal: `${goal}t`,
      met: hours >= goal,
    };
  }
  if (qt === "both") {
    const sGoal = streamer.quota_streams_per_week || 0;
    const hGoal = Number(streamer.quota_hours_per_week || 0);
    const sNow = streamer.current_week_streams || 0;
    return {
      progress: `${sNow} streams / ${hours.toFixed(1)}t`,
      goal: `${sGoal} streams / ${hGoal}t`,
      met: sNow >= sGoal && hours >= hGoal,
    };
  }
  // streams
  const sGoal = streamer.quota_streams_per_week || 0;
  const sNow = streamer.current_week_streams || 0;
  return {
    progress: `${sNow} streams`,
    goal: `${sGoal} streams`,
    met: sNow >= sGoal,
  };
}

export function formatMessage(
  template: string,
  data: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{${key}}`, "g"), value);
  }
  return result;
}

export function createLiveEmbed(
  stream: TwitchStream,
  user: TwitchUser,
  settings: TwitchNotificationSettings,
  message: string,
): Record<string, unknown> {
  const thumbnailUrl = stream.thumbnail_url
    .replace("{width}", "1280")
    .replace("{height}", "720");

  // Calculate stream uptime
  const startedAt = new Date(stream.started_at);
  const now = new Date();
  const uptimeMs = now.getTime() - startedAt.getTime();
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  const uptimeStr = hours > 0 ? `${hours}t ${minutes}m` : `${minutes}m`;

  const embed: Record<string, unknown> = {
    title: `🔴 LIVE: ${stream.title}`,
    url: `https://twitch.tv/${stream.user_login}`,
    color: parseInt(
      (settings.live_embed_color || "#9146FF").replace("#", ""),
      16,
    ),
    author: {
      name: `${user.display_name} er nu LIVE på Twitch!`,
      url: `https://twitch.tv/${stream.user_login}`,
      icon_url: user.profile_image_url,
    },
    description: `**[Klik her for at se streamen](https://twitch.tv/${stream.user_login})**`,
    timestamp: new Date().toISOString(),
  };

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  if (settings.show_game !== false && stream.game_name) {
    fields.push({ name: "🎮 Spil", value: stream.game_name, inline: true });
  }

  if (settings.show_viewers !== false) {
    fields.push({
      name: "👀 Seere",
      value: stream.viewer_count.toLocaleString(),
      inline: true,
    });
  }

  // Add uptime field
  fields.push({ name: "⏱️ Uptime", value: uptimeStr, inline: true });

  embed.fields = fields;

  if (settings.show_thumbnail !== false) {
    embed.image = { url: `${thumbnailUrl}?t=${Date.now()}` };
  }

  embed.thumbnail = { url: user.profile_image_url };
  embed.footer = {
    text: `Twitch • ${stream.language?.toUpperCase() || "DA"}`,
    icon_url:
      "https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png",
  };

  return embed;
}

export function createOfflineEmbed(
  user: TwitchUser,
  settings: TwitchNotificationSettings,
  message: string,
): Record<string, unknown> {
  return {
    description: message,
    color: parseInt(
      (settings.offline_embed_color || "#6441A5").replace("#", ""),
      16,
    ),
    thumbnail: { url: user.profile_image_url },
    footer: {
      text: "Twitch",
      icon_url:
        "https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png",
    },
    timestamp: new Date().toISOString(),
  };
}
