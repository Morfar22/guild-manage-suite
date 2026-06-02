-- Allow the bot (using anon key) to read stats_channels
CREATE POLICY "Allow anon read stats_channels"
ON public.stats_channels
FOR SELECT
USING (true);
