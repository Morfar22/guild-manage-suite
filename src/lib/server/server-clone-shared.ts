export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
  permission_overwrites?: unknown[];
  topic?: string;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
  hoist: boolean;
  managed: boolean;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  attachments: unknown[];
  embeds: unknown[];
  pinned: boolean;
}

export interface DiscordBan {
  user: { id: string; username: string; avatar: string | null };
  reason: string | null;
}

export interface DiscordMember {
  user: { id: string; username: string; avatar: string | null; bot?: boolean };
  nick: string | null;
  roles: string[];
  joined_at: string;
}

export interface DiscordThread {
  id: string;
  name: string;
  parent_id: string;
  type: number;
  thread_metadata?: Record<string, unknown>;
  message_count?: number;
}

export interface DiscordGuildSettings {
  name: string;
  icon: string | null;
  splash: string | null;
  banner: string | null;
  description: string | null;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  afk_channel_id: string | null;
  afk_timeout: number;
  system_channel_id: string | null;
  system_channel_flags: number;
  rules_channel_id: string | null;
  public_updates_channel_id: string | null;
  preferred_locale: string;
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch messages from a channel with pagination
export async function fetchChannelMessages(
  botToken: string,
  channelId: string,
  limit: number = 100,
): Promise<DiscordMessage[]> {
  const messages: DiscordMessage[] = [];
  let before: string | undefined;

  while (messages.length < limit) {
    const fetchLimit = Math.min(100, limit - messages.length);
    let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${fetchLimit}`;
    if (before) url += `&before=${before}`;

    await delay(500); // Rate limiting
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) break;

    const batch: DiscordMessage[] = await res.json();
    if (batch.length === 0) break;

    messages.push(...batch);
    before = batch[batch.length - 1].id;

    if (batch.length < fetchLimit) break;
  }

  return messages;
}

// Fetch all bans from a guild
export async function fetchGuildBans(
  botToken: string,
  guildId: string,
): Promise<DiscordBan[]> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/bans?limit=1000`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );

  if (!res.ok) return [];
  return await res.json();
}

// Fetch all members from a guild (paginated)
export async function fetchGuildMembers(
  botToken: string,
  guildId: string,
  limit: number = 1000,
): Promise<DiscordMember[]> {
  const members: DiscordMember[] = [];
  let after: string | undefined;

  while (members.length < limit) {
    const fetchLimit = Math.min(1000, limit - members.length);
    let url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=${fetchLimit}`;
    if (after) url += `&after=${after}`;

    await delay(500);
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) break;

    const batch: DiscordMember[] = await res.json();
    if (batch.length === 0) break;

    members.push(...batch);
    after = batch[batch.length - 1].user.id;

    if (batch.length < fetchLimit) break;
  }

  return members;
}

// Fetch threads from a guild
export async function fetchGuildThreads(
  botToken: string,
  guildId: string,
): Promise<DiscordThread[]> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.threads || [];
}

// Fetch guild settings
export async function fetchGuildSettings(
  botToken: string,
  guildId: string,
): Promise<DiscordGuildSettings | null> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!res.ok) return null;
  const guild = await res.json();

  return {
    name: guild.name,
    icon: guild.icon,
    splash: guild.splash,
    banner: guild.banner,
    description: guild.description,
    verification_level: guild.verification_level,
    default_message_notifications: guild.default_message_notifications,
    explicit_content_filter: guild.explicit_content_filter,
    afk_channel_id: guild.afk_channel_id,
    afk_timeout: guild.afk_timeout,
    system_channel_id: guild.system_channel_id,
    system_channel_flags: guild.system_channel_flags,
    rules_channel_id: guild.rules_channel_id,
    public_updates_channel_id: guild.public_updates_channel_id,
    preferred_locale: guild.preferred_locale,
  };
}
