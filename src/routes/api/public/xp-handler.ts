// @ts-nocheck
// Migrated from Supabase Edge Function `xp-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
};

// Helper function to check if IP is whitelisted
async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { count } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) === 0) return { allowed: true, ip: clientIp };

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

interface XPRequest {
  guild_id?: string;
  user_id?: string;
  username?: string;
  channel_id?: string;
  user_roles?: string[];
  action?: string;
  guildId?: string;
  level?: number;
  is_voice?: boolean;
}

// Calculate level from XP using a simple formula
function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// Calculate XP needed for a specific level
function xpForLevel(level: number): number {
  return Math.pow((level - 1) * 10, 2);
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as XPRequest;
    const action = body.action;

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let botToken = __env('DISCORD_BOT_TOKEN');

    // Dashboard action - verify JWT
    if (action === 'testLevelUp') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: claims, error: authError } = await supabase.auth.getUser(token);
      if (authError || !claims?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { guildId, username, level } = body;

      // Get guild using internal ID
      const { data: guild } = await supabase
        .from('guilds')
        .select('id, guild_id, guild_name')
        .eq('id', guildId)
        .single();
      
      if (!guild) {
        return new Response(JSON.stringify({ error: 'Guild not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get leveling settings
      const { data: settings } = await supabase
        .from('leveling_settings')
        .select('*')
        .eq('guild_id', guild.id)
        .maybeSingle();

      const channelId = settings?.level_up_channel_id;
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'No level-up channel configured' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve custom bot token if configured
      const encryptionKey = __env('BOT_SECRET_KEY') || '';
      const { data: customBotSettings } = await supabase
        .from('guild_bot_settings')
        .select('bot_token_encrypted, is_custom_bot, is_active')
        .eq('guild_id', guild.id)
        .eq('is_custom_bot', true)
        .eq('is_active', true)
        .maybeSingle();

      if (customBotSettings?.bot_token_encrypted && encryptionKey) {
        try {
          const text = atob(customBotSettings.bot_token_encrypted);
          let decrypted = '';
          for (let i = 0; i < text.length; i++) {
            decrypted += String.fromCharCode(text.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length));
          }
          if (decrypted) {
            botToken = decrypted;
            console.log(`Using custom bot token for guild ${guild.id}`);
          }
        } catch (e) {
          console.error('Failed to decrypt custom bot token:', e);
        }
      }

      const testUsername = username || 'TestUser';
      const testLevel = level || 5;
      const levelUpMessage = (settings?.level_up_message || 'Congratulations {user}! You are now level {level}! 🎉')
        .replace('{user}', `@${testUsername}`)
        .replace('{level}', String(testLevel))
        .replace('{xp}', String(xpForLevel(testLevel)));

      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [{
              title: '🧪 TEST - Level Up! 🎉',
              description: levelUpMessage,
              color: 0x5865F2,
              fields: [
                { name: '👤 User', value: `@${testUsername}`, inline: true },
                { name: '📊 New Level', value: String(testLevel), inline: true },
                { name: '⭐ Total XP', value: `${xpForLevel(testLevel).toLocaleString()} XP`, inline: true },
              ],
              footer: { text: `${guild.guild_name} • 🧪 This is a TEST message` },
              timestamp: new Date().toISOString(),
            }],
          }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Discord API error (test level up):', res.status, errorText);
        return new Response(JSON.stringify({ error: `Discord API error: ${errorText}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🧪 Test level-up message sent in guild ${guildId}`);

      return new Response(JSON.stringify({ success: true, message: 'Test level-up message sent!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bot action - verify bot secret
    const botSecret = req.headers.get('x-bot-secret');
    const expectedSecret = __env('BOT_SECRET_KEY');
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error('Unauthorized: Invalid bot secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check IP whitelist for bot requests
    const ipCheck = await checkIPWhitelist(req, supabase);
    if (!ipCheck.allowed) {
      console.error(`IP not whitelisted: ${ipCheck.ip}`);
      return new Response(JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { guild_id, user_id, username, channel_id, user_roles = [], is_voice = false } = body;

    if (!guild_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing guild_id or user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get guild UUID from guild_id (Discord ID)
    const { data: guild, error: guildError } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guild_id)
      .maybeSingle();

    if (guildError || !guild) {
      console.error('Guild not found:', guildError);
      return new Response(JSON.stringify({ error: 'Guild not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guildUuid = guild.id;

    // Check leveling settings
    const { data: settings } = await supabase
      .from('leveling_settings')
      .select('*')
      .eq('guild_id', guildUuid)
      .maybeSingle();

    // If leveling is disabled, return early
    if (settings && !settings.enabled) {
      return new Response(JSON.stringify({ message: 'Leveling disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if voice XP is enabled for voice requests
    if (is_voice && (!settings?.voice_xp_enabled)) {
      return new Response(JSON.stringify({ message: 'Voice XP disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check blacklist channels
    const blacklistChannels: string[] = settings?.blacklist_channels || [];
    if (channel_id && blacklistChannels.includes(channel_id)) {
      return new Response(JSON.stringify({ message: 'Channel is blacklisted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get XP multipliers
    const { data: multipliers } = await supabase
      .from('xp_multipliers')
      .select('*')
      .eq('guild_id', guildUuid)
      .eq('enabled', true);

    // Calculate total multiplier
    let totalMultiplier = 1.0;
    const now = new Date();

    if (multipliers && multipliers.length > 0) {
      for (const mult of multipliers) {
        // Check time constraints
        if (mult.starts_at && new Date(mult.starts_at) > now) continue;
        if (mult.ends_at && new Date(mult.ends_at) < now) continue;

        // Check type
        if (mult.multiplier_type === 'global') {
          totalMultiplier *= mult.multiplier;
        } else if (mult.multiplier_type === 'channel' && channel_id === mult.target_id) {
          totalMultiplier *= mult.multiplier;
        } else if (mult.multiplier_type === 'role' && user_roles.includes(mult.target_id)) {
          totalMultiplier *= mult.multiplier;
        }
      }
    }

    const xpMin = is_voice 
      ? settings?.voice_xp_per_minute || 5 
      : settings?.xp_per_message_min || 15;
    const xpMax = is_voice 
      ? settings?.voice_xp_per_minute || 5 
      : settings?.xp_per_message_max || 25;
    const cooldownSeconds = is_voice 
      ? settings?.voice_xp_cooldown_seconds || 60 
      : settings?.cooldown_seconds || 60;

    // Get or create user level record
    const { data: userLevel } = await supabase
      .from('user_levels')
      .select('*')
      .eq('guild_id', guildUuid)
      .eq('user_id', user_id)
      .maybeSingle();

    const nowTime = new Date();

    // Check cooldown
    if (userLevel?.last_message_at) {
      const lastMessage = new Date(userLevel.last_message_at);
      const diffSeconds = (nowTime.getTime() - lastMessage.getTime()) / 1000;
      
      if (diffSeconds < cooldownSeconds) {
        return new Response(JSON.stringify({ 
          message: 'On cooldown',
          remaining_seconds: Math.ceil(cooldownSeconds - diffSeconds)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Calculate random XP with multiplier
    const baseXp = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;
    const xpGained = Math.round(baseXp * totalMultiplier);
    
    let newXp: number;
    let newLevel: number;
    let oldLevel: number;
    let totalMessages: number;
    let leveledUp = false;

    if (userLevel) {
      oldLevel = userLevel.level;
      newXp = userLevel.xp + xpGained;
      newLevel = calculateLevel(newXp);
      totalMessages = userLevel.total_messages + (is_voice ? 0 : 1);
      leveledUp = newLevel > oldLevel;

      const { error: updateError } = await supabase
        .from('user_levels')
        .update({
          xp: newXp,
          level: newLevel,
          total_messages: totalMessages,
          last_message_at: nowTime.toISOString(),
          discord_username: username,
        })
        .eq('id', userLevel.id);

      if (updateError) {
        console.error('Error updating user level:', updateError);
        throw updateError;
      }
    } else {
      oldLevel = 0;
      newXp = xpGained;
      newLevel = calculateLevel(newXp);
      totalMessages = is_voice ? 0 : 1;
      leveledUp = true;

      const { error: insertError } = await supabase
        .from('user_levels')
        .insert({
          guild_id: guildUuid,
          user_id,
          discord_username: username,
          xp: newXp,
          level: newLevel,
          total_messages: totalMessages,
          last_message_at: nowTime.toISOString(),
        });

      if (insertError) {
        console.error('Error inserting user level:', insertError);
        throw insertError;
      }
    }

    // Check for level roles to assign
    let rolesToAssign: string[] = [];
    if (leveledUp && newLevel > 1) {
      const { data: levelRoles } = await supabase
        .from('level_roles')
        .select('role_id')
        .eq('guild_id', guildUuid)
        .lte('level_required', newLevel)
        .gt('level_required', oldLevel);

      if (levelRoles && levelRoles.length > 0) {
        rolesToAssign = levelRoles.map(r => r.role_id);
      }
    }

    // Get level up message settings
    let levelUpResponse: any = null;
    if (leveledUp && newLevel > 1) {
      const levelUpMessage = settings?.level_up_message || 'Congratulations {user}! You are now level {level}! 🎉';
      const levelUpChannelId = settings?.level_up_channel_id;

      levelUpResponse = {
        should_announce: true,
        channel_id: levelUpChannelId,
        message: levelUpMessage
          .replace('{user}', `<@${user_id}>`)
          .replace('{level}', String(newLevel))
          .replace('{xp}', String(newXp)),
        roles_to_assign: rolesToAssign,
      };
    }

    const xpSource = is_voice ? 'voice' : 'message';
    const multiplierInfo = totalMultiplier > 1 ? ` (${totalMultiplier}x multiplier)` : '';
    console.log(`XP granted to ${username} via ${xpSource}: +${xpGained} XP${multiplierInfo} (total: ${newXp}, level: ${newLevel})`);

    return new Response(JSON.stringify({
      success: true,
      xp_gained: xpGained,
      total_xp: newXp,
      level: newLevel,
      leveled_up: leveledUp && newLevel > 1,
      level_up: levelUpResponse,
      xp_for_next_level: xpForLevel(newLevel + 1),
      multiplier: totalMultiplier,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('XP handler error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/xp-handler')({
  server: {
    handlers: {
      GET: __call,
      POST: __call,
      PUT: __call,
      PATCH: __call,
      DELETE: __call,
      OPTIONS: __call,
    },
  },
})
