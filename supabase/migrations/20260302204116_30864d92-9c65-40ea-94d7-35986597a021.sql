-- Add new log event columns to log_settings
ALTER TABLE public.log_settings 
  ADD COLUMN IF NOT EXISTS log_member_timeout boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_member_untimeout boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_server_update boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_message_pin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_message_unpin boolean DEFAULT false;