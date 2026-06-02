-- Restrict the public guilds read policy to anon role only (used by bot/edge functions),
-- so authenticated users only see guilds via their user_guilds membership or admin role.
DROP POLICY IF EXISTS "Allow anon read guilds" ON public.guilds;

CREATE POLICY "Allow anon read guilds"
ON public.guilds
FOR SELECT
TO anon
USING (true);