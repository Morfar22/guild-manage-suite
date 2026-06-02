
CREATE TABLE public.bot_console_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'bot',
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_console_logs_guild_created ON public.bot_console_logs(guild_id, created_at DESC);
CREATE INDEX idx_bot_console_logs_level ON public.bot_console_logs(level);

ALTER TABLE public.bot_console_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all console logs" ON public.bot_console_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can insert console logs" ON public.bot_console_logs
  FOR INSERT WITH CHECK (true);
