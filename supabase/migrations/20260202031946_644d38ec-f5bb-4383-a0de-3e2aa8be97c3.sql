-- Create a table to track recent log events for deduplication
CREATE TABLE IF NOT EXISTS public.log_event_dedup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_hash TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on event_hash to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_log_event_dedup_hash ON public.log_event_dedup(event_hash);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_log_event_dedup_created ON public.log_event_dedup(created_at);

-- Function to clean up old dedup entries (older than 30 seconds)
CREATE OR REPLACE FUNCTION public.cleanup_old_log_dedup()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.log_event_dedup WHERE created_at < now() - interval '30 seconds';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-cleanup on each insert
DROP TRIGGER IF EXISTS trigger_cleanup_log_dedup ON public.log_event_dedup;
CREATE TRIGGER trigger_cleanup_log_dedup
  AFTER INSERT ON public.log_event_dedup
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_log_dedup();