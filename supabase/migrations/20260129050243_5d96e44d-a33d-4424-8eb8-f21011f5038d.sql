-- Drop the existing ALL policy and create proper separate policies
DROP POLICY IF EXISTS "Users can manage their guild ticket categories" ON public.ticket_categories;

-- Create INSERT policy with WITH CHECK
CREATE POLICY "Users can insert their guild ticket categories"
ON public.ticket_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = ticket_categories.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  )
);

-- Create UPDATE policy
CREATE POLICY "Users can update their guild ticket categories"
ON public.ticket_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = ticket_categories.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  )
);

-- Create DELETE policy
CREATE POLICY "Users can delete their guild ticket categories"
ON public.ticket_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = ticket_categories.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  )
);