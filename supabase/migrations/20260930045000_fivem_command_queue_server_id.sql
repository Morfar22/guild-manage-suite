-- Scope FiveM remote commands to a specific server instance.
-- Existing rows stay compatible through the "main" default.

ALTER TABLE public.fivem_command_queue
  ADD COLUMN IF NOT EXISTS server_id text NOT NULL DEFAULT 'main';

CREATE INDEX IF NOT EXISTS idx_fivem_command_queue_guild_server_status
  ON public.fivem_command_queue (guild_id, server_id, status, created_at);

COMMENT ON COLUMN public.fivem_command_queue.server_id IS
  'FiveM bridge instance ID from gms_server_id. Prevents multiple servers in one Discord guild from racing the same command.';
