
-- =============================================
-- Bot anon write policies for all handler tables
-- The bot uses SUPABASE_ANON_KEY as fallback,
-- so all tables it writes to need anon policies.
-- =============================================

-- 1. moderation_logs: bot inserts and deletes
CREATE POLICY "Allow anon select moderation_logs"
  ON public.moderation_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon insert moderation_logs"
  ON public.moderation_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete moderation_logs"
  ON public.moderation_logs FOR DELETE USING (true);

-- 2. economy_accounts: bot inserts and updates
CREATE POLICY "Allow anon select economy_accounts"
  ON public.economy_accounts FOR SELECT USING (true);
CREATE POLICY "Allow anon insert economy_accounts"
  ON public.economy_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update economy_accounts"
  ON public.economy_accounts FOR UPDATE USING (true);

-- 3. economy_transactions: bot inserts
CREATE POLICY "Allow anon insert economy_transactions"
  ON public.economy_transactions FOR INSERT WITH CHECK (true);

-- 4. verification_logs: bot inserts
CREATE POLICY "Allow anon insert verification_logs"
  ON public.verification_logs FOR INSERT WITH CHECK (true);

-- 5. suggestions: bot inserts and updates
CREATE POLICY "Allow anon select suggestions"
  ON public.suggestions FOR SELECT USING (true);
CREATE POLICY "Allow anon insert suggestions"
  ON public.suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update suggestions"
  ON public.suggestions FOR UPDATE USING (true);

-- 6. scheduled_actions: bot updates (mark executed)
CREATE POLICY "Allow anon select scheduled_actions"
  ON public.scheduled_actions FOR SELECT USING (true);
CREATE POLICY "Allow anon update scheduled_actions"
  ON public.scheduled_actions FOR UPDATE USING (true);

-- 7. scheduled_messages: bot inserts, updates, deletes
CREATE POLICY "Allow anon select scheduled_messages"
  ON public.scheduled_messages FOR SELECT USING (true);
CREATE POLICY "Allow anon insert scheduled_messages"
  ON public.scheduled_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update scheduled_messages"
  ON public.scheduled_messages FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete scheduled_messages"
  ON public.scheduled_messages FOR DELETE USING (true);

-- 8. fivem_command_queue: bot updates (mark executed)
CREATE POLICY "Allow anon select fivem_command_queue"
  ON public.fivem_command_queue FOR SELECT USING (true);
CREATE POLICY "Allow anon update fivem_command_queue"
  ON public.fivem_command_queue FOR UPDATE USING (true);

-- 9. global_ban_alerts: bot inserts
CREATE POLICY "Allow anon insert global_ban_alerts"
  ON public.global_ban_alerts FOR INSERT WITH CHECK (true);

-- 10. starboard_entries: bot inserts, updates, deletes
CREATE POLICY "Allow anon select starboard_entries"
  ON public.starboard_entries FOR SELECT USING (true);
CREATE POLICY "Allow anon insert starboard_entries"
  ON public.starboard_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update starboard_entries"
  ON public.starboard_entries FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete starboard_entries"
  ON public.starboard_entries FOR DELETE USING (true);

-- 11. afk_status: bot upserts and deletes
CREATE POLICY "Allow anon select afk_status"
  ON public.afk_status FOR SELECT USING (true);
CREATE POLICY "Allow anon insert afk_status"
  ON public.afk_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update afk_status"
  ON public.afk_status FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete afk_status"
  ON public.afk_status FOR DELETE USING (true);

-- 12. automod_logs: bot inserts
CREATE POLICY "Allow anon insert automod_logs"
  ON public.automod_logs FOR INSERT WITH CHECK (true);

-- 13. bot_status: bot updates heartbeat
CREATE POLICY "Allow anon insert bot_status"
  ON public.bot_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update bot_status"
  ON public.bot_status FOR UPDATE USING (true);

-- 14. user_levels: xp handler upserts
CREATE POLICY "Allow anon select user_levels"
  ON public.user_levels FOR SELECT USING (true);
