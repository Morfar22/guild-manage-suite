
ALTER TABLE public.twitch_settings
  ADD COLUMN IF NOT EXISTS live_role_id text;

ALTER TABLE public.twitch_streamers
  ADD COLUMN IF NOT EXISTS discord_user_id text;
