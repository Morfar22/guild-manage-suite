BEGIN;

-- Discord membership is a server-verified claim, never a browser-provided one.
-- Keep the existing global-admin management policy and own-link SELECT policy.
DROP POLICY IF EXISTS "Users can insert their own guild links" ON public.user_guilds;

-- Existing links may have been self-created under the old policy. Require a new
-- Discord OAuth sync for real servers rather than trusting these historical flags.
UPDATE public.user_guilds AS links
SET has_admin_permission = false
FROM public.guilds AS guild
WHERE guild.id = links.guild_id
  AND guild.guild_id NOT LIKE 'demo\_%' ESCAPE '\';

-- Tracking is written by trusted bot/server processes with service-role access.
DROP POLICY IF EXISTS "Allow anon read partner weekly stats" ON public.twitch_partner_weekly_stats;
DROP POLICY IF EXISTS "Allow anon insert partner weekly stats" ON public.twitch_partner_weekly_stats;
DROP POLICY IF EXISTS "Allow anon update partner weekly stats" ON public.twitch_partner_weekly_stats;
DROP POLICY IF EXISTS "Allow anon delete partner weekly stats" ON public.twitch_partner_weekly_stats;

CREATE POLICY "Guild admins can read partner weekly stats"
ON public.twitch_partner_weekly_stats FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_guilds AS links
    WHERE links.guild_id = twitch_partner_weekly_stats.guild_id
      AND links.user_id = auth.uid()
      AND links.has_admin_permission = true
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;
