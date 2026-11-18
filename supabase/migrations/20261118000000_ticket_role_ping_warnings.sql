ALTER TABLE public.ticket_settings
  ADD COLUMN IF NOT EXISTS role_ping_warning_role_ids text[] NOT NULL DEFAULT '{}';
