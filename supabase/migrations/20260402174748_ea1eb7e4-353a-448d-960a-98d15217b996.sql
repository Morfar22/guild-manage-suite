DROP POLICY "Users can view bot status for their guilds" ON public.bot_status;

CREATE POLICY "Users and admins can view bot status"
ON public.bot_status
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = bot_status.guild_id
    AND user_guilds.user_id = auth.uid()
  )
  OR public.has_admin_or_staff_role(auth.uid())
);