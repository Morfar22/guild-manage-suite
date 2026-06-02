import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all guilds
    const { data: guilds, error: guildErr } = await supabase
      .from('guilds')
      .select('id');

    if (guildErr) throw guildErr;
    if (!guilds || guilds.length === 0) {
      return new Response(JSON.stringify({ message: 'No guilds found' }), { headers: corsHeaders });
    }

    let aggregated = 0;

    for (const guild of guilds) {
      // Get events for this guild from the last 2 days (covers timezone edge cases)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 2);

      const { data: events, error: evErr } = await supabase
        .from('analytics_events')
        .select('event_type, user_id, metadata, created_at')
        .eq('guild_id', guild.id)
        .gte('created_at', cutoff.toISOString());

      if (evErr || !events || events.length === 0) continue;

      // Group events by date
      const byDate: Record<string, typeof events> = {};
      for (const ev of events) {
        const date = ev.created_at.split('T')[0];
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(ev);
      }

      for (const [date, dayEvents] of Object.entries(byDate)) {
        const activeUsers = new Set<string>();
        let messages = 0, commands = 0, joined = 0, left = 0, modActions = 0, xp = 0;

        for (const ev of dayEvents) {
          if (ev.user_id) activeUsers.add(ev.user_id);
          switch (ev.event_type) {
            case 'message': messages++; break;
            case 'command': commands++; break;
            case 'member_join': joined++; break;
            case 'member_leave': left++; break;
            case 'mod_action': modActions++; break;
            case 'xp_gain': xp += (ev.metadata as any)?.amount || 0; break;
          }
        }

        const { error: upsertErr } = await supabase
          .from('analytics_daily_stats')
          .upsert({
            guild_id: guild.id,
            date,
            messages,
            xp_gained: xp,
            commands_used: commands,
            members_joined: joined,
            members_left: left,
            mod_actions: modActions,
            voice_minutes: 0,
            active_users: activeUsers.size,
          }, { onConflict: 'guild_id,date' });

        if (!upsertErr) aggregated++;
      }
    }

    // Clean up old events (keep 7 days)
    const cleanupCutoff = new Date();
    cleanupCutoff.setDate(cleanupCutoff.getDate() - 7);
    await supabase
      .from('analytics_events')
      .delete()
      .lt('created_at', cleanupCutoff.toISOString());

    return new Response(
      JSON.stringify({ success: true, aggregated, guilds: guilds.length }),
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('Aggregation error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
