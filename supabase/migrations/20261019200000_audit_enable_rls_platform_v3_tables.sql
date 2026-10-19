-- Audit round 2: the platform v3 tables were created without row level
-- security. With Supabase's default grants any authenticated (or anon) client
-- could read and modify every guild's moderation evidence, appeals, internal
-- ticket notes, workflows and command profiles through PostgREST.
--
-- Decision: guild admins (user_guilds.has_admin_permission) get full CRUD on
-- rows for their guild; anon gets nothing; the bot keeps using service_role.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'moderation_evidence',
    'moderation_appeals',
    'ticket_internal_notes',
    'automation_workflows',
    'workflow_executions',
    'command_permission_profiles',
    'command_presets'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Guild admins manage ' || tbl, tbl);
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (EXISTS (
           SELECT 1 FROM public.user_guilds ug
           WHERE ug.guild_id = %I.guild_id
             AND ug.user_id = (SELECT auth.uid())
             AND ug.has_admin_permission = true))
         WITH CHECK (EXISTS (
           SELECT 1 FROM public.user_guilds ug
           WHERE ug.guild_id = %I.guild_id
             AND ug.user_id = (SELECT auth.uid())
             AND ug.has_admin_permission = true))$p$,
      'Guild admins manage ' || tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
