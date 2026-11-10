-- Close the legacy PUBLIC/tenant-wide access without changing stored data.
DO $policies$
DECLARE t text; p record; allowed text;
BEGIN
  FOREACH t IN ARRAY ARRAY['server_backups','webhook_configs','raid_protection_settings','bot_console_logs'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
    allowed := format('(public.has_admin_or_staff_role((SELECT auth.uid())) OR EXISTS
      (SELECT 1 FROM public.user_guilds ug WHERE ug.guild_id=%I.guild_id
       AND ug.user_id=(SELECT auth.uid()) AND ug.has_admin_permission))',t);
    IF t='bot_console_logs' THEN
      EXECUTE format('CREATE POLICY protected_logs_read ON public.%I FOR SELECT TO authenticated USING (%s)',t,allowed);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    ELSE
      EXECUTE format('CREATE POLICY protected_guild_data ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',t,allowed,allowed);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    END IF;
  END LOOP;
END $policies$;
ALTER TABLE public.bot_console_logs ALTER COLUMN guild_id DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
