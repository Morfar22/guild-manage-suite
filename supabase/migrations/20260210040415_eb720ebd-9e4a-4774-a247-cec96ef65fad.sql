
-- Add control_channel_id to jtc_channels to track the paired text channel
ALTER TABLE public.jtc_channels ADD COLUMN control_channel_id text;
