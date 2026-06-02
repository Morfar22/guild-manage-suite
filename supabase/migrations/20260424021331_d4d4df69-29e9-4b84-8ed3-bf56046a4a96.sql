ALTER TABLE public.twitch_streamers
  ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quota_type text NOT NULL DEFAULT 'streams',
  ADD COLUMN IF NOT EXISTS quota_streams_per_week integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS quota_hours_per_week numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS current_week_streams integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_week_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stream_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_quota_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS warning_sent_this_week boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quota_met_this_week boolean NOT NULL DEFAULT false;

ALTER TABLE public.twitch_settings
  ADD COLUMN IF NOT EXISTS partner_tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_staff_channel_id text,
  ADD COLUMN IF NOT EXISTS partner_warning_days_before integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS partner_inactive_role_id text,
  ADD COLUMN IF NOT EXISTS partner_warning_dm text DEFAULT 'Hej {streamer}! Du mangler stadig at opfylde din ugentlige stream-kvote på {server}. Du har {progress} ud af {goal} indtil søndag aften. 💜',
  ADD COLUMN IF NOT EXISTS partner_staff_alert_template text DEFAULT '⚠️ **{streamer}** har ikke ramt sin ugentlige kvote endnu ({progress}/{goal})';

CREATE TABLE IF NOT EXISTS public.twitch_partner_weekly_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  streamer_id uuid NOT NULL REFERENCES public.twitch_streamers(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  streams_count integer NOT NULL DEFAULT 0,
  minutes_streamed integer NOT NULL DEFAULT 0,
  quota_type text NOT NULL DEFAULT 'streams',
  quota_streams_goal integer NOT NULL DEFAULT 0,
  quota_hours_goal numeric NOT NULL DEFAULT 0,
  quota_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(streamer_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_partner_weekly_stats_guild ON public.twitch_partner_weekly_stats(guild_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_partner_weekly_stats_streamer ON public.twitch_partner_weekly_stats(streamer_id, week_start DESC);

ALTER TABLE public.twitch_partner_weekly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read partner weekly stats"
  ON public.twitch_partner_weekly_stats FOR SELECT USING (true);

CREATE POLICY "Allow anon insert partner weekly stats"
  ON public.twitch_partner_weekly_stats FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update partner weekly stats"
  ON public.twitch_partner_weekly_stats FOR UPDATE USING (true);

CREATE POLICY "Allow anon delete partner weekly stats"
  ON public.twitch_partner_weekly_stats FOR DELETE USING (true);