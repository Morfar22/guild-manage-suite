
-- Dashboard audit log
CREATE TABLE public.dashboard_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dashboard_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their guild audit logs"
  ON public.dashboard_audit_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = dashboard_audit_log.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert audit logs for their guilds"
  ON public.dashboard_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = dashboard_audit_log.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

-- Reminders table
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id uuid NOT NULL,
  target_channel_id text,
  target_user_discord_id text,
  message text NOT NULL,
  remind_at timestamptz NOT NULL,
  is_sent boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  recurrence_interval text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their guild reminders"
  ON public.reminders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reminders.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert reminders"
  ON public.reminders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reminders.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can update their guild reminders"
  ON public.reminders FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reminders.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can delete their guild reminders"
  ON public.reminders FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reminders.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

-- Bot can read/update reminders
CREATE POLICY "Anon can select reminders" ON public.reminders FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update reminders" ON public.reminders FOR UPDATE TO anon USING (true);

-- Auto-report settings table
CREATE TABLE public.auto_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  channel_id text,
  frequency text DEFAULT 'weekly',
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.auto_report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage auto report settings"
  ON public.auto_report_settings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = auto_report_settings.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Anon can select auto report settings" ON public.auto_report_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update auto report settings" ON public.auto_report_settings FOR UPDATE TO anon USING (true);

-- Enable realtime for reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
