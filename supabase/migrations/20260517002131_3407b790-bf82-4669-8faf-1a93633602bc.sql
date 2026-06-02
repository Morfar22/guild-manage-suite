
DROP POLICY IF EXISTS "Admins can manage birthday settings" ON public.birthday_settings;
DROP POLICY IF EXISTS "Admins can manage birthdays" ON public.birthdays;

CREATE POLICY "Guild admins can insert birthday settings"
ON public.birthday_settings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthday_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Guild admins can update birthday settings"
ON public.birthday_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthday_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthday_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Guild admins can delete birthday settings"
ON public.birthday_settings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthday_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Guild admins can insert birthdays"
ON public.birthdays FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthdays.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Guild admins can update birthdays"
ON public.birthdays FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthdays.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthdays.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Guild admins can delete birthdays"
ON public.birthdays FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = birthdays.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true) OR has_admin_or_staff_role(auth.uid()));
