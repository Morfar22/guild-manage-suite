-- Enable RLS on log_event_dedup table
ALTER TABLE public.log_event_dedup ENABLE ROW LEVEL SECURITY;

-- Allow bot to insert/select via service role (no public access needed)
-- The table is only accessed by the edge function using service role key

-- Fix function search path
CREATE OR REPLACE FUNCTION public.cleanup_old_log_dedup()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.log_event_dedup WHERE created_at < now() - interval '30 seconds';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;