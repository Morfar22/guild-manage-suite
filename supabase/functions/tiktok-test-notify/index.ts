import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function decryptToken(encrypted: string, key: string): string {
  const bytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

async function resolveGuildBotToken(supabase: any, guildId: string): Promise<string | null> {
  try {
    const { data: customBot } = await supabase
      .from('guild_bot_settings')
      .select('bot_token_encrypted, is_custom_bot, is_active')
      .eq('guild_id', guildId)
      .eq('is_custom_bot', true)
      .eq('is_active', true)
      .maybeSingle();
    if (customBot?.bot_token_encrypted) {
      const secretKey = Deno.env.get('BOT_SECRET_KEY');
      if (secretKey) {
        const token = decryptToken(customBot.bot_token_encrypted, secretKey);
        if (token && token.length > 20) return token;
      }
    }
  } catch (_e) { /* fallback */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: 'account_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: account, error: accErr } = await supabase
      .from('tiktok_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('tiktok_settings')
      .select('*')
      .eq('guild_id', account.guild_id)
      .maybeSingle();

    const customToken = await resolveGuildBotToken(supabase, account.guild_id);
    const botToken = customToken || Deno.env.get('DISCORD_BOT_TOKEN');

    if (!botToken) {
      return new Response(JSON.stringify({ error: 'No bot token configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const embedColor = parseInt((settings?.embed_color || '#000000').replace('#', ''), 16);
    const message = (settings?.new_video_message || '🎵 **{username}** har uploadet en ny TikTok!')
      .replace(/{username}/g, account.tiktok_username)
      .replace(/{url}/g, `https://www.tiktok.com/@${account.tiktok_username}`)
      .replace(/{title}/g, '🧪 Test Video');

    const embed = {
      title: `🧪 TEST: Ny TikTok fra @${account.tiktok_username}`,
      description: message,
      url: `https://www.tiktok.com/@${account.tiktok_username}`,
      color: embedColor,
      thumbnail: account.profile_image_url ? { url: account.profile_image_url } : undefined,
      footer: { text: '⚠️ Dette er en test-notifikation' },
      timestamp: new Date().toISOString(),
    };

    const content = account.mention_role_id ? `<@&${account.mention_role_id}>` : undefined;

    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${account.notification_channel_id}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, embeds: [embed] }),
      }
    );

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error('Discord error:', discordRes.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to send Discord notification' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await discordRes.text();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TikTok test error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});