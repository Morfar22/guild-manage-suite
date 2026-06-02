-- Add INSERT, UPDATE, DELETE policies for applications table
CREATE POLICY "Users can update their guild applications"
ON public.applications FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = applications.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add INSERT, UPDATE, DELETE policies for characters table  
CREATE POLICY "Users can insert characters for their guild"
ON public.characters FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = characters.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update characters in their guild"
ON public.characters FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = characters.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete characters in their guild"
ON public.characters FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = characters.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));