CREATE TABLE public.honeypot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  channel_id TEXT,
  warning_message TEXT DEFAULT '⚠️ Skriv IKKE i denne kanal. Enhver besked her medfører automatisk udsmidning og rapportering til det globale ban-system. Kanalen bruges til at fange hackede konti og spam-bots.',
  action TEXT NOT NULL DEFAULT 'kick' CHECK (action IN ('none','kick','ban')),
  delete_message BOOLEAN NOT NULL DEFAULT true,
  report_global_ban BOOLEAN NOT NULL DEFAULT true,
  report_severity TEXT NOT NULL DEFAULT 'scam',
  log_channel_id TEXT,
  ignore_roles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.honeypot_settings TO authenticated;
GRANT SELECT ON public.honeypot_settings TO anon;
GRANT ALL ON public.honeypot_settings TO service_role;
ALTER TABLE public.honeypot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "honeypot_settings_select" ON public.honeypot_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "honeypot_settings_all" ON public.honeypot_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "honeypot_settings_bot_select" ON public.honeypot_settings FOR SELECT TO anon USING (true);
CREATE TRIGGER update_honeypot_settings_updated_at BEFORE UPDATE ON public.honeypot_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.honeypot_catches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  message_content TEXT,
  action_taken TEXT NOT NULL DEFAULT 'kick',
  global_ban_report_id UUID REFERENCES public.global_ban_reports(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_honeypot_catches_guild ON public.honeypot_catches(guild_id, created_at DESC);
GRANT SELECT, DELETE ON public.honeypot_catches TO authenticated;
GRANT SELECT, INSERT ON public.honeypot_catches TO anon;
GRANT ALL ON public.honeypot_catches TO service_role;
ALTER TABLE public.honeypot_catches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "honeypot_catches_select" ON public.honeypot_catches FOR SELECT TO authenticated USING (true);
CREATE POLICY "honeypot_catches_delete" ON public.honeypot_catches FOR DELETE TO authenticated USING (true);
CREATE POLICY "honeypot_catches_bot_insert" ON public.honeypot_catches FOR INSERT TO anon WITH CHECK (true);

-- Allow the bot to create global ban reports from honeypot catches
DROP POLICY IF EXISTS "global_ban_reports_bot_insert" ON public.global_ban_reports;
CREATE POLICY "global_ban_reports_bot_insert" ON public.global_ban_reports FOR INSERT TO anon WITH CHECK (true);
GRANT INSERT ON public.global_ban_reports TO anon;