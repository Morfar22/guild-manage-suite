
CREATE TABLE IF NOT EXISTS public.ai_automod_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  sensitivity integer DEFAULT 70,
  check_toxicity boolean DEFAULT true,
  check_spam boolean DEFAULT true,
  check_nsfw boolean DEFAULT true,
  check_hate_speech boolean DEFAULT true,
  custom_instructions text,
  log_channel_id text,
  action text DEFAULT 'delete',
  notify_moderators boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.ai_automod_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_automod_settings" ON public.ai_automod_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage ai_automod_settings" ON public.ai_automod_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
