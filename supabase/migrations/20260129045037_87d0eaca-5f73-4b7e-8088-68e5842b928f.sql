-- Fix the overly permissive RLS policy by splitting into specific operations
DROP POLICY "Users can manage their guild ticket settings" ON public.ticket_settings;

CREATE POLICY "Users can insert their guild ticket settings"
ON public.ticket_settings
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = ticket_settings.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild ticket settings"
ON public.ticket_settings
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = ticket_settings.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild ticket settings"
ON public.ticket_settings
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = ticket_settings.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));