
CREATE TABLE public.twitch_stream_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  streamer_id UUID NOT NULL REFERENCES public.twitch_streamers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT,
  game_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.twitch_schedule_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
  auto_post_enabled BOOLEAN NOT NULL DEFAULT false,
  post_channel_id TEXT,
  post_day INTEGER NOT NULL DEFAULT 1,
  post_time TIME NOT NULL DEFAULT '09:00',
  last_posted_at TIMESTAMP WITH TIME ZONE,
  fetch_from_twitch BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.twitch_stream_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitch_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedules for their guilds" ON public.twitch_stream_schedules
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_guilds WHERE guild_id = twitch_stream_schedules.guild_id AND user_id = auth.uid())
  OR public.has_admin_or_staff_role(auth.uid())
);

CREATE POLICY "Users can manage schedules for their guilds" ON public.twitch_stream_schedules
FOR ALL USING (
  EXISTS (SELECT 1 FROM user_guilds WHERE guild_id = twitch_stream_schedules.guild_id AND user_id = auth.uid())
  OR public.has_admin_or_staff_role(auth.uid())
);

CREATE POLICY "Users can view schedule settings for their guilds" ON public.twitch_schedule_settings
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_guilds WHERE guild_id = twitch_schedule_settings.guild_id AND user_id = auth.uid())
  OR public.has_admin_or_staff_role(auth.uid())
);

CREATE POLICY "Users can manage schedule settings for their guilds" ON public.twitch_schedule_settings
FOR ALL USING (
  EXISTS (SELECT 1 FROM user_guilds WHERE guild_id = twitch_schedule_settings.guild_id AND user_id = auth.uid())
  OR public.has_admin_or_staff_role(auth.uid())
);

CREATE TRIGGER update_twitch_stream_schedules_updated_at
  BEFORE UPDATE ON public.twitch_stream_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_twitch_schedule_settings_updated_at
  BEFORE UPDATE ON public.twitch_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
