-- Add statistics and filtering columns to twitch_streamers
ALTER TABLE public.twitch_streamers
ADD COLUMN IF NOT EXISTS stream_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_viewers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_viewers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_stream_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_game_name text,
ADD COLUMN IF NOT EXISTS last_stream_title text,
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS min_viewers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS allowed_games text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS blocked_games text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_live_message text,
ADD COLUMN IF NOT EXISTS custom_embed_color text,
ADD COLUMN IF NOT EXISTS notification_cooldown_minutes integer DEFAULT 0;

-- Create notification log table
CREATE TABLE IF NOT EXISTS public.twitch_notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  streamer_id uuid NOT NULL REFERENCES public.twitch_streamers(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'live' or 'offline'
  stream_title text,
  game_name text,
  viewer_count integer,
  thumbnail_url text,
  channel_id text NOT NULL,
  message_id text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.twitch_notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification logs
CREATE POLICY "Users can view their guild notification logs"
ON public.twitch_notification_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = twitch_notification_logs.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_twitch_notification_logs_guild_id ON public.twitch_notification_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_twitch_notification_logs_streamer_id ON public.twitch_notification_logs(streamer_id);
CREATE INDEX IF NOT EXISTS idx_twitch_notification_logs_sent_at ON public.twitch_notification_logs(sent_at DESC);