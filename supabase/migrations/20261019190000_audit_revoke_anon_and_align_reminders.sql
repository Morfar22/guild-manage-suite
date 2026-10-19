-- Audit hardening: remove legacy open anon RLS policies and require service_role for bot.
-- Decision: the Discord bot must use SUPABASE_SERVICE_ROLE_KEY; the public anon key must not
-- read/write operational guild data via PostgREST.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE 'Allow anon%'
        OR policyname ILIKE 'Anon can%'
        OR (
          'anon' = ANY (roles)
          AND (
            qual IN ('true', '(true)')
            OR with_check IN ('true', '(true)')
          )
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Revoke residual anon privileges on public tables that previously had open bot policies.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'afk_status',
    'ai_chat_history',
    'ai_safety_logs',
    'analytics_daily_stats',
    'analytics_events',
    'application_audit_log',
    'application_forms',
    'application_settings',
    'application_submissions',
    'auto_report_settings',
    'auto_responders',
    'automod_logs',
    'automod_rules',
    'backup_schedules',
    'bot_status',
    'characters',
    'economy_accounts',
    'economy_settings',
    'economy_transactions',
    'fivem_bans',
    'fivem_command_queue',
    'fivem_sessions',
    'fivem_settings',
    'fivem_whitelist',
    'giveaways',
    'global_ban_alerts',
    'global_ban_executions',
    'global_bans',
    'guild_bot_settings',
    'guild_commands',
    'guild_modules',
    'guilds',
    'jtc_channels',
    'jtc_settings',
    'jtc_triggers',
    'level_roles',
    'leveling_settings',
    'log_settings',
    'member_activity',
    'moderation_logs',
    'modmail_messages',
    'modmail_settings',
    'modmail_threads',
    'polls',
    'reaction_role_panels',
    'reaction_roles',
    'reminders',
    'scheduled_actions',
    'scheduled_messages',
    'starboard_entries',
    'starboard_settings',
    'stats_channels',
    'stats_force_update',
    'suggestion_settings',
    'suggestions',
    'ticket_categories',
    'ticket_messages',
    'ticket_settings',
    'tickets',
    'twitch_notification_logs',
    'twitch_partner_weekly_stats',
    'twitch_settings',
    'twitch_streamers',
    'user_levels',
    'verification_logs',
    'verification_settings',
    'warning_settings',
    'warnings',
    'welcome_settings',
    'xp_multipliers'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

-- Align reminders schema with bot reminderHandler + /remind command.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS created_by_id text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS repeat_interval text,
  ADD COLUMN IF NOT EXISTS sent boolean DEFAULT false;

UPDATE public.reminders
SET channel_id = COALESCE(channel_id, target_channel_id)
WHERE channel_id IS NULL AND target_channel_id IS NOT NULL;

UPDATE public.reminders
SET sent = COALESCE(sent, is_sent, false);

UPDATE public.reminders
SET repeat_interval = COALESCE(repeat_interval, recurrence_interval)
WHERE repeat_interval IS NULL AND recurrence_interval IS NOT NULL;

UPDATE public.reminders
SET created_by_id = COALESCE(created_by_id, created_by_user_id::text)
WHERE created_by_id IS NULL AND created_by_user_id IS NOT NULL;

UPDATE public.reminders SET is_sent = COALESCE(sent, false);

DROP POLICY IF EXISTS "Anon can select reminders" ON public.reminders;
DROP POLICY IF EXISTS "Anon can update reminders" ON public.reminders;
REVOKE ALL ON TABLE public.reminders FROM anon;
GRANT ALL ON TABLE public.reminders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reminders TO authenticated;

-- Discord /remind has no Supabase auth uid; allow null and store Discord id in created_by_id.
ALTER TABLE public.reminders
  ALTER COLUMN created_by_user_id DROP NOT NULL;
