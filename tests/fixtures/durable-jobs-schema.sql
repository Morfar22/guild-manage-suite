-- Minimal pre-migration schema matching the production scheduler tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
CREATE TABLE public.test_platform_roles (user_id uuid PRIMARY KEY);
CREATE FUNCTION public.has_admin_or_staff_role(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (SELECT 1 FROM public.test_platform_roles WHERE user_id = p_user_id);
$$;
GRANT SELECT ON public.test_platform_roles TO authenticated;
CREATE TABLE public.guilds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id text NOT NULL);
CREATE TABLE public.user_guilds (user_id uuid, guild_id uuid REFERENCES public.guilds(id), has_admin_permission boolean NOT NULL);
ALTER TABLE public.user_guilds ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_verified_membership ON public.user_guilds FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.user_guilds TO authenticated;
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL REFERENCES public.guilds(id),
  created_by_user_id uuid NOT NULL, target_channel_id text, target_user_discord_id text,
  message text NOT NULL, remind_at timestamptz NOT NULL, is_sent boolean DEFAULT false,
  is_recurring boolean DEFAULT false, recurrence_interval text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), sent boolean DEFAULT false
);
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL REFERENCES public.guilds(id),
  channel_id text NOT NULL, content text, embed jsonb, scheduled_at timestamptz NOT NULL,
  repeat_interval text CHECK (repeat_interval IN ('daily', 'weekly', 'monthly')),
  created_by_id text NOT NULL, created_by_name text, sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scheduled_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guild_id uuid NOT NULL REFERENCES public.guilds(id),
  action_type text NOT NULL, target_discord_id text NOT NULL, target_name text,
  execute_at timestamptz NOT NULL, executed boolean NOT NULL DEFAULT false, executed_at timestamptz,
  reason text, role_id text, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_actions ENABLE ROW LEVEL SECURITY;
-- Reproduce the legacy permissive grants/policies to prove the migration removes them.
CREATE POLICY "Anon can select reminders" ON public.reminders FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select scheduled_messages" ON public.scheduled_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update scheduled actions" ON public.scheduled_actions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.reminders, public.scheduled_messages, public.scheduled_actions TO anon, authenticated;
