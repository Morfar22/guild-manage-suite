
-- Table for triggering force updates from the dashboard
CREATE TABLE public.stats_force_update (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stats_force_update ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert (trigger from dashboard)
CREATE POLICY "Authenticated users can insert force update"
ON public.stats_force_update
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Anon can read (bot needs to see via realtime)
CREATE POLICY "Allow anon read stats_force_update"
ON public.stats_force_update
FOR SELECT
USING (true);

-- Anon can delete (bot cleanup)
CREATE POLICY "Allow anon delete stats_force_update"
ON public.stats_force_update
FOR DELETE
USING (true);

-- Enable realtime so bot can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.stats_force_update;
