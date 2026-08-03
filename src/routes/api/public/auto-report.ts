// @ts-nocheck
// Migrated from Supabase Edge Function `auto-report` to a TanStack server route.
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
    } catch (_) {}
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
    const supabaseUrl = __env('SUPABASE_URL')!;
    const supabaseKey = __env('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all guilds with auto-reports enabled
    const { data: reportSettings } = await supabase
      .from('auto_report_settings')
      .select('*')
      .eq('enabled', true)
      .not('channel_id', 'is', null);

    if (!reportSettings || reportSettings.length === 0) {
      return new Response(JSON.stringify({ message: 'No auto reports configured' }), { headers: corsHeaders });
    }

    let sent = 0;

    for (const setting of reportSettings) {
      try {
        // Get stats for the period
        const days = setting.frequency === 'daily' ? 1 : setting.frequency === 'weekly' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data: stats } = await supabase
          .from('analytics_daily_stats')
          .select('*')
          .eq('guild_id', setting.guild_id)
          .gte('date', startDate.toISOString().split('T')[0]);

        if (!stats || stats.length === 0) continue;

        // Aggregate
        const totalMessages = stats.reduce((s, d) => s + d.messages, 0);
        const totalCommands = stats.reduce((s, d) => s + d.commands_used, 0);
        const totalXp = stats.reduce((s, d) => s + d.xp_gained, 0);
        const joined = stats.reduce((s, d) => s + d.members_joined, 0);
        const left = stats.reduce((s, d) => s + d.members_left, 0);
        const modActions = stats.reduce((s, d) => s + d.mod_actions, 0);
        const avgActive = Math.round(stats.reduce((s, d) => s + d.active_users, 0) / stats.length);

        const periodLabel = setting.frequency === 'daily' ? 'Daglig' : setting.frequency === 'weekly' ? 'Ugentlig' : 'Månedlig';

        const embed = {
          title: `📊 ${periodLabel} Rapport`,
          color: 0x5865F2,
          fields: [
            { name: '💬 Beskeder', value: totalMessages.toLocaleString(), inline: true },
            { name: '⚡ Commands', value: totalCommands.toLocaleString(), inline: true },
            { name: '✨ XP', value: totalXp.toLocaleString(), inline: true },
            { name: '👥 Nye medlemmer', value: `+${joined}`, inline: true },
            { name: '👋 Forladt', value: `-${left}`, inline: true },
            { name: '🛡️ Mod Actions', value: modActions.toString(), inline: true },
            { name: '📈 Gns. aktive/dag', value: avgActive.toString(), inline: true },
          ],
          footer: { text: `Periode: ${days} dage` },
          timestamp: new Date().toISOString(),
        };

        const botToken = await getBotTokenForGuild(supabase, setting.guild_id);

        const res = await fetch(`https://discord.com/api/v10/channels/${setting.channel_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed] }),
        });

        if (res.ok) {
          sent++;
          await supabase
            .from('auto_report_settings')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('id', setting.id);
        }
      } catch (e) {
        console.error(`Error sending report for guild ${setting.guild_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/auto-report')({
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
