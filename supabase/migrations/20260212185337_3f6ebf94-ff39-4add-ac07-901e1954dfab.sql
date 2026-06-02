
-- =============================================
-- Feature 1: Suggestion/Poll System
-- =============================================

CREATE TABLE public.suggestion_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT,
  color TEXT DEFAULT '#5865F2',
  anonymous_mode BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.suggestion_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage suggestion_settings"
  ON public.suggestion_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  message_id TEXT,
  channel_id TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  staff_response TEXT,
  responded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage suggestions"
  ON public.suggestions FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Feature 2: Verification System
-- =============================================

CREATE TABLE public.verification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  channel_id TEXT,
  role_id TEXT,
  method TEXT DEFAULT 'button',
  welcome_message TEXT DEFAULT 'Klik på knappen nedenfor for at verificere dig!',
  rate_limit_per_minute INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage verification_settings"
  ON public.verification_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  method TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage verification_logs"
  ON public.verification_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Feature 3: Custom Embed Builder
-- =============================================

CREATE TABLE public.saved_embeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  embed_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage saved_embeds"
  ON public.saved_embeds FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Feature 4: Backup & Restore System
-- =============================================

CREATE TABLE public.server_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL DEFAULT 'manual',
  backup_data JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.server_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage server_backups"
  ON public.server_backups FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Feature 5: Server Stats Channels
-- =============================================

CREATE TABLE public.stats_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT,
  stat_type TEXT NOT NULL DEFAULT 'members',
  format_template TEXT NOT NULL DEFAULT '📊 Members: {count}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stats_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage stats_channels"
  ON public.stats_channels FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Triggers for updated_at
-- =============================================

CREATE TRIGGER update_suggestion_settings_updated_at
  BEFORE UPDATE ON public.suggestion_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_verification_settings_updated_at
  BEFORE UPDATE ON public.verification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_embeds_updated_at
  BEFORE UPDATE ON public.saved_embeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stats_channels_updated_at
  BEFORE UPDATE ON public.stats_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
