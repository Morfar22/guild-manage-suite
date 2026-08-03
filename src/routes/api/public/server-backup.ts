// @ts-nocheck
// Migrated from Supabase Edge Function `server-backup` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guildId, action, description, backupId } = await req.json();
    if (!guildId || !action) {
      return new Response(JSON.stringify({ error: 'Missing guildId or action' }), { status: 400, headers: corsHeaders });
    }

    const discordBotToken = __env('DISCORD_BOT_TOKEN');
    const supabaseUrl = __env('SUPABASE_URL')!;
    const supabaseKey = __env('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get guild's discord guild_id
    const { data: guild } = await supabase.from('guilds').select('guild_id').eq('id', guildId).single();
    if (!guild) {
      return new Response(JSON.stringify({ error: 'Guild not found' }), { status: 404, headers: corsHeaders });
    }

    if (action === 'create') {
      // Fetch server data from Discord
      const headers = { 'Authorization': `Bot ${discordBotToken}` };
      const [guildRes, channelsRes, rolesRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}?with_counts=true`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}/channels`, { headers }),
        fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}/roles`, { headers }),
      ]);

      const backupData = {
        guild: await guildRes.json(),
        channels: await channelsRes.json(),
        roles: await rolesRes.json(),
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('server_backups').insert({
        guild_id: guildId,
        backup_type: 'manual',
        backup_data: backupData,
        description: description || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === 'restore') {
      if (!backupId) {
        return new Response(JSON.stringify({ error: 'Missing backupId' }), { status: 400, headers: corsHeaders });
      }
      // For now, return the backup data - actual restore would need careful Discord API calls
      const { data: backup, error } = await supabase.from('server_backups').select('*').eq('id', backupId).single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Restore data retrieved', backup }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/server-backup')({
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
