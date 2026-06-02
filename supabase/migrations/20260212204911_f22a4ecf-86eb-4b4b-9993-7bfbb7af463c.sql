-- Allow bot (anon key) to read guilds for join queries
CREATE POLICY "Allow anon read guilds"
ON public.guilds
FOR SELECT
USING (true);