CREATE POLICY "Allow anon insert user_levels"
  ON public.user_levels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update user_levels"
  ON public.user_levels FOR UPDATE USING (true);

-- 15. analytics_daily_stats: bot updates
CREATE POLICY "Allow anon select analytics_daily_stats"
  ON public.analytics_daily_stats FOR SELECT USING (true);
CREATE POLICY "Allow anon insert analytics_daily_stats"
  ON public.analytics_daily_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update analytics_daily_stats"
  ON public.analytics_daily_stats FOR UPDATE USING (true);

-- 16. ai_chat_history: bot inserts chat messages
CREATE POLICY "Allow anon insert ai_chat_history"
  ON public.ai_chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select ai_chat_history"
  ON public.ai_chat_history FOR SELECT USING (true);

-- 17. application_submissions: bot inserts submissions
CREATE POLICY "Allow anon insert application_submissions"
  ON public.application_submissions FOR INSERT WITH CHECK (true);

-- 18. application_forms: bot reads forms
CREATE POLICY "Allow anon select application_forms"
  ON public.application_forms FOR SELECT USING (true);

-- 19. application_settings: bot reads settings
CREATE POLICY "Allow anon select application_settings"
  ON public.application_settings FOR SELECT USING (true);

-- 20. giveaways: bot updates entries/winners
CREATE POLICY "Allow anon select giveaways"
  ON public.giveaways FOR SELECT USING (true);
CREATE POLICY "Allow anon update giveaways"
  ON public.giveaways FOR UPDATE USING (true);

-- 21. tickets/ticket_messages: bot writes
CREATE POLICY "Allow anon insert tickets"
  ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update tickets"
  ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow anon select tickets"
  ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Allow anon insert ticket_messages"
  ON public.ticket_messages FOR INSERT WITH CHECK (true);

-- 22. modmail: bot writes threads and messages
CREATE POLICY "Allow anon insert modmail_threads"
  ON public.modmail_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update modmail_threads"
  ON public.modmail_threads FOR UPDATE USING (true);
CREATE POLICY "Allow anon select modmail_threads"
  ON public.modmail_threads FOR SELECT USING (true);
CREATE POLICY "Allow anon insert modmail_messages"
  ON public.modmail_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select modmail_messages"
  ON public.modmail_messages FOR SELECT USING (true);

-- 23. jtc_channels: bot manages
CREATE POLICY "Allow anon insert jtc_channels"
  ON public.jtc_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update jtc_channels"
  ON public.jtc_channels FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete jtc_channels"
  ON public.jtc_channels FOR DELETE USING (true);
CREATE POLICY "Allow anon select jtc_channels"
  ON public.jtc_channels FOR SELECT USING (true);

-- 24. jtc_settings: bot reads
CREATE POLICY "Allow anon select jtc_settings"
  ON public.jtc_settings FOR SELECT USING (true);

-- 25. jtc_triggers: bot reads
CREATE POLICY "Allow anon select jtc_triggers"
  ON public.jtc_triggers FOR SELECT USING (true);

-- 26. welcome_settings: bot reads
CREATE POLICY "Allow anon select welcome_settings"
  ON public.welcome_settings FOR SELECT USING (true);

-- 27. leveling_settings: bot reads
CREATE POLICY "Allow anon select leveling_settings"
  ON public.leveling_settings FOR SELECT USING (true);

-- 28. log_settings: bot reads
CREATE POLICY "Allow anon select log_settings"
  ON public.log_settings FOR SELECT USING (true);

-- 29. ticket_settings: bot reads
CREATE POLICY "Allow anon select ticket_settings"
  ON public.ticket_settings FOR SELECT USING (true);

-- 30. ticket_categories: bot reads
CREATE POLICY "Allow anon select ticket_categories"
  ON public.ticket_categories FOR SELECT USING (true);

-- 31. auto_responders: bot reads
CREATE POLICY "Allow anon select auto_responders"
  ON public.auto_responders FOR SELECT USING (true);

