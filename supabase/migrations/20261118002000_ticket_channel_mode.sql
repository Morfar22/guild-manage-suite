ALTER TABLE public.ticket_settings
  ADD COLUMN IF NOT EXISTS ticket_channel_mode text NOT NULL DEFAULT 'thread'
  CHECK (ticket_channel_mode IN ('thread', 'channel'));
