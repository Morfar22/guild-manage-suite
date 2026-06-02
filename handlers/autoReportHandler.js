/**
 * Auto-Report Handler
 * 
 * Checks every 5 minutes whether any guild's auto-report is due,
 * then calls the auto-report edge function to send the report to Discord.
 */

function setupAutoReportHandler(client, supabase, options = {}) {
  const { shouldHandleGuild } = options;
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sleiplyixaxuvydzudxn.supabase.co';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  console.log('[AutoReport] Handler initialized');

  setInterval(async () => {
    try {
      // Get all enabled auto-report settings
      const { data: settings, error } = await supabase
        .from('auto_report_settings')
        .select('*, guilds!inner(guild_id)')
        .eq('enabled', true)
        .not('channel_id', 'is', null);

      if (error) {
        console.error('[AutoReport] Query error:', error.message);
        return;
      }

      if (!settings || settings.length === 0) return;

      const now = new Date();
      let shouldTrigger = false;

      for (const setting of settings) {
        const discordGuildId = setting.guilds?.guild_id;
        if (!discordGuildId) continue;
        if (shouldHandleGuild && !shouldHandleGuild(discordGuildId)) continue;

        // Check if report is due
        const lastSent = setting.last_sent_at ? new Date(setting.last_sent_at) : null;
        const frequency = setting.frequency || 'daily';

        let intervalMs;
        switch (frequency) {
          case 'daily':
            intervalMs = 24 * 60 * 60 * 1000;
            break;
          case 'weekly':
            intervalMs = 7 * 24 * 60 * 60 * 1000;
            break;
          case 'monthly':
            intervalMs = 30 * 24 * 60 * 60 * 1000;
            break;
          default:
            intervalMs = 24 * 60 * 60 * 1000;
        }

        if (!lastSent || (now - lastSent) >= intervalMs) {
          shouldTrigger = true;
          break;
        }
      }

      if (!shouldTrigger) return;

      // Call the edge function to send reports
      console.log('[AutoReport] Triggering auto-report edge function...');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`[AutoReport] Reports sent: ${result.sent || 0}`);
      } else {
        console.error(`[AutoReport] Edge function error: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error('[AutoReport] Error:', err.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

module.exports = { setupAutoReportHandler };
