-- Allow anon to read global_bans (needed for bot realtime subscription)
CREATE POLICY "Allow anon select for bot realtime"
ON public.global_bans
FOR SELECT
TO anon
USING (true);

-- Allow anon to read and update global_ban_executions (bot needs to fetch and mark as executed)
CREATE POLICY "Allow anon select executions"
ON public.global_ban_executions
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon update executions"
ON public.global_ban_executions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);