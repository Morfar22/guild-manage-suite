
-- =============================================
-- FASE 1: SAMLET DATABASE MIGRATION
-- 9 nye tabeller + kolonneændringer + RLS + Realtime
-- =============================================

-- 1. Ændringer til eksisterende tabeller
ALTER TABLE public.global_bans ADD COLUMN IF NOT EXISTS severity text DEFAULT 'other';
ALTER TABLE public.global_ban_reports ADD COLUMN IF NOT EXISTS severity text DEFAULT 'other';

ALTER TABLE public.guild_bot_settings 
  ADD COLUMN IF NOT EXISTS global_ban_severity_filter jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS global_ban_auto_action text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_backup_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_backup_interval text DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS auto_backup_last_run timestamptz DEFAULT NULL;

-- 2. global_ban_appeals
CREATE TABLE public.global_ban_appeals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ban_id uuid NOT NULL REFERENCES public.global_bans(id) ON DELETE CASCADE,
  appellant_discord_id text NOT NULL,
  appellant_discord_name text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_ban_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view appeals"
  ON public.global_ban_appeals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/staff can manage appeals"
  ON public.global_ban_appeals FOR ALL
  USING (public.has_admin_or_staff_role(auth.uid()));

-- 3. global_ban_alerts
CREATE TABLE public.global_ban_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  ban_id uuid NOT NULL REFERENCES public.global_bans(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  alert_type text NOT NULL DEFAULT 'warning',
  action_taken text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_ban_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alerts"
  ON public.global_ban_alerts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/staff can manage alerts"
  ON public.global_ban_alerts FOR ALL
  USING (public.has_admin_or_staff_role(auth.uid()));

-- 4. scheduled_actions
CREATE TABLE public.scheduled_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('mute', 'ban', 'unban', 'role_add', 'role_remove', 'kick')),
  target_discord_id text NOT NULL,
  target_name text,
  execute_at timestamptz NOT NULL,
  executed boolean NOT NULL DEFAULT false,
  executed_at timestamptz,
  reason text,
  role_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scheduled actions"
  ON public.scheduled_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create scheduled actions"
  ON public.scheduled_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scheduled actions"
  ON public.scheduled_actions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete scheduled actions"
  ON public.scheduled_actions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 5. moderation_templates
CREATE TABLE public.moderation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view moderation templates"
  ON public.moderation_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage moderation templates"
  ON public.moderation_templates FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_moderation_templates_updated_at
  BEFORE UPDATE ON public.moderation_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. afk_status
CREATE TABLE public.afk_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL,
  user_name text,
  message text DEFAULT 'AFK',
  set_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_discord_id)
);

ALTER TABLE public.afk_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view afk status"
  ON public.afk_status FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/staff can manage afk status"
  ON public.afk_status FOR ALL
  USING (public.has_admin_or_staff_role(auth.uid()));

-- 7. polls
CREATE TABLE public.polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id text,
  message_id text,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  votes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ends_at timestamptz,
  ended boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view polls"
  ON public.polls FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update polls"
  ON public.polls FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete polls"
  ON public.polls FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 8. auto_responders
CREATE TABLE public.auto_responders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword', 'regex', 'exact')),
  trigger_text text NOT NULL,
  response_type text NOT NULL DEFAULT 'text' CHECK (response_type IN ('text', 'embed')),
  response_content text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_responders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view auto responders"
  ON public.auto_responders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage auto responders"
  ON public.auto_responders FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_auto_responders_updated_at
  BEFORE UPDATE ON public.auto_responders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. member_activity
CREATE TABLE public.member_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL,
  user_name text,
  last_message_at timestamptz,
  last_voice_at timestamptz,
  message_count_30d integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_discord_id)
);

ALTER TABLE public.member_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view member activity"
  ON public.member_activity FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/staff can manage member activity"
  ON public.member_activity FOR ALL
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE TRIGGER update_member_activity_updated_at
  BEFORE UPDATE ON public.member_activity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. role_menus
CREATE TABLE public.role_menus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_id text,
  message_id text,
  menu_type text NOT NULL DEFAULT 'buttons' CHECK (menu_type IN ('buttons', 'dropdown')),
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_roles integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role menus"
  ON public.role_menus FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage role menus"
  ON public.role_menus FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_role_menus_updated_at
  BEFORE UPDATE ON public.role_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.afk_status;
