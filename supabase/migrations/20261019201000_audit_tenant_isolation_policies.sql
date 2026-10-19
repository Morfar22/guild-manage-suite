-- Audit round 2: tenant isolation.
--
-- Many tables had policies such as USING (true) / WITH CHECK (true) or
-- USING (auth.uid() IS NOT NULL). Any user who logged in with Discord could
-- read and change every guild's settings (raid protection, verification,
-- webhooks, backups, FiveM role permissions, Tiktok/YouTube, ...). Policies
-- without a TO clause applied to PUBLIC (including anon).
--
-- Decision:
--   * Drop those permissive policies (service_role bypasses RLS, so the bot
--     and server routes are unaffected).
--   * Replace them with one policy per table: guild admins
--     (user_guilds.has_admin_permission) of the row's guild, or platform admins
--     (has_role(uid, 'admin')), get full CRUD. Nobody else gets access.
--   * global_ban_appeals has no guild_id and is only for platform staff.
--   * global_ban_reports keeps "Authenticated users can create reports"
--     (intentional reporting feature).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ai_automod_settings', 'Users can view ai_automod_settings'),
      ('ai_automod_settings', 'Users can manage ai_automod_settings'),
      ('backup_schedules', 'Auth users can manage backup schedules'),
      ('birthday_settings', 'Users can view birthday settings'),
      ('birthdays', 'Users can view birthdays'),
      ('bot_console_logs', 'Service role can insert console logs'),
      ('confession_settings', 'Users can view confession settings'),
      ('confessions', 'Users can view confessions'),
      ('counting_settings', 'Users can view counting settings'),
      ('economy_purchases', 'Users can view purchases'),
      ('economy_shop_items', 'Users can view shop items'),
      ('fivem_action_logs', 'Service role can insert fivem action logs'),
      ('fivem_online_players', 'Service role can manage fivem online players'),
      ('fivem_role_permissions', 'Authenticated users can insert fivem_role_permissions'),
      ('fivem_role_permissions', 'Authenticated users can update fivem_role_permissions'),
      ('fivem_role_permissions', 'Authenticated users can delete fivem_role_permissions'),
      ('fivem_role_permissions', 'Authenticated users can select fivem_role_permissions'),
      ('fivem_server_status', 'Service role can manage fivem server status'),
      ('guild_premium_features', 'Authenticated users can view premium features'),
      ('guilds', 'Service role can insert guilds'),
      ('guilds', 'Authenticated users can insert guilds'),
      ('honeypot_catches', 'honeypot_catches_select'),
      ('honeypot_catches', 'honeypot_catches_delete'),
      ('honeypot_settings', 'honeypot_settings_select'),
      ('honeypot_settings', 'honeypot_settings_all'),
      ('invite_tracker', 'Anyone can read invite_tracker'),
      ('invite_tracker', 'Anyone can insert invite_tracker'),
      ('invite_tracker', 'Anyone can update invite_tracker'),
      ('invite_tracker', 'Anyone can delete invite_tracker'),
      ('invite_uses', 'Anyone can read invite_uses'),
      ('invite_uses', 'Anyone can insert invite_uses'),
      ('invite_uses', 'Anyone can update invite_uses'),
      ('invite_uses', 'Anyone can delete invite_uses'),
      ('music_quiz_scores', 'Anyone authed can view scores'),
      ('music_quiz_settings', 'Users can view music quiz settings'),
      ('music_quiz_songs', 'Anyone authed can view songs'),
      ('quarantine_entries', 'quarantine_entries_select'),
      ('quarantine_entries', 'quarantine_entries_all'),
      ('quarantine_settings', 'quarantine_settings_select'),
      ('quarantine_settings', 'quarantine_settings_all'),
      ('raid_logs', 'raid_logs_select'),
      ('raid_protection_settings', 'raid_protection_select'),
      ('raid_protection_settings', 'raid_protection_all'),
      ('realtime_events', 'Realtime events viewable by authenticated'),
      ('realtime_events', 'Realtime events insertable by all'),
      ('saved_embeds', 'Authenticated users can manage saved_embeds'),
      ('server_backups', 'Authenticated users can manage server_backups'),
      ('slowmode_schedules', 'slowmode_select'),
      ('slowmode_schedules', 'slowmode_all'),
      ('stats_channels', 'Authenticated users can manage stats_channels'),
      ('suggestion_settings', 'Authenticated users can manage suggestion_settings'),
      ('suggestions', 'Authenticated users can manage suggestions'),
      ('tebex_purchases', 'Service role full access on tebex_purchases'),
      ('tebex_role_mappings', 'Service role full access on tebex_role_mappings'),
      ('tiktok_accounts', 'Users can view tiktok accounts for their guilds'),
      ('tiktok_accounts', 'Users can insert tiktok accounts'),
      ('tiktok_accounts', 'Users can update tiktok accounts'),
      ('tiktok_accounts', 'Users can delete tiktok accounts'),
      ('tiktok_notification_logs', 'Users can view tiktok notification logs'),
      ('tiktok_notification_logs', 'Service can insert tiktok notification logs'),
      ('tiktok_settings', 'Users can view tiktok settings'),
      ('tiktok_settings', 'Users can insert tiktok settings'),
      ('tiktok_settings', 'Users can update tiktok settings'),
      ('verification_logs', 'Authenticated users can manage verification_logs'),
      ('verification_settings', 'Authenticated users can manage verification_settings'),
      ('webhook_configs', 'Users can manage webhook configs'),
      ('youtube_channels', 'Users can view youtube_channels for their guilds'),
      ('youtube_channels', 'Users can insert youtube_channels'),
      ('youtube_channels', 'Users can update youtube_channels'),
      ('youtube_channels', 'Users can delete youtube_channels'),
      ('youtube_notification_logs', 'Users can view youtube_notification_logs'),
      ('youtube_notification_logs', 'Users can insert youtube_notification_logs'),
      ('youtube_settings', 'Users can view youtube_settings'),
      ('youtube_settings', 'Users can insert youtube_settings'),
      ('youtube_settings', 'Users can update youtube_settings'),
      ('afk_status', 'Authenticated users can view afk status'),
      ('auto_responders', 'Authenticated users can view auto responders'),
      ('auto_responders', 'Authenticated users can manage auto responders'),
      ('global_ban_alerts', 'Authenticated users can view alerts'),
      ('global_ban_appeals', 'Authenticated users can view appeals'),
      ('member_activity', 'Authenticated users can view member activity'),
      ('moderation_templates', 'Authenticated users can view moderation templates'),
      ('moderation_templates', 'Authenticated users can manage moderation templates'),
      ('polls', 'Authenticated users can view polls'),
      ('polls', 'Authenticated users can create polls'),
      ('polls', 'Authenticated users can update polls'),
      ('polls', 'Authenticated users can delete polls'),
      ('role_menus', 'Authenticated users can view role menus'),
      ('role_menus', 'Authenticated users can manage role menus'),
      ('scheduled_actions', 'Authenticated users can view scheduled actions'),
      ('scheduled_actions', 'Authenticated users can create scheduled actions'),
      ('scheduled_actions', 'Authenticated users can update scheduled actions'),
      ('scheduled_actions', 'Authenticated users can delete scheduled actions'),
      ('stats_force_update', 'Authenticated users can insert force update')
    ) AS v(tbl, pol)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
  col_type text;
  match_expr text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ai_automod_settings', 'backup_schedules', 'birthday_settings', 'birthdays',
    'bot_console_logs', 'confession_settings', 'confessions', 'counting_settings',
    'economy_purchases', 'economy_shop_items', 'fivem_action_logs',
    'fivem_online_players', 'fivem_role_permissions', 'fivem_server_status',
    'guild_premium_features', 'honeypot_catches', 'honeypot_settings',
    'invite_tracker', 'invite_uses', 'music_quiz_scores', 'music_quiz_settings',
    'music_quiz_songs', 'quarantine_entries', 'quarantine_settings', 'raid_logs',
    'raid_protection_settings', 'realtime_events', 'saved_embeds',
    'server_backups', 'slowmode_schedules', 'stats_channels',
    'suggestion_settings', 'suggestions', 'tebex_purchases',
    'tebex_role_mappings', 'tiktok_accounts', 'tiktok_notification_logs',
    'tiktok_settings', 'twitch_content_posts', 'verification_logs',
    'verification_settings', 'webhook_configs', 'youtube_channels',
    'youtube_notification_logs', 'youtube_settings', 'afk_status',
    'auto_responders', 'global_ban_alerts', 'member_activity',
    'moderation_templates', 'polls', 'role_menus', 'scheduled_actions',
    'stats_force_update'
  ]
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'guild_id';

    IF col_type IS NULL THEN
      RAISE NOTICE 'audit: skipping %, no guild_id column', tbl;
      CONTINUE;
    END IF;

    match_expr := CASE WHEN col_type = 'uuid'
      THEN format('ug.guild_id = %I.guild_id', tbl)
      ELSE format('ug.guild_id::text = %I.guild_id::text', tbl)
    END;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);

    pol := 'Guild admins manage ' || tbl;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (
           public.has_role((SELECT auth.uid()), 'admin')
           OR EXISTS (SELECT 1 FROM public.user_guilds ug
                      WHERE %s AND ug.user_id = (SELECT auth.uid())
                        AND ug.has_admin_permission = true))
         WITH CHECK (
           public.has_role((SELECT auth.uid()), 'admin')
           OR EXISTS (SELECT 1 FROM public.user_guilds ug
                      WHERE %s AND ug.user_id = (SELECT auth.uid())
                        AND ug.has_admin_permission = true))$p$,
      pol, tbl, match_expr, match_expr);
  END LOOP;
END $$;

-- music_quiz_songs rows with guild_id NULL are the shared global song pool.
DROP POLICY IF EXISTS "Authenticated users read global quiz songs" ON public.music_quiz_songs;
CREATE POLICY "Authenticated users read global quiz songs"
  ON public.music_quiz_songs FOR SELECT TO authenticated
  USING (guild_id IS NULL);

-- global_ban_appeals: platform staff only.
ALTER TABLE public.global_ban_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.global_ban_appeals FROM anon;
DROP POLICY IF EXISTS "Platform staff can view appeals" ON public.global_ban_appeals;
CREATE POLICY "Platform staff can view appeals"
  ON public.global_ban_appeals FOR SELECT TO authenticated
  USING (public.has_admin_or_staff_role((SELECT auth.uid())));
