-- Audit round 2 (critical): "Users can insert their own guild links" allowed
-- any authenticated user to insert
--   user_guilds(user_id = auth.uid(), guild_id = <any guild>, has_admin_permission = true)
-- and thereby become admin of any guild. Every guild-admin RLS policy and
-- every API route that calls requireGuildAdmin trusts user_guilds, so this
-- was a full cross-tenant privilege escalation.
--
-- user_guilds is written only by the server (discord-oauth / create-demo-guild
-- via service_role) and by platform admins ("Admins can manage all
-- user_guilds"). Users only need to read their own rows.
DROP POLICY IF EXISTS "Users can insert their own guild links" ON public.user_guilds;

REVOKE ALL ON TABLE public.user_guilds FROM anon;
GRANT ALL ON TABLE public.user_guilds TO service_role;

-- Platform admins manage links from the dashboard (src/hooks/useAdmin.ts);
-- authenticated keeps table privileges, RLS limits writes to platform admins.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_guilds TO authenticated;
DROP POLICY IF EXISTS "Admins can manage all user_guilds" ON public.user_guilds;
CREATE POLICY "Admins can manage all user_guilds"
  ON public.user_guilds FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Same pattern for user_roles: make the admin policy check new rows too.
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
REVOKE ALL ON TABLE public.user_roles FROM anon;
