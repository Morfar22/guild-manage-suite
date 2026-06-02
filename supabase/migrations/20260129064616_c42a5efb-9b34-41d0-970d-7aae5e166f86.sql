-- Add granted_role_id to applications table to track which role was assigned
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS granted_role_id text;

-- Add transcript_channel_id to ticket_settings for sending transcripts when tickets close
ALTER TABLE public.ticket_settings 
ADD COLUMN IF NOT EXISTS transcript_channel_id text;