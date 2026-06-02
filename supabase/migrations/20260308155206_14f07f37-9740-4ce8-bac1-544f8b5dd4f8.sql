
-- TikTok accounts to track
CREATE TABLE public.tiktok_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  tiktok_username TEXT NOT NULL,
  display_name TEXT,
  profile_image_url TEXT,
  notification_channel_id TEXT NOT NULL,
  mention_role_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  custom_message TEXT,
  last_video_id TEXT,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, tiktok_username)
);

-- TikTok notification logs
CREATE TABLE public.tiktok_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  tiktok_account_id UUID REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE NOT NULL,
  tiktok_username TEXT NOT NULL,
  video_id TEXT,
  video_url TEXT,
  video_title TEXT,
  notification_type TEXT NOT NULL DEFAULT 'new_video',
  channel_id TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TikTok settings per guild
CREATE TABLE public.tiktok_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  new_video_message TEXT DEFAULT '🎵 **{username}** har uploadet en ny TikTok!',
  embed_color TEXT DEFAULT '#000000',
  auto_embed_links BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_settings ENABLE ROW LEVEL SECURITY;

-- Policies for tiktok_accounts
CREATE POLICY "Users can view tiktok accounts for their guilds" ON public.tiktok_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert tiktok accounts" ON public.tiktok_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update tiktok accounts" ON public.tiktok_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete tiktok accounts" ON public.tiktok_accounts FOR DELETE TO authenticated USING (true);

-- Policies for tiktok_notification_logs
CREATE POLICY "Users can view tiktok notification logs" ON public.tiktok_notification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert tiktok notification logs" ON public.tiktok_notification_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for tiktok_settings
CREATE POLICY "Users can view tiktok settings" ON public.tiktok_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert tiktok settings" ON public.tiktok_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update tiktok settings" ON public.tiktok_settings FOR UPDATE TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_tiktok_accounts_updated_at BEFORE UPDATE ON public.tiktok_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tiktok_settings_updated_at BEFORE UPDATE ON public.tiktok_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for notification logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_notification_logs;
