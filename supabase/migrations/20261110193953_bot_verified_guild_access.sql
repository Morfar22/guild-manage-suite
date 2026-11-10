-- Discord authorization is a short-lived server-verified claim. An unavailable
-- bot must fail closed rather than leave an old administrator authorized.
ALTER TABLE public.user_guilds ADD COLUMN admin_verified_until timestamptz,
  ADD COLUMN is_demo_access boolean NOT NULL DEFAULT false;
UPDATE public.user_guilds ug SET is_demo_access=true FROM public.guilds g
WHERE g.id=ug.guild_id AND left(g.guild_id,5)='demo_' AND g.owner_id=ug.user_id::text;
CREATE INDEX user_guilds_verification_due ON public.user_guilds(admin_verified_until);

CREATE VIEW public.verified_user_guilds WITH (security_invoker=true,security_barrier=true) AS
SELECT ug.id,ug.user_id,ug.guild_id,ug.discord_user_id,
  ug.has_admin_permission,
  ug.created_at,ug.admin_verified_until,ug.is_demo_access
FROM public.user_guilds ug
WHERE ug.has_admin_permission AND (ug.admin_verified_until>now() OR ug.is_demo_access);
REVOKE ALL ON public.verified_user_guilds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.verified_user_guilds TO authenticated,service_role;

-- Every existing guild RLS join reads user_guilds under the caller's RLS. Hiding
-- expired positive claims also closes direct REST/browser access consistently.
DROP POLICY IF EXISTS "Users can view their own guild links" ON public.user_guilds;
CREATE POLICY "Users can view their own guild links" ON public.user_guilds
FOR SELECT TO authenticated USING (
  user_id=(SELECT auth.uid()) AND (
    NOT has_admin_permission OR admin_verified_until>now() OR is_demo_access
  )
);
-- A browser must not turn a demo guild into a real Discord server or reassign
-- its owner while retaining its server-created demo authorization.
REVOKE ALL ON public.guilds FROM anon;
DROP POLICY IF EXISTS "Allow anon read guilds" ON public.guilds;
DROP POLICY IF EXISTS "Authenticated users can insert guilds" ON public.guilds;
REVOKE INSERT,TRUNCATE,REFERENCES,TRIGGER ON public.guilds FROM authenticated;
REVOKE UPDATE ON public.guilds FROM authenticated;
GRANT UPDATE (guild_name,guild_icon,command_prefix,log_channel_id,
  auto_moderation_enabled,updated_at,whitelist_role_id,staff_role_id,
  automod_bypass_role_ids) ON public.guilds TO authenticated;
NOTIFY pgrst, 'reload schema';
