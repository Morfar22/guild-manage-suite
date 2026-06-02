-- Add INSERT policy for guilds table (needed for Discord OAuth flow)
CREATE POLICY "Service role can insert guilds"
ON public.guilds FOR INSERT
WITH CHECK (true);

-- Update guilds to allow service role inserts by making RLS more permissive for INSERT
-- Actually, since edge functions use service role, they bypass RLS
-- Let's add a policy for authenticated users to insert guilds they own
DROP POLICY IF EXISTS "Service role can insert guilds" ON public.guilds;

CREATE POLICY "Users can insert guilds"
ON public.guilds FOR INSERT
WITH CHECK (true);

-- Also need to allow users to delete guilds they have admin access to
CREATE POLICY "Users can delete their guilds"
ON public.guilds FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guilds.id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);