
-- Dashboard notifications table
CREATE TABLE public.dashboard_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_notifications_guild ON public.dashboard_notifications(guild_id, is_read, created_at DESC);

ALTER TABLE public.dashboard_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read notifications for their guilds"
  ON public.dashboard_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Bot can insert notifications"
  ON public.dashboard_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update read status"
  ON public.dashboard_notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_notifications;

-- Webhook configs table
CREATE TABLE public.webhook_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  channel_id TEXT,
  channel_name TEXT,
  avatar_url TEXT,
  event_types TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage webhook configs"
  ON public.webhook_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
