-- Add scheduled restart fields to fivem_server_status
ALTER TABLE public.fivem_server_status 
ADD COLUMN IF NOT EXISTS next_restart_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS restart_schedule text[] DEFAULT '{}'::text[];