
-- Create enum for report status
CREATE TYPE public.global_ban_status AS ENUM ('pending', 'approved', 'rejected');

-- Global ban reports table
CREATE TABLE public.global_ban_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_discord_id TEXT NOT NULL,
  reporter_discord_name TEXT NOT NULL,
  target_discord_id TEXT NOT NULL,
  target_discord_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status global_ban_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.global_ban_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
  ON public.global_ban_reports FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admin/staff can read all reports
CREATE POLICY "Admin/staff can read reports"
  ON public.global_ban_reports FOR SELECT TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- Admin/staff can update reports (approve/reject)
CREATE POLICY "Admin/staff can update reports"
  ON public.global_ban_reports FOR UPDATE TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- Global bans table
CREATE TABLE public.global_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.global_ban_reports(id),
  target_discord_id TEXT NOT NULL UNIQUE,
  target_discord_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.global_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff can read bans"
  ON public.global_bans FOR SELECT TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Admin/staff can insert bans"
  ON public.global_bans FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Admin/staff can delete bans"
  ON public.global_bans FOR DELETE TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- Global ban executions table
CREATE TABLE public.global_ban_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  global_ban_id UUID NOT NULL REFERENCES public.global_bans(id) ON DELETE CASCADE,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  executed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  executed_at TIMESTAMPTZ
);

ALTER TABLE public.global_ban_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff can read executions"
  ON public.global_ban_executions FOR SELECT TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- Add opt-out column to guild_bot_settings
ALTER TABLE public.guild_bot_settings
  ADD COLUMN global_ban_opt_out BOOLEAN NOT NULL DEFAULT false;

-- Enable realtime for global_bans so bot can listen
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_bans;
