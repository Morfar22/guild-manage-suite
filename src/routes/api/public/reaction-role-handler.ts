// @ts-nocheck
// Migrated from Supabase Edge Function `reaction-role-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


// Simple decryption using XOR with a key
function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

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

interface ReactionRoleRequest {
  guild_id: string;
  user_id: string;
  message_id: string;
  emoji: string;
  action: 'add' | 'remove' | 'send_panel';
  panel_id?: string;
  channel_id?: string;
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as ReactionRoleRequest;
    const { guild_id, user_id, message_id, emoji, action, panel_id, channel_id } = body;

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // For send_panel action, allow JWT auth from dashboard users
    if (action === 'send_panel') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('Unauthorized: Missing auth token for send_panel');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create a client with user's auth to verify they have access
      const userSupabase = createClient(
        __env('SUPABASE_URL')!,
        __env('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        console.error('Unauthorized: Invalid JWT token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Authenticated user for send_panel:', claimsData.claims.sub);
    } else {
      // For bot actions (add/remove reactions), verify bot secret
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
    }

    // Handle send_panel action (from dashboard)
    if (action === 'send_panel') {
      if (!panel_id || !channel_id) {
        return new Response(JSON.stringify({ error: 'Missing panel_id or channel_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the panel
      const { data: panel, error: panelError } = await supabase
        .from('reaction_role_panels')
        .select('*')
        .eq('id', panel_id)
        .single();

      if (panelError || !panel) {
        console.error('Panel not found:', panelError);
        return new Response(JSON.stringify({ error: 'Panel not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get Discord guild_id from the guild
      const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('guild_id')
        .eq('id', panel.guild_id)
        .single();

      if (guildError || !guild) {
        console.error('Guild not found:', guildError);
        return new Response(JSON.stringify({ error: 'Guild not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get reaction roles for this guild to include in the embed
      const { data: reactionRoles } = await supabase
        .from('reaction_roles')
        .select('*')
        .eq('guild_id', panel.guild_id);

      // Build embed description with reaction roles info
      let description = panel.description || '';
      if (reactionRoles && reactionRoles.length > 0) {
        description += '\n\n**Available roles:**\n';
        reactionRoles.forEach((rr) => {
          description += `${rr.emoji} → <@&${rr.role_id}>${rr.description ? ` - ${rr.description}` : ''}\n`;
        });
      }

      // Parse color to decimal
      const colorHex = (panel.color || '#5865F2').replace('#', '');
      const colorDecimal = parseInt(colorHex, 16);

      // Helper to parse emoji - supports unicode and custom <:name:id>/<a:name:id>
      const parseEmoji = (emoji: string) => {
        const trimmedEmoji = emoji.trim();

        // Custom emoji format: <:name:id> or <a:name:id>
        const customMatch = trimmedEmoji.match(/^<(a)?:(\w+):(\d+)>$/);
        if (customMatch) {
          return { name: customMatch[2], id: customMatch[3], animated: !!customMatch[1] };
        }

        // Shortcode format like :smile: is not valid for Discord component emoji payloads
        if (/^:[^\s:]+:$/.test(trimmedEmoji)) {
          return null;
        }

        // Unicode emoji - only allow likely emoji glyphs, otherwise skip it
        if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F]/u.test(trimmedEmoji)) {
          return { name: trimmedEmoji };
        }

        return null;
      };

      // Build button components for each reaction role
      const buttons = [];
      if (reactionRoles && reactionRoles.length > 0) {
        for (const rr of reactionRoles) {
          const emojiData = parseEmoji(rr.emoji);
          const button: Record<string, unknown> = {
            type: 2, // Button
            style: 1, // Primary (blue)
            label: rr.role_name || 'Get role',
            custom_id: `reaction_role:${rr.role_id}`,
          };
          // Only add emoji if it's valid (not a shortcode)
          if (emojiData) {
            button.emoji = emojiData;
          }
          buttons.push(button);
        }
      }

      // Group buttons into action rows (max 5 buttons per row)
      const actionRows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        actionRows.push({
          type: 1, // Action Row
          components: buttons.slice(i, i + 5),
        });
      }

      // Check if this guild has a custom bot configured
      const { data: customBotSettings } = await supabase
        .from('guild_bot_settings')
        .select('bot_token_encrypted, is_custom_bot, is_active')
        .eq('guild_id', panel.guild_id)
        .eq('is_custom_bot', true)
        .maybeSingle();

      const encryptionKey = __env('BOT_SECRET_KEY') || 'default-encryption-key';
      let DISCORD_BOT_TOKEN: string | null = null;

      if (customBotSettings?.bot_token_encrypted && customBotSettings.is_custom_bot) {
        DISCORD_BOT_TOKEN = simpleDecrypt(customBotSettings.bot_token_encrypted, encryptionKey);
        console.log(`Using custom bot token for guild ${guild.guild_id}`);
      } else {
        DISCORD_BOT_TOKEN = __env('DISCORD_BOT_TOKEN') || null;
        console.log(`Using global bot token for guild ${guild.guild_id}`);
      }
      const messagePayload: Record<string, unknown> = {
        embeds: [{
          title: panel.title,
          description,
          color: colorDecimal,
          footer: {
            text: 'Click a button to get/remove a role',
          },
        }],
      };

      // Only add components if there are buttons
      if (actionRows.length > 0) {
        messagePayload.components = actionRows;
      }

      const discordResponse = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (!discordResponse.ok) {
        const error = await discordResponse.text();
        console.error('Discord API error:', error);
        return new Response(JSON.stringify({ error: 'Failed to send embed to Discord' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const discordMessage = await discordResponse.json();
      
      // Update panel with channel_id and message_id
      await supabase
        .from('reaction_role_panels')
        .update({ 
          channel_id, 
          message_id: discordMessage.id 
        })
        .eq('id', panel_id);

      // Add reactions to the message for each reaction role
      if (reactionRoles && reactionRoles.length > 0) {
        for (const rr of reactionRoles) {
          try {
            // Encode emoji for URL (handles unicode emojis)
            const encodedEmoji = encodeURIComponent(rr.emoji);
            await fetch(
              `https://discord.com/api/v10/channels/${channel_id}/messages/${discordMessage.id}/reactions/${encodedEmoji}/@me`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                },
              }
            );
          } catch (e) {
            console.error('Failed to add reaction:', rr.emoji, e);
          }
        }
      }

      console.log(`Panel sent to channel ${channel_id}, message ${discordMessage.id}`);

      return new Response(JSON.stringify({
        success: true,
        message_id: discordMessage.id,
        channel_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Original reaction role handling
    if (!guild_id || !user_id || !message_id || !emoji || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
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

    // Find the reaction role for this message and emoji
    const { data: reactionRole, error: rrError } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('message_id', message_id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (rrError) {
      console.error('Error fetching reaction role:', rrError);
      throw rrError;
    }

    if (!reactionRole) {
      // No reaction role configured for this message/emoji combo
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No reaction role configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the role to add/remove - the bot will handle the Discord API call
    console.log(`Reaction role ${action}: ${reactionRole.role_name} for user ${user_id}`);

    return new Response(JSON.stringify({
      success: true,
      action,
      role_id: reactionRole.role_id,
      role_name: reactionRole.role_name,
      user_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reaction role handler error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/reaction-role-handler')({
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
