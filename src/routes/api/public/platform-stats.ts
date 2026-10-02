import { createFileRoute } from '@tanstack/react-router';

async function getPlatformStats() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const [
    guildsResult,
    ticketsResult,
    moderationResult,
    botStatusResult,
  ] = await Promise.all([
    supabaseAdmin.from('guilds').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('moderation_logs').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('bot_status')
      .select('member_count, last_heartbeat, is_online')
      .eq('is_online', true)
      .gte('last_heartbeat', fiveMinutesAgo),
  ]);

  const botRows = botStatusResult.data || [];

  return {
    servers: guildsResult.count || 0,
    tickets: ticketsResult.count || 0,
    moderationActions: moderationResult.count || 0,
    onlineBots: botRows.length,
    managedMembers: botRows.reduce((sum, row) => sum + (row.member_count || 0), 0),
    updatedAt: new Date().toISOString(),
  };
}

async function handler() {
  try {
    const stats = await getPlatformStats();
    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[PlatformStats] Failed to load public stats:', error);
    return new Response(JSON.stringify({ error: 'Stats unavailable' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}

export const Route = createFileRoute('/api/public/platform-stats')({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
