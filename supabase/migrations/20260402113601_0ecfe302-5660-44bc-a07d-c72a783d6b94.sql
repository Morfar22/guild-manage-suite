
-- Raid Protection Settings
CREATE TABLE public.raid_protection_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  join_threshold INTEGER NOT NULL DEFAULT 10,
  time_window_seconds INTEGER NOT NULL DEFAULT 30,
  lockdown_duration_minutes INTEGER NOT NULL DEFAULT 10,
  action TEXT NOT NULL DEFAULT 'lockdown',
  log_channel_id TEXT,
  quarantine_role_id TEXT,
  notify_staff BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.raid_protection_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raid_protection_select" ON public.raid_protection_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "raid_protection_all" ON public.raid_protection_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Raid Logs
CREATE TABLE public.raid_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  join_count INTEGER NOT NULL,
  action_taken TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  user_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.raid_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raid_logs_select" ON public.raid_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "raid_logs_insert" ON public.raid_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Slowmode Schedules
CREATE TABLE public.slowmode_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  start_hour INTEGER NOT NULL DEFAULT 0,
  end_hour INTEGER NOT NULL DEFAULT 23,
  slowmode_seconds INTEGER NOT NULL DEFAULT 5,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.slowmode_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slowmode_select" ON public.slowmode_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "slowmode_all" ON public.slowmode_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quarantine Settings
CREATE TABLE public.quarantine_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  quarantine_role_id TEXT,
  log_channel_id TEXT,
  auto_quarantine_days INTEGER NOT NULL DEFAULT 7,
  require_verification BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quarantine_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quarantine_settings_select" ON public.quarantine_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "quarantine_settings_all" ON public.quarantine_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quarantine Entries
CREATE TABLE public.quarantine_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  reason TEXT,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  released_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quarantine_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quarantine_entries_select" ON public.quarantine_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "quarantine_entries_all" ON public.quarantine_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quarantine_entries_bot" ON public.quarantine_entries FOR INSERT TO anon WITH CHECK (true);
