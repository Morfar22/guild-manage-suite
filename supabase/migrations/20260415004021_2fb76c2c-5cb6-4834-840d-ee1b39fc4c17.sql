
CREATE TABLE public.ai_safety_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  discord_user_id text NOT NULL,
  discord_username text,
  channel_id text,
  message_content text NOT NULL,
  matched_keywords text[] DEFAULT '{}',
  category text NOT NULL DEFAULT 'unknown',
  severity text NOT NULL DEFAULT 'medium',
  reviewed boolean NOT NULL DEFAULT false,
  admin_notes text,
  guild_name text,
  discord_guild_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_safety_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view safety logs"
  ON public.ai_safety_logs FOR SELECT
  TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Admins can update safety logs"
  ON public.ai_safety_logs FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Anon can insert safety logs"
  ON public.ai_safety_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_ai_safety_logs_created ON public.ai_safety_logs(created_at DESC);
CREATE INDEX idx_ai_safety_logs_category ON public.ai_safety_logs(category);
CREATE INDEX idx_ai_safety_logs_reviewed ON public.ai_safety_logs(reviewed);
