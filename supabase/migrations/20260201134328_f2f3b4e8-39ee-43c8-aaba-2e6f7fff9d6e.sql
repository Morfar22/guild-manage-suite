-- Add column to store the Discord status message ID
ALTER TABLE public.fivem_settings
ADD COLUMN IF NOT EXISTS status_message_id text;