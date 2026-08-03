// @ts-nocheck
// Migrated from Supabase Edge Function `send-poll` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
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
      console.error('Failed to decrypt custom bot token, falling back to global:', e instanceof Error ? e.message : String(e));
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
    const { pollId } = await req.json();
    if (!pollId) {
      return new Response(JSON.stringify({ error: 'Missing pollId' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = __env('SUPABASE_URL')!;
    const supabaseKey = __env('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) {
      return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404, headers: corsHeaders });
    }

    if (!poll.channel_id) {
      return new Response(JSON.stringify({ error: 'No channel_id set' }), { status: 400, headers: corsHeaders });
    }

    const botToken = await getBotTokenForGuild(supabase, poll.guild_id);

    // Build the embed
    const options = (poll.options || []) as Array<{ label: string; votes: number; voters: string[] }>;
    const description = options.map((o: any, i: number) => `**${i + 1}.** ${o.label}`).join('\n');
    const votes = (poll.votes || {}) as Record<string, any>;

    const embed: any = {
      title: `📊 ${poll.question}`,
      description,
      color: 0x5865F2,
      timestamp: new Date().toISOString(),
    };

    if (poll.ends_at) {
      embed.footer = { text: `Slutter: ${new Date(poll.ends_at).toLocaleString('da-DK')}` };
    } else {
      embed.footer = { text: 'Ingen tidsfrist' };
    }

    if (votes.created_by_name) {
      embed.author = { name: `Oprettet af ${votes.created_by_name}` };
    }

    // Build vote buttons (max 5 per row, max 2 rows = 10 options)
    const components: any[] = [];
    for (let i = 0; i < options.length; i += 5) {
      const row: any = { type: 1, components: [] };
      const chunk = options.slice(i, i + 5);
      chunk.forEach((o: any, j: number) => {
        row.components.push({
          type: 2,
          style: 1, // Primary
          label: o.label.slice(0, 80),
          custom_id: `poll_vote_${poll.id}_${i + j}`,
        });
      });
      components.push(row);
    }

    // Send to Discord
    const response = await fetch(`https://discord.com/api/v10/channels/${poll.channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed], components }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Discord API error:', err);
      return new Response(JSON.stringify({ error: `Discord API error: ${err}` }), { status: response.status, headers: corsHeaders });
    }

    const data = await response.json();

    // Save message_id back to the poll
    await supabase
      .from('polls')
      .update({ message_id: data.id })
      .eq('id', pollId);

    console.log(`[SendPoll] ✅ Sent poll "${poll.question}" to channel ${poll.channel_id}, message ${data.id}`);

    return new Response(JSON.stringify({ success: true, messageId: data.id }), { headers: corsHeaders });
  } catch (e) {
    console.error('[SendPoll] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/send-poll')({
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
