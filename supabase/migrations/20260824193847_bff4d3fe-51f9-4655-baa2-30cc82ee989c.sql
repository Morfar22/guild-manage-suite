ALTER TABLE public.bot_status
  ADD COLUMN IF NOT EXISTS cpu_percent numeric,
  ADD COLUMN IF NOT EXISTS load_avg_1m numeric,
  ADD COLUMN IF NOT EXISTS memory_used_mb integer,
  ADD COLUMN IF NOT EXISTS memory_total_mb integer,
  ADD COLUMN IF NOT EXISTS process_memory_mb integer,
  ADD COLUMN IF NOT EXISTS disk_used_gb numeric,
  ADD COLUMN IF NOT EXISTS disk_total_gb numeric,
  ADD COLUMN IF NOT EXISTS uptime_seconds bigint,
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS bot_version text;