-- 32. automod_rules: bot reads
CREATE POLICY "Allow anon select automod_rules"
  ON public.automod_rules FOR SELECT USING (true);

-- 33. verification_settings: bot reads
CREATE POLICY "Allow anon select verification_settings"
  ON public.verification_settings FOR SELECT USING (true);

-- 34. suggestion_settings: bot reads
CREATE POLICY "Allow anon select suggestion_settings"
  ON public.suggestion_settings FOR SELECT USING (true);

-- 35. economy_settings: bot reads
CREATE POLICY "Allow anon select economy_settings"
  ON public.economy_settings FOR SELECT USING (true);

-- 36. level_roles: bot reads (for role rewards)
CREATE POLICY "Allow anon select level_roles"
  ON public.level_roles FOR SELECT USING (true);

-- 37. modmail_settings: bot reads
CREATE POLICY "Allow anon select modmail_settings"
  ON public.modmail_settings FOR SELECT USING (true);

-- 38. starboard_settings: bot reads
CREATE POLICY "Allow anon select starboard_settings"
  ON public.starboard_settings FOR SELECT USING (true);

-- 39. reaction_role_panels: bot reads
CREATE POLICY "Allow anon select reaction_role_panels"
  ON public.reaction_role_panels FOR SELECT USING (true);

-- 40. reaction_roles: bot reads
CREATE POLICY "Allow anon select reaction_roles"
  ON public.reaction_roles FOR SELECT USING (true);

-- 41. guild_commands: bot reads
CREATE POLICY "Allow anon select guild_commands"
  ON public.guild_commands FOR SELECT USING (true);

-- 42. guild_modules: bot reads
CREATE POLICY "Allow anon select guild_modules"
  ON public.guild_modules FOR SELECT USING (true);

-- 43. fivem_whitelist: bot reads
CREATE POLICY "Allow anon select fivem_whitelist"
  ON public.fivem_whitelist FOR SELECT USING (true);

-- 44. fivem_settings: bot reads
CREATE POLICY "Allow anon select fivem_settings"
  ON public.fivem_settings FOR SELECT USING (true);

-- 45. fivem_sessions: bot writes
CREATE POLICY "Allow anon select fivem_sessions"
  ON public.fivem_sessions FOR SELECT USING (true);
CREATE POLICY "Allow anon insert fivem_sessions"
  ON public.fivem_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update fivem_sessions"
  ON public.fivem_sessions FOR UPDATE USING (true);

-- 46. fivem_bans: bot reads
CREATE POLICY "Allow anon select fivem_bans"
  ON public.fivem_bans FOR SELECT USING (true);

-- 47. characters: bot reads
CREATE POLICY "Allow anon select characters"
  ON public.characters FOR SELECT USING (true);

-- 48. guild_bot_settings: bot reads its own config
CREATE POLICY "Allow anon select guild_bot_settings"
  ON public.guild_bot_settings FOR SELECT USING (true);

-- 49. twitch_streamers: bot reads
CREATE POLICY "Allow anon select twitch_streamers"
  ON public.twitch_streamers FOR SELECT USING (true);

-- 50. twitch_notification_logs: bot inserts
CREATE POLICY "Allow anon insert twitch_notification_logs"
  ON public.twitch_notification_logs FOR INSERT WITH CHECK (true);

-- 51. twitch_settings: bot reads
CREATE POLICY "Allow anon select twitch_settings"
  ON public.twitch_settings FOR SELECT USING (true);

-- 52. member_activity: bot writes
CREATE POLICY "Allow anon select member_activity"
  ON public.member_activity FOR SELECT USING (true);
CREATE POLICY "Allow anon insert member_activity"
  ON public.member_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update member_activity"
  ON public.member_activity FOR UPDATE USING (true);

-- 53. backup_schedules: bot reads
CREATE POLICY "Allow anon select backup_schedules"
  ON public.backup_schedules FOR SELECT USING (true);

-- 54. xp_multipliers: bot reads
CREATE POLICY "Allow anon select xp_multipliers"
  ON public.xp_multipliers FOR SELECT USING (true);
