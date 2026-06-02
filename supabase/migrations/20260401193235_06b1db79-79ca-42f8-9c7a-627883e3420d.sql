
-- YouTube channels to track
CREATE TABLE public.youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  youtube_channel_id text NOT NULL,
  channel_name text,
  channel_url text,
  profile_image_url text,
  notification_channel_id text NOT NULL,
  live_channel_id text,
  mention_role_id text,
  enabled boolean NOT NULL DEFAULT true,
  custom_message text,
  last_video_id text,
  last_check_at timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  last_live_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id, youtube_channel_id)
);

ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view youtube_channels for their guilds"
  ON public.youtube_channels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert youtube_channels"
  ON public.youtube_channels FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update youtube_channels"
  ON public.youtube_channels FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Users can delete youtube_channels"
  ON public.youtube_channels FOR DELETE TO authenticated
  USING (true);

-- YouTube settings per guild
CREATE TABLE public.youtube_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  new_video_message text DEFAULT '📺 **{channel}** har uploadet en ny video!',
  live_message text DEFAULT '🔴 **{channel}** er nu LIVE på YouTube!',
  offline_message text DEFAULT '⚫ **{channel}** er gået offline på YouTube.',
  embed_color text DEFAULT '#FF0000',
  live_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view youtube_settings"
  ON public.youtube_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert youtube_settings"
  ON public.youtube_settings FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update youtube_settings"
  ON public.youtube_settings FOR UPDATE TO authenticated
  USING (true);

-- YouTube notification logs
CREATE TABLE public.youtube_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  youtube_channel_db_id uuid REFERENCES public.youtube_channels(id) ON DELETE SET NULL,
  youtube_channel_name text,
  video_id text,
  video_url text,
  video_title text,
  notification_type text NOT NULL DEFAULT 'new_video',
  channel_id text,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view youtube_notification_logs"
  ON public.youtube_notification_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert youtube_notification_logs"
  ON public.youtube_notification_logs FOR INSERT TO authenticated
  WITH CHECK (true);
