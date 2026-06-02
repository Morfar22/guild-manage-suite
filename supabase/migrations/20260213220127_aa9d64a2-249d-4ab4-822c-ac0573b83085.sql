
-- Allow anon to read polls (needed for bot realtime + voting)
CREATE POLICY "Allow anon select polls"
ON public.polls
FOR SELECT
TO anon
USING (true);

-- Allow anon to update polls (bot saves message_id and vote counts)
CREATE POLICY "Allow anon update polls"
ON public.polls
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
