ALTER TABLE public.ticket_settings
  ADD COLUMN IF NOT EXISTS user_ping_warning_user_ids text[] NOT NULL DEFAULT '{}';
