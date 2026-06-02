import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
  permission_overwrites?: any[];
  topic?: string;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
  hoist: boolean;
  managed: boolean;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: { id: string; username: string; avatar: string | null; bot?: boolean };
  content: string;
  timestamp: string;
  attachments: any[];
  embeds: any[];
  pinned: boolean;
}

interface DiscordBan {
  user: { id: string; username: string; avatar: string | null };
  reason: string | null;
}

interface DiscordMember {
  user: { id: string; username: string; avatar: string | null; bot?: boolean };
  nick: string | null;
  roles: string[];
  joined_at: string;
}

interface DiscordThread {
  id: string;
  name: string;
  parent_id: string;
  type: number;
  thread_metadata?: any;
  message_count?: number;
}

interface DiscordGuildSettings {
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

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch messages from a channel with pagination
async function fetchChannelMessages(
  botToken: string,
  channelId: string,
  limit: number = 100
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
async function fetchGuildBans(botToken: string, guildId: string): Promise<DiscordBan[]> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/bans?limit=1000`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  
  if (!res.ok) return [];
  return await res.json();
}

// Fetch all members from a guild (paginated)
async function fetchGuildMembers(
  botToken: string,
  guildId: string,
  limit: number = 1000
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
async function fetchGuildThreads(botToken: string, guildId: string): Promise<DiscordThread[]> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  
  if (!res.ok) return [];
  const data = await res.json();
  return data.threads || [];
}

// Fetch guild settings
async function fetchGuildSettings(botToken: string, guildId: string): Promise<DiscordGuildSettings | null> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log(`Authenticated user: ${userId}`);
    
    const body = await req.json();
    const { 
      action, 
      sourceGuildId, 
      targetGuildId, 
      templateId, 
      templateName, 
      templateDescription, 
      isPublic,
      // Premium options for export
      includeMessages,
      messageCount = 100,
      includeBans,
      includeMembers,
      includeThreads,
      includeServerSettings,
      // Premium options for clone/load
      loadOptions = {
        channels: true,
        roles: true,
        deleteChannels: true,
        deleteRoles: true,
        messages: false,
        bans: false,
        members: false,
        threads: false,
        settings: false,
      }
    } = body;
    
    console.log(`Action: ${action}, sourceGuildId: ${sourceGuildId}, targetGuildId: ${targetGuildId}`);

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Missing DISCORD_BOT_TOKEN secret");
    }

    // ==================== ACTION: EXPORT ====================
    if (action === "export") {
      if (!sourceGuildId) {
        return new Response(JSON.stringify({ error: "Missing sourceGuildId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user has access
      const { data: userGuild } = await supabaseAdmin
        .from("user_guilds")
        .select("has_admin_permission")
        .eq("guild_id", sourceGuildId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!userGuild?.has_admin_permission) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get Discord guild_id
      const { data: guild } = await supabaseAdmin
        .from("guilds")
        .select("guild_id, guild_name")
        .eq("id", sourceGuildId)
        .single();

      if (!guild) {
        return new Response(JSON.stringify({ error: "Guild not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch channels
      const channelsRes = await fetch(
        `https://discord.com/api/v10/guilds/${guild.guild_id}/channels`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );
      const channels: DiscordChannel[] = await channelsRes.json();

      // Fetch roles
      const rolesRes = await fetch(
        `https://discord.com/api/v10/guilds/${guild.guild_id}/roles`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );
      const roles: DiscordRole[] = await rolesRes.json();

      // Separate categories from channels
      const categories = channels
        .filter((c) => c.type === 4)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          name: c.name,
          position: c.position,
          original_id: c.id,
          permission_overwrites: c.permission_overwrites || [],
        }));

      const textAndVoiceChannels = channels
        .filter((c) => c.type !== 4)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          name: c.name,
          type: c.type,
          parent_id: c.parent_id,
          position: c.position,
          topic: c.topic,
          nsfw: c.nsfw,
          rate_limit_per_user: c.rate_limit_per_user,
          bitrate: c.bitrate,
          user_limit: c.user_limit,
          permission_overwrites: c.permission_overwrites || [],
        }));

      const everyoneRole = roles.find((r) => r.name === "@everyone");
      const filteredRoles = roles
        .filter((r) => r.name !== "@everyone" && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          name: r.name,
          color: r.color,
          permissions: r.permissions,
          mentionable: r.mentionable,
          hoist: r.hoist,
          original_id: r.id,
        }));

      // ===== PREMIUM FEATURES: Fetch additional data =====
      let messagesData: any[] = [];
      let bansData: any[] = [];
      let membersData: any[] = [];
      let threadsData: any[] = [];
      let serverSettingsData: DiscordGuildSettings | null = null;

      // Fetch messages if requested (PREMIUM)
      if (includeMessages && messageCount > 0) {
        console.log(`Fetching messages (max ${messageCount} per channel)...`);
        const textChannels = textAndVoiceChannels.filter(c => c.type === 0 || c.type === 5); // text & announcement
        for (const channel of textChannels) {
          try {
            const channelMessages = await fetchChannelMessages(
              botToken,
              (channel as any).original_id || channels.find(c => c.name === channel.name && c.type === channel.type)?.id || '',
              messageCount
            );
            
            // Find original channel ID
            const originalChannel = channels.find(c => c.name === channel.name && c.type === channel.type);
            if (originalChannel && channelMessages.length > 0) {
              messagesData.push({
                channel_id: originalChannel.id,
                channel_name: channel.name,
                messages: channelMessages.map(m => ({
                  author_id: m.author.id,
                  author_name: m.author.username,
                  author_avatar: m.author.avatar,
                  author_bot: m.author.bot || false,
                  content: m.content,
                  timestamp: m.timestamp,
                  attachments: m.attachments,
                  embeds: m.embeds,
                  pinned: m.pinned,
                })),
              });
            }
          } catch (e) {
            console.error(`Failed to fetch messages for ${channel.name}:`, e);
          }
        }
        console.log(`Fetched messages from ${messagesData.length} channels`);
      }

      // Fetch bans if requested (PREMIUM)
      if (includeBans) {
        console.log("Fetching bans...");
        const bans = await fetchGuildBans(botToken, guild.guild_id);
        bansData = bans.map(b => ({
          user_id: b.user.id,
          username: b.user.username,
          avatar: b.user.avatar,
          reason: b.reason,
        }));
        console.log(`Fetched ${bansData.length} bans`);
      }

      // Fetch members if requested (PREMIUM)
      if (includeMembers) {
        console.log("Fetching members...");
        const members = await fetchGuildMembers(botToken, guild.guild_id);
        membersData = members
          .filter(m => !m.user.bot) // Skip bots
          .map(m => ({
            user_id: m.user.id,
            username: m.user.username,
            avatar: m.user.avatar,
            nickname: m.nick,
            roles: m.roles,
            joined_at: m.joined_at,
          }));
        console.log(`Fetched ${membersData.length} members`);
      }

      // Fetch threads if requested (PREMIUM)
      if (includeThreads) {
        console.log("Fetching threads...");
        const threads = await fetchGuildThreads(botToken, guild.guild_id);
        threadsData = threads.map(t => ({
          name: t.name,
          parent_id: t.parent_id,
          type: t.type,
          metadata: t.thread_metadata,
        }));
        console.log(`Fetched ${threadsData.length} threads`);
      }

      // Fetch server settings if requested (PREMIUM)
      if (includeServerSettings) {
        console.log("Fetching server settings...");
        serverSettingsData = await fetchGuildSettings(botToken, guild.guild_id);
        console.log("Fetched server settings");
      }

      // Save template
      const { data: template, error: insertError } = await supabaseAdmin
        .from("server_templates")
        .insert({
          name: templateName || `${guild.guild_name} Template`,
          description: templateDescription || `Template created from ${guild.guild_name}`,
          guild_id: sourceGuildId,
          created_by: userId,
          is_public: isPublic || false,
          channels: textAndVoiceChannels,
          roles: filteredRoles,
          categories: categories,
          bot_settings: { 
            source_discord_guild_id: guild.guild_id,
            everyone_role_id: everyoneRole?.id || guild.guild_id
          },
          // Premium data
          messages: messagesData,
          message_count: messagesData.reduce((sum, c) => sum + c.messages.length, 0),
          bans: bansData,
          ban_count: bansData.length,
          members: membersData,
          member_count: membersData.length,
          threads: threadsData,
          thread_count: threadsData.length,
          server_settings: serverSettingsData || {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Created template ${template.id} with ${textAndVoiceChannels.length} channels, ${filteredRoles.length} roles, ${messagesData.reduce((sum, c) => sum + c.messages.length, 0)} messages`);

      return new Response(
        JSON.stringify({ success: true, template }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACTION: CLONE ====================
    if (action === "clone") {
      if (!targetGuildId) {
        return new Response(JSON.stringify({ error: "Missing targetGuildId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user has access to target guild
      const { data: targetUserGuild } = await supabaseAdmin
        .from("user_guilds")
        .select("has_admin_permission")
        .eq("guild_id", targetGuildId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!targetUserGuild?.has_admin_permission) {
        return new Response(JSON.stringify({ error: "Forbidden - no access to target guild" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get target Discord guild_id
      const { data: targetGuild } = await supabaseAdmin
        .from("guilds")
        .select("guild_id")
        .eq("id", targetGuildId)
        .single();

      if (!targetGuild) {
        return new Response(JSON.stringify({ error: "Target guild not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let categories: any[] = [];
      let channels: any[] = [];
      let roles: any[] = [];
      let messages: any[] = [];
      let bans: any[] = [];
      let members: any[] = [];
      let threads: any[] = [];
      let serverSettings: any = {};

      // If cloning from template
      if (templateId) {
        const { data: template } = await supabaseAdmin
          .from("server_templates")
          .select("*")
          .eq("id", templateId)
          .single();

        if (!template) {
          return new Response(JSON.stringify({ error: "Template not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!template.is_public && template.created_by !== userId) {
          return new Response(JSON.stringify({ error: "Forbidden - cannot access this template" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        categories = template.categories || [];
        channels = template.channels || [];
        roles = template.roles || [];
        messages = template.messages || [];
        bans = template.bans || [];
        members = template.members || [];
        threads = template.threads || [];
        serverSettings = template.server_settings || {};
      }
      // If cloning directly from another guild
      else if (sourceGuildId) {
        const { data: sourceUserGuild } = await supabaseAdmin
          .from("user_guilds")
          .select("has_admin_permission")
          .eq("guild_id", sourceGuildId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!sourceUserGuild?.has_admin_permission) {
          return new Response(JSON.stringify({ error: "Forbidden - no access to source guild" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: sourceGuild } = await supabaseAdmin
          .from("guilds")
          .select("guild_id")
          .eq("id", sourceGuildId)
          .single();

        if (!sourceGuild) {
          return new Response(JSON.stringify({ error: "Source guild not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch from Discord
        const channelsRes = await fetch(
          `https://discord.com/api/v10/guilds/${sourceGuild.guild_id}/channels`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        const channelsData = await channelsRes.json();
        if (!Array.isArray(channelsData)) {
          return new Response(JSON.stringify({ error: `Failed to fetch channels from Discord: ${channelsData?.message || 'Unknown error'}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const allChannels: DiscordChannel[] = channelsData;

        const rolesRes = await fetch(
          `https://discord.com/api/v10/guilds/${sourceGuild.guild_id}/roles`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        const rolesData = await rolesRes.json();
        if (!Array.isArray(rolesData)) {
          return new Response(JSON.stringify({ error: `Failed to fetch roles from Discord: ${rolesData?.message || 'Unknown error'}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const allRoles: DiscordRole[] = rolesData;

        categories = allChannels
          .filter((c) => c.type === 4)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({
            name: c.name,
            position: c.position,
            original_id: c.id,
            permission_overwrites: c.permission_overwrites || [],
          }));

        channels = allChannels
          .filter((c) => c.type !== 4)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({
            name: c.name,
            type: c.type,
            parent_id: c.parent_id,
            position: c.position,
            topic: c.topic,
            nsfw: c.nsfw,
            rate_limit_per_user: c.rate_limit_per_user,
            bitrate: c.bitrate,
            user_limit: c.user_limit,
            permission_overwrites: c.permission_overwrites || [],
            original_id: c.id,
          }));

        roles = allRoles
          .filter((r) => r.name !== "@everyone" && !r.managed)
          .sort((a, b) => b.position - a.position)
          .map((r) => ({
            name: r.name,
            color: r.color,
            permissions: r.permissions,
            mentionable: r.mentionable,
            hoist: r.hoist,
            original_id: r.id,
          }));

        // Fetch premium data if options are set
        if (loadOptions.bans) {
          bans = (await fetchGuildBans(botToken, sourceGuild.guild_id)).map(b => ({
            user_id: b.user.id,
            reason: b.reason,
          }));
        }
        if (loadOptions.members) {
          const fetchedMembers = await fetchGuildMembers(botToken, sourceGuild.guild_id);
          members = fetchedMembers.filter(m => !m.user.bot).map(m => ({
            user_id: m.user.id,
            nickname: m.nick,
            roles: m.roles,
          }));
        }
        if (loadOptions.settings) {
          serverSettings = await fetchGuildSettings(botToken, sourceGuild.guild_id);
        }
      } else {
        return new Response(JSON.stringify({ error: "Missing sourceGuildId or templateId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = {
        rolesCreated: 0,
        categoriesCreated: 0,
        channelsCreated: 0,
        rolesDeleted: 0,
        channelsDeleted: 0,
        messagesCreated: 0,
        bansCreated: 0,
        membersUpdated: 0,
        settingsUpdated: false,
        errors: [] as string[],
      };

      // ========== STEP 1: DELETE EXISTING CHANNELS ==========
      if (loadOptions.deleteChannels) {
        console.log("Fetching existing channels to delete...");
        const existingChannelsRes = await fetch(
          `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        const existingChannels: DiscordChannel[] = await existingChannelsRes.json();
        const nonCategoryChannels = existingChannels.filter(c => c.type !== 4);
        const categoryChannels = existingChannels.filter(c => c.type === 4);

        console.log(`Deleting ${nonCategoryChannels.length + categoryChannels.length} channels...`);

        for (const channel of [...nonCategoryChannels, ...categoryChannels]) {
          try {
            await delay(300);
            const res = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (res.ok) results.channelsDeleted++;
            else results.errors.push(`Failed to delete channel ${channel.name}`);
          } catch (e) {
            results.errors.push(`Error deleting channel ${channel.name}`);
          }
        }
      }

      // ========== STEP 2: DELETE EXISTING ROLES ==========
      if (loadOptions.deleteRoles) {
        console.log("Fetching existing roles to delete...");
        const existingRolesRes = await fetch(
          `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        const existingRoles: DiscordRole[] = await existingRolesRes.json();
        const deletableRoles = existingRoles.filter(r => r.name !== "@everyone" && !r.managed);

        console.log(`Deleting ${deletableRoles.length} roles...`);

        for (const role of deletableRoles) {
          try {
            await delay(300);
            const res = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles/${role.id}`,
              { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
            );
            if (res.ok) results.rolesDeleted++;
            else results.errors.push(`Failed to delete role ${role.name}`);
          } catch (e) {
            results.errors.push(`Error deleting role ${role.name}`);
          }
        }
      }

      // ========== STEP 3: UPDATE SERVER SETTINGS (PREMIUM) ==========
      if (loadOptions.settings && serverSettings && Object.keys(serverSettings).length > 0) {
        console.log("Updating server settings...");
        try {
          const settingsPayload: any = {};
          if (serverSettings.name) settingsPayload.name = serverSettings.name;
          if (serverSettings.description !== undefined) settingsPayload.description = serverSettings.description;
          if (serverSettings.verification_level !== undefined) settingsPayload.verification_level = serverSettings.verification_level;
          if (serverSettings.default_message_notifications !== undefined) settingsPayload.default_message_notifications = serverSettings.default_message_notifications;
          if (serverSettings.explicit_content_filter !== undefined) settingsPayload.explicit_content_filter = serverSettings.explicit_content_filter;
          if (serverSettings.afk_timeout !== undefined) settingsPayload.afk_timeout = serverSettings.afk_timeout;
          if (serverSettings.preferred_locale) settingsPayload.preferred_locale = serverSettings.preferred_locale;

          if (Object.keys(settingsPayload).length > 0) {
            await delay(500);
            const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuild.guild_id}`, {
              method: "PATCH",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(settingsPayload),
            });
            if (res.ok) results.settingsUpdated = true;
            else results.errors.push("Failed to update server settings");
          }
        } catch (e) {
          results.errors.push("Error updating server settings");
        }
      }

      // ========== STEP 4: CREATE ROLES ==========
      const roleIdMap: Record<string, string> = {};
      const categoryIdMap: Record<string, string> = {};

      roleIdMap[targetGuild.guild_id] = targetGuild.guild_id;

      if (templateId) {
        const { data: templateData } = await supabaseAdmin
          .from("server_templates")
          .select("bot_settings")
          .eq("id", templateId)
          .single();
        
        if (templateData?.bot_settings?.source_discord_guild_id) {
          roleIdMap[templateData.bot_settings.source_discord_guild_id] = targetGuild.guild_id;
        }
        if (templateData?.bot_settings?.everyone_role_id) {
          roleIdMap[templateData.bot_settings.everyone_role_id] = targetGuild.guild_id;
        }
      }

      if (sourceGuildId) {
        const { data: srcGuildData } = await supabaseAdmin
          .from("guilds")
          .select("guild_id")
          .eq("id", sourceGuildId)
          .single();
        
        if (srcGuildData?.guild_id) {
          roleIdMap[srcGuildData.guild_id] = targetGuild.guild_id;
        }
      }

      if (loadOptions.roles) {
        console.log(`Creating ${roles.length} roles...`);
        for (const role of roles) {
          try {
            await delay(500);
            const res = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles`,
              {
                method: "POST",
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: role.name,
                  color: role.color || 0,
                  permissions: role.permissions,
                  mentionable: role.mentionable,
                  hoist: role.hoist,
                }),
              }
            );
            if (res.ok) {
              const newRole = await res.json();
              if (role.original_id) roleIdMap[role.original_id] = newRole.id;
              results.rolesCreated++;
            } else {
              results.errors.push(`Failed to create role ${role.name}`);
            }
          } catch (e) {
            results.errors.push(`Error creating role ${role.name}`);
          }
        }
      }

      // Helper function to map permission overwrites
      const mapPermissionOverwrites = (overwrites: any[]): any[] => {
        if (!overwrites || !Array.isArray(overwrites)) return [];
        return overwrites
          .map((ow) => {
            if (ow.type === 0) {
              const newRoleId = roleIdMap[ow.id];
              if (newRoleId) return { id: newRoleId, type: 0, allow: ow.allow, deny: ow.deny };
              return null;
            }
            return ow;
          })
          .filter(Boolean);
      };

      // ========== STEP 5: CREATE CATEGORIES ==========
      if (loadOptions.channels) {
        console.log(`Creating ${categories.length} categories...`);
        for (const category of categories) {
          try {
            await delay(500);
            const mappedPerms = mapPermissionOverwrites(category.permission_overwrites);
            const payload: any = { name: category.name, type: 4 };
            if (mappedPerms.length > 0) payload.permission_overwrites = mappedPerms;

            const res = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`,
              {
                method: "POST",
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (res.ok) {
              const newCategory = await res.json();
              categoryIdMap[category.original_id] = newCategory.id;
              results.categoriesCreated++;
            } else {
              results.errors.push(`Failed to create category ${category.name}`);
            }
          } catch (e) {
            results.errors.push(`Error creating category ${category.name}`);
          }
        }
      }

      // ========== STEP 6: CREATE CHANNELS ==========
      const newChannelIdMap: Record<string, string> = {};
      if (loadOptions.channels) {
        console.log(`Creating ${channels.length} channels...`);
        for (const channel of channels) {
          try {
            await delay(500);
            const mappedPerms = mapPermissionOverwrites(channel.permission_overwrites);
            const payload: any = { name: channel.name, type: channel.type };
            
            if (channel.parent_id && categoryIdMap[channel.parent_id]) {
              payload.parent_id = categoryIdMap[channel.parent_id];
            }
            if (channel.topic) payload.topic = channel.topic;
            if (channel.nsfw) payload.nsfw = channel.nsfw;
            if (channel.rate_limit_per_user) payload.rate_limit_per_user = channel.rate_limit_per_user;
            if (channel.bitrate) payload.bitrate = channel.bitrate;
            if (channel.user_limit) payload.user_limit = channel.user_limit;
            if (mappedPerms.length > 0) payload.permission_overwrites = mappedPerms;

            const res = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`,
              {
                method: "POST",
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (res.ok) {
              const newChannel = await res.json();
              if (channel.original_id) newChannelIdMap[channel.original_id] = newChannel.id;
              results.channelsCreated++;
            } else {
              results.errors.push(`Failed to create channel ${channel.name}`);
            }
          } catch (e) {
            results.errors.push(`Error creating channel ${channel.name}`);
          }
        }
      }

      // ========== STEP 7: CREATE MESSAGES (PREMIUM) ==========
      if (loadOptions.messages && messages.length > 0) {
        console.log("Creating messages via webhooks...");
        for (const channelData of messages) {
          const newChannelId = newChannelIdMap[channelData.channel_id];
          if (!newChannelId) continue;

          // Create webhook for this channel
          try {
            await delay(500);
            const webhookRes = await fetch(
              `https://discord.com/api/v10/channels/${newChannelId}/webhooks`,
              {
                method: "POST",
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Message Restore" }),
              }
            );

            if (webhookRes.ok) {
              const webhook = await webhookRes.json();
              const webhookUrl = `https://discord.com/api/v10/webhooks/${webhook.id}/${webhook.token}`;

              // Send messages in reverse order (oldest first)
              const sortedMessages = [...channelData.messages].reverse();
              for (const msg of sortedMessages) {
                if (!msg.content && msg.embeds?.length === 0) continue;

                try {
                  await delay(1000); // Webhook rate limit
                  const msgRes = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      content: msg.content || undefined,
                      username: msg.author_name,
                      avatar_url: msg.author_avatar 
                        ? `https://cdn.discordapp.com/avatars/${msg.author_id}/${msg.author_avatar}.png`
                        : undefined,
                      embeds: msg.embeds?.length > 0 ? msg.embeds : undefined,
                    }),
                  });
                  if (msgRes.ok) results.messagesCreated++;
                } catch (e) {
                  // Continue on message errors
                }
              }

              // Delete webhook after use
              await fetch(`https://discord.com/api/v10/webhooks/${webhook.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bot ${botToken}` },
              });
            }
          } catch (e) {
            results.errors.push(`Error restoring messages for channel`);
          }
        }
        console.log(`Created ${results.messagesCreated} messages`);
      }

      // ========== STEP 8: CREATE BANS (PREMIUM) ==========
      if (loadOptions.bans && bans.length > 0) {
        console.log(`Creating ${bans.length} bans...`);
        for (const ban of bans) {
          try {
            await delay(500);
            const res = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/bans/${ban.user_id}`,
              {
                method: "PUT",
                headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ reason: ban.reason || "Restored from backup" }),
              }
            );
            if (res.ok) results.bansCreated++;
          } catch (e) {
            // Continue on ban errors
          }
        }
        console.log(`Created ${results.bansCreated} bans`);
      }

      // ========== STEP 9: UPDATE MEMBER NICKNAMES & ROLES (PREMIUM) ==========
      if (loadOptions.members && members.length > 0) {
        console.log(`Updating ${members.length} members...`);
        for (const member of members) {
          try {
            const payload: any = {};
            if (member.nickname) payload.nick = member.nickname;
            if (member.roles && member.roles.length > 0) {
              // Map old role IDs to new ones
              const mappedRoles = member.roles
                .map((roleId: string) => roleIdMap[roleId])
                .filter(Boolean);
              if (mappedRoles.length > 0) payload.roles = mappedRoles;
            }

            if (Object.keys(payload).length > 0) {
              await delay(500);
              const res = await fetch(
                `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/members/${member.user_id}`,
                {
                  method: "PATCH",
                  headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }
              );
              if (res.ok) results.membersUpdated++;
            }
          } catch (e) {
            // Continue on member errors (user might not be in server)
          }
        }
        console.log(`Updated ${results.membersUpdated} members`);
      }

      console.log(`Clone completed with premium features`);

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACTION: CLONE-STREAM ====================
    if (action === "clone-stream") {
      if (!targetGuildId) {
        return new Response(JSON.stringify({ error: "Missing targetGuildId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify access
      const { data: targetUserGuild } = await supabaseAdmin
        .from("user_guilds")
        .select("has_admin_permission")
        .eq("guild_id", targetGuildId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!targetUserGuild?.has_admin_permission) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetGuild } = await supabaseAdmin
        .from("guilds")
        .select("guild_id")
        .eq("id", targetGuildId)
        .single();

      if (!targetGuild) {
        return new Response(JSON.stringify({ error: "Target guild not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Set up SSE stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (type: string, payload: any) => {
            if (type === "error") {
              console.error("clone-stream error:", payload);
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, payload })}\n\n`));
          };

          const results = {
            rolesCreated: 0,
            categoriesCreated: 0,
            channelsCreated: 0,
            rolesDeleted: 0,
            channelsDeleted: 0,
            messagesCreated: 0,
            bansCreated: 0,
            membersUpdated: 0,
            errors: [] as string[],
          };

          try {
            let categories: any[] = [];
            let channels: any[] = [];
            let roles: any[] = [];
            let messages: any[] = [];
            let bans: any[] = [];
            let members: any[] = [];
            let serverSettings: any = {};

            // Load data from template or source guild
            if (templateId) {
              const { data: template } = await supabaseAdmin
                .from("server_templates")
                .select("*")
                .eq("id", templateId)
                .single();

              if (!template) {
                send("error", { error: "Template not found" });
                controller.close();
                return;
              }

              if (!template.is_public && template.created_by !== userId) {
                send("error", { error: "Forbidden" });
                controller.close();
                return;
              }

              categories = template.categories || [];
              channels = template.channels || [];
              roles = template.roles || [];
              messages = template.messages || [];
              bans = template.bans || [];
              members = template.members || [];
              serverSettings = template.server_settings || {};
            } else if (sourceGuildId) {
              const { data: sourceUserGuild } = await supabaseAdmin
                .from("user_guilds")
                .select("has_admin_permission")
                .eq("guild_id", sourceGuildId)
                .eq("user_id", userId)
                .maybeSingle();

              if (!sourceUserGuild?.has_admin_permission) {
                send("error", { error: "Forbidden" });
                controller.close();
                return;
              }

              const { data: sourceGuild } = await supabaseAdmin
                .from("guilds")
                .select("guild_id")
                .eq("id", sourceGuildId)
                .single();

              if (!sourceGuild) {
                send("error", { error: "Source guild not found" });
                controller.close();
                return;
              }

              const channelsRes = await fetch(
                `https://discord.com/api/v10/guilds/${sourceGuild.guild_id}/channels`,
                { headers: { Authorization: `Bot ${botToken}` } }
              );
              const channelsData = await channelsRes.json();
              if (!Array.isArray(channelsData)) {
                send("error", { error: `Failed to fetch channels: ${channelsData?.message || 'Unknown error'}` });
                controller.close();
                return;
              }
              const allChannels: DiscordChannel[] = channelsData;

              const rolesRes = await fetch(
                `https://discord.com/api/v10/guilds/${sourceGuild.guild_id}/roles`,
                { headers: { Authorization: `Bot ${botToken}` } }
              );
              const rolesData = await rolesRes.json();
              if (!Array.isArray(rolesData)) {
                send("error", { error: `Failed to fetch roles: ${rolesData?.message || 'Unknown error'}` });
                controller.close();
                return;
              }
              const allRoles: DiscordRole[] = rolesData;

              categories = allChannels.filter(c => c.type === 4).sort((a, b) => a.position - b.position).map(c => ({
                name: c.name, position: c.position, original_id: c.id, permission_overwrites: c.permission_overwrites || [],
              }));

              channels = allChannels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position).map(c => ({
                name: c.name, type: c.type, parent_id: c.parent_id, position: c.position,
                topic: c.topic, nsfw: c.nsfw, rate_limit_per_user: c.rate_limit_per_user,
                bitrate: c.bitrate, user_limit: c.user_limit, permission_overwrites: c.permission_overwrites || [],
                original_id: c.id,
              }));

              roles = allRoles.filter(r => r.name !== "@everyone" && !r.managed).sort((a, b) => b.position - a.position).map(r => ({
                name: r.name, color: r.color, permissions: r.permissions, mentionable: r.mentionable, hoist: r.hoist, original_id: r.id,
              }));

              // Fetch premium data if options are set
              if (loadOptions.bans) {
                bans = (await fetchGuildBans(botToken, sourceGuild.guild_id)).map(b => ({
                  user_id: b.user.id, reason: b.reason,
                }));
              }
              if (loadOptions.members) {
                const fetchedMembers = await fetchGuildMembers(botToken, sourceGuild.guild_id);
                members = fetchedMembers.filter(m => !m.user.bot).map(m => ({
                  user_id: m.user.id, nickname: m.nick, roles: m.roles,
                }));
              }
              if (loadOptions.settings) {
                serverSettings = await fetchGuildSettings(botToken, sourceGuild.guild_id);
              }
            } else {
              send("error", { error: "Missing sourceGuildId or templateId" });
              controller.close();
              return;
            }

            // Fetch existing channels and roles
            const existingChannelsRes = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            const existingChannelsData = await existingChannelsRes.json();
            if (!Array.isArray(existingChannelsData)) {
              console.error("Failed to fetch target channels:", existingChannelsData);
              send("error", { error: `Failed to fetch target channels: ${existingChannelsData?.message || 'Unknown error'}` });
              controller.close();
              return;
            }
            const existingChannels: DiscordChannel[] = existingChannelsData;
            const nonCategoryChannels = existingChannels.filter(c => c.type !== 4);
            const categoryChannels = existingChannels.filter(c => c.type === 4);

            const existingRolesRes = await fetch(
              `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            const existingRolesData = await existingRolesRes.json();
            if (!Array.isArray(existingRolesData)) {
              console.error("Failed to fetch target roles:", existingRolesData);
              send("error", { error: `Failed to fetch target roles: ${existingRolesData?.message || 'Unknown error'}` });
              controller.close();
              return;
            }
            const existingRoles: DiscordRole[] = existingRolesData;
            const deletableRoles = existingRoles.filter(r => r.name !== "@everyone" && !r.managed);

            const totalChannelsToDelete = loadOptions.deleteChannels ? nonCategoryChannels.length + categoryChannels.length : 0;
            const totalRolesToDelete = loadOptions.deleteRoles ? deletableRoles.length : 0;
            const totalToCreate = (loadOptions.roles ? roles.length : 0) + 
                                  (loadOptions.channels ? categories.length + channels.length : 0);
            const totalPremium = (loadOptions.messages ? messages.reduce((sum, c) => sum + c.messages?.length || 0, 0) : 0) +
                                 (loadOptions.bans ? bans.length : 0) +
                                 (loadOptions.members ? members.length : 0);

            // STEP 1: Delete channels
            if (loadOptions.deleteChannels) {
              let deletedChannels = 0;
              for (const channel of [...nonCategoryChannels, ...categoryChannels]) {
                try {
                  await delay(300);
                  const res = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
                    method: "DELETE", headers: { Authorization: `Bot ${botToken}` },
                  });
                  if (res.ok) results.channelsDeleted++;
                  else results.errors.push(`Failed to delete channel ${channel.name}`);
                } catch (e) {
                  results.errors.push(`Error deleting channel ${channel.name}`);
                }
                deletedChannels++;
                send("progress", {
                  phase: "deleting_channels",
                  current: deletedChannels,
                  total: totalChannelsToDelete,
                  currentItem: channel.name,
                  results,
                });
              }
            }

            // STEP 2: Delete roles
            if (loadOptions.deleteRoles) {
              let deletedRoles = 0;
              for (const role of deletableRoles) {
                try {
                  await delay(300);
                  const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles/${role.id}`, {
                    method: "DELETE", headers: { Authorization: `Bot ${botToken}` },
                  });
                  if (res.ok) results.rolesDeleted++;
                  else results.errors.push(`Failed to delete role ${role.name}`);
                } catch (e) {
                  results.errors.push(`Error deleting role ${role.name}`);
                }
                deletedRoles++;
                send("progress", {
                  phase: "deleting_roles",
                  current: deletedRoles,
                  total: totalRolesToDelete,
                  currentItem: role.name,
                  results,
                });
              }
            }

            // STEP 3: Create roles
            const roleIdMap: Record<string, string> = {};
            roleIdMap[targetGuild.guild_id] = targetGuild.guild_id;

            if (templateId) {
              const { data: templateData } = await supabaseAdmin
                .from("server_templates")
                .select("bot_settings")
                .eq("id", templateId)
                .single();
              
              if (templateData?.bot_settings?.source_discord_guild_id) {
                roleIdMap[templateData.bot_settings.source_discord_guild_id] = targetGuild.guild_id;
              }
              if (templateData?.bot_settings?.everyone_role_id) {
                roleIdMap[templateData.bot_settings.everyone_role_id] = targetGuild.guild_id;
              }
            }

            if (sourceGuildId) {
              const { data: srcGuildData } = await supabaseAdmin
                .from("guilds")
                .select("guild_id")
                .eq("id", sourceGuildId)
                .single();
              
              if (srcGuildData?.guild_id) {
                roleIdMap[srcGuildData.guild_id] = targetGuild.guild_id;
              }
            }

            let createdItems = 0;

            if (loadOptions.roles) {
              for (const role of roles) {
                try {
                  await delay(500);
                  const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuild.guild_id}/roles`, {
                    method: "POST",
                    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ name: role.name, color: role.color || 0, permissions: role.permissions, mentionable: role.mentionable, hoist: role.hoist }),
                  });
                  if (res.ok) {
                    const newRole = await res.json();
                    if (role.original_id) roleIdMap[role.original_id] = newRole.id;
                    results.rolesCreated++;
                  } else {
                    results.errors.push(`Failed to create role ${role.name}`);
                  }
                } catch (e) {
                  results.errors.push(`Error creating role ${role.name}`);
                }
                createdItems++;
                send("progress", {
                  phase: "creating_roles",
                  current: createdItems,
                  total: totalToCreate,
                  currentItem: role.name,
                  results,
                });
              }
            }

            // Permission mapping helper
            const mapPermissionOverwrites = (overwrites: any[]): any[] => {
              if (!overwrites || !Array.isArray(overwrites)) return [];
              return overwrites.map(ow => {
                if (ow.type === 0) {
                  const newRoleId = roleIdMap[ow.id];
                  if (newRoleId) return { id: newRoleId, type: 0, allow: ow.allow, deny: ow.deny };
                  return null;
                }
                return ow;
              }).filter(Boolean);
            };

            // STEP 4: Create categories
            const categoryIdMap: Record<string, string> = {};
            if (loadOptions.channels) {
              for (const category of categories) {
                try {
                  await delay(500);
                  const mappedPerms = mapPermissionOverwrites(category.permission_overwrites);
                  const payload: any = { name: category.name, type: 4 };
                  if (mappedPerms.length > 0) payload.permission_overwrites = mappedPerms;

                  const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`, {
                    method: "POST",
                    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    const newCategory = await res.json();
                    categoryIdMap[category.original_id] = newCategory.id;
                    results.categoriesCreated++;
                  } else {
                    results.errors.push(`Failed to create category ${category.name}`);
                  }
                } catch (e) {
                  results.errors.push(`Error creating category ${category.name}`);
                }
                createdItems++;
                send("progress", {
                  phase: "creating_categories",
                  current: createdItems,
                  total: totalToCreate,
                  currentItem: category.name,
                  results,
                });
              }
            }

            // STEP 5: Create channels
            const newChannelIdMap: Record<string, string> = {};
            if (loadOptions.channels) {
              for (const channel of channels) {
                try {
                  await delay(500);
                  const mappedPerms = mapPermissionOverwrites(channel.permission_overwrites);
                  const payload: any = { name: channel.name, type: channel.type };
                  if (channel.parent_id && categoryIdMap[channel.parent_id]) payload.parent_id = categoryIdMap[channel.parent_id];
                  if (channel.topic) payload.topic = channel.topic;
                  if (channel.nsfw) payload.nsfw = channel.nsfw;
                  if (channel.rate_limit_per_user) payload.rate_limit_per_user = channel.rate_limit_per_user;
                  if (channel.bitrate) payload.bitrate = channel.bitrate;
                  if (channel.user_limit) payload.user_limit = channel.user_limit;
                  if (mappedPerms.length > 0) payload.permission_overwrites = mappedPerms;

                  const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuild.guild_id}/channels`, {
                    method: "POST",
                    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    const newChannel = await res.json();
                    if (channel.original_id) newChannelIdMap[channel.original_id] = newChannel.id;
                    results.channelsCreated++;
                  } else {
                    results.errors.push(`Failed to create channel ${channel.name}`);
                  }
                } catch (e) {
                  results.errors.push(`Error creating channel ${channel.name}`);
                }
                createdItems++;
                send("progress", {
                  phase: "creating_channels",
                  current: createdItems,
                  total: totalToCreate,
                  currentItem: channel.name,
                  results,
                });
              }
            }

            // STEP 6: Premium features - Messages
            if (loadOptions.messages && messages.length > 0) {
              let messageProgress = 0;
              const totalMessages = messages.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
              
              send("progress", {
                phase: "creating_messages",
                current: 0,
                total: totalMessages,
                currentItem: "Starting message restoration...",
                results,
              });

              for (const channelData of messages) {
                const newChannelId = newChannelIdMap[channelData.channel_id];
                if (!newChannelId) continue;

                try {
                  await delay(500);
                  const webhookRes = await fetch(
                    `https://discord.com/api/v10/channels/${newChannelId}/webhooks`,
                    {
                      method: "POST",
                      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ name: "Message Restore" }),
                    }
                  );

                  if (webhookRes.ok) {
                    const webhook = await webhookRes.json();
                    const webhookUrl = `https://discord.com/api/v10/webhooks/${webhook.id}/${webhook.token}`;

                    const sortedMessages = [...(channelData.messages || [])].reverse();
                    for (const msg of sortedMessages) {
                      if (!msg.content && (!msg.embeds || msg.embeds.length === 0)) continue;

                      try {
                        await delay(1000);
                        const msgRes = await fetch(webhookUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            content: msg.content || undefined,
                            username: msg.author_name,
                            avatar_url: msg.author_avatar 
                              ? `https://cdn.discordapp.com/avatars/${msg.author_id}/${msg.author_avatar}.png`
                              : undefined,
                            embeds: msg.embeds?.length > 0 ? msg.embeds : undefined,
                          }),
                        });
                        if (msgRes.ok) results.messagesCreated++;
                      } catch (e) {
                        // Continue
                      }
                      messageProgress++;
                      send("progress", {
                        phase: "creating_messages",
                        current: messageProgress,
                        total: totalMessages,
                        currentItem: channelData.channel_name,
                        results,
                      });
                    }

                    await fetch(`https://discord.com/api/v10/webhooks/${webhook.id}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bot ${botToken}` },
                    });
                  }
                } catch (e) {
                  results.errors.push(`Error restoring messages`);
                }
              }
            }

            // STEP 7: Premium features - Bans
            if (loadOptions.bans && bans.length > 0) {
              let banProgress = 0;
              for (const ban of bans) {
                try {
                  await delay(500);
                  const res = await fetch(
                    `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/bans/${ban.user_id}`,
                    {
                      method: "PUT",
                      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: ban.reason || "Restored from backup" }),
                    }
                  );
                  if (res.ok) results.bansCreated++;
                } catch (e) {
                  // Continue
                }
                banProgress++;
                send("progress", {
                  phase: "creating_bans",
                  current: banProgress,
                  total: bans.length,
                  currentItem: `Ban ${banProgress}/${bans.length}`,
                  results,
                });
              }
            }

            // STEP 8: Premium features - Members
            if (loadOptions.members && members.length > 0) {
              let memberProgress = 0;
              for (const member of members) {
                try {
                  const payload: any = {};
                  if (member.nickname) payload.nick = member.nickname;
                  if (member.roles && member.roles.length > 0) {
                    const mappedRoles = member.roles.map((roleId: string) => roleIdMap[roleId]).filter(Boolean);
                    if (mappedRoles.length > 0) payload.roles = mappedRoles;
                  }

                  if (Object.keys(payload).length > 0) {
                    await delay(500);
                    const res = await fetch(
                      `https://discord.com/api/v10/guilds/${targetGuild.guild_id}/members/${member.user_id}`,
                      {
                        method: "PATCH",
                        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      }
                    );
                    if (res.ok) results.membersUpdated++;
                  }
                } catch (e) {
                  // Continue
                }
                memberProgress++;
                send("progress", {
                  phase: "updating_members",
                  current: memberProgress,
                  total: members.length,
                  currentItem: `Member ${memberProgress}/${members.length}`,
                  results,
                });
              }
            }

            send("complete", { results });
            controller.close();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            console.error("clone-stream fatal error:", err);
            send("error", { error: errMsg });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // ==================== ACTION: LIST-TEMPLATES ====================
    if (action === "list-templates") {
      const { data: templates } = await supabaseAdmin
        .from("server_templates")
        .select("*")
        .or(`created_by.eq.${userId},is_public.eq.true`)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({ templates: templates || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACTION: DELETE-TEMPLATE ====================
    if (action === "delete-template") {
      if (!templateId) {
        return new Response(JSON.stringify({ error: "Missing templateId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("server_templates")
        .delete()
        .eq("id", templateId)
        .eq("created_by", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("server-clone error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
