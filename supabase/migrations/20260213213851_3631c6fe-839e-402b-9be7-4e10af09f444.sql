
CREATE POLICY "Allow anon insert for bot analytics"
ON public.analytics_events
FOR INSERT
TO anon
WITH CHECK (true);
