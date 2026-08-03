// @ts-nocheck
// Migrated from Supabase Edge Function `send-embed` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotTokenForGuild(supabase: any, guildId: string): Promise<string> {
  const { data: settings } = await supabase
    .from('guild_bot_settings')
    .select('is_custom_bot, is_active, bot_token_encrypted')
    .eq('guild_id', guildId)
    .eq('is_custom_bot', true)
    .eq('is_active', true)
    .maybeSingle();

  const encryptionKey = __env('BOT_SECRET_KEY') || 'default-encryption-key';

  if (settings?.bot_token_encrypted) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
    } catch (e) {
      console.error('Failed to decrypt custom bot token, falling back to global:', e.message);
    }
  }

  const globalToken = __env('DISCORD_BOT_TOKEN');
  if (!globalToken) throw new Error('Bot token not configured');
  return globalToken;
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guildId, channelId, embed, buttons } = await req.json();
    if (!guildId || !channelId || !embed) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = __env('SUPABASE_URL')!;
    const supabaseKey = __env('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // guild_bot_settings is keyed by the internal guild UUID from the app
    const botToken = await getBotTokenForGuild(supabase, guildId);

    // Build Discord embed object
    const discordEmbed: any = {};
    if (embed.title) discordEmbed.title = embed.title;
    if (embed.description) discordEmbed.description = embed.description;
    if (embed.color) discordEmbed.color = parseInt(embed.color.replace('#', ''), 16);
    if (embed.footer) discordEmbed.footer = { text: embed.footer };
    if (embed.thumbnail) discordEmbed.thumbnail = { url: embed.thumbnail };
    if (embed.image) discordEmbed.image = { url: embed.image };
    if (embed.author) discordEmbed.author = embed.author;
    if (embed.timestamp) discordEmbed.timestamp = new Date().toISOString();
    if (embed.fields && embed.fields.length > 0) {
      discordEmbed.fields = embed.fields.map((f: any) => ({
        name: f.name || '\u200b',
        value: f.value || '\u200b',
        inline: f.inline ?? false,
      }));
    }

    // Build Discord components (link buttons)
    const allButtons = buttons || embed.buttons || [];
    const components: any[] = [];
    if (allButtons.length > 0) {
      components.push({
        type: 1, // ACTION_ROW
        components: allButtons.slice(0, 5).map((btn: any) => {
          const button: any = {
            type: 2, // BUTTON
            style: 5, // LINK
            label: btn.label || 'Link',
            url: btn.url,
          };
          if (btn.emoji) {
            // Support unicode emoji
            const emojiRegex = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0F]/u;
            if (emojiRegex.test(btn.emoji)) {
              button.emoji = { name: btn.emoji };
            }
          }
          return button;
        }),
      });
    }

    const body: any = { embeds: [discordEmbed] };
    if (components.length > 0) body.components = components;

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `Discord API error: ${err}` }), { status: response.status, headers: corsHeaders });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, messageId: data.id }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/send-embed')({
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
