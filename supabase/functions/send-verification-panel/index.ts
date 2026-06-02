import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { guildId } = await req.json();
    if (!guildId) {
      return new Response(JSON.stringify({ error: 'guildId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get guild's Discord ID
    const { data: guild } = await supabase
      .from('guilds')
      .select('id, guild_id')
      .eq('id', guildId)
      .single();

    if (!guild) {
      return new Response(JSON.stringify({ error: 'Guild not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get verification settings
    const { data: settings } = await supabase
      .from('verification_settings')
      .select('*')
      .eq('guild_id', guild.id)
      .single();

    if (!settings || !settings.enabled || !settings.channel_id) {
      return new Response(JSON.stringify({ error: 'Verification not configured. Enable it and select a channel first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if guild has a custom bot token
    const { data: customBot } = await supabase
      .from('custom_bots')
      .select('bot_token')
      .eq('guild_id', guild.id)
      .eq('is_active', true)
      .maybeSingle();

    const token = customBot?.bot_token || botToken;

    // Send verification panel embed via Discord API
    const embed = {
      title: '✅ Verification',
      description: settings.welcome_message || 'Klik på knappen nedenfor for at verificere dig og få adgang til serveren!',
      color: 0x5865F2,
      footer: { text: 'Tryk på knappen for at blive verificeret' },
    };

    const components = [{
      type: 1, // ActionRow
      components: [{
        type: 2, // Button
        style: 3, // Success
        label: 'Verificér mig ✅',
        custom_id: 'verify_panel_button',
      }]
    }];

    const discordRes = await fetch(`https://discord.com/api/v10/channels/${settings.channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed], components }),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error('Discord API error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send panel to Discord' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const msgData = await discordRes.json();

    // Store panel message ID in settings
    await supabase
      .from('verification_settings')
      .update({ panel_message_id: msgData.id })
      .eq('guild_id', guild.id);

    return new Response(JSON.stringify({ success: true, messageId: msgData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Send verification panel error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
