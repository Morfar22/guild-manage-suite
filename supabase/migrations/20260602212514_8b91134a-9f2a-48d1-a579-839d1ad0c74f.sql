-- 1. Udvid application_forms med Pro-felter
ALTER TABLE public.application_forms
  ADD COLUMN IF NOT EXISTS ai_screening_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_screening_prompt text,
  ADD COLUMN IF NOT EXISTS ai_auto_approve_threshold integer,
  ADD COLUMN IF NOT EXISTS ai_auto_deny_threshold integer,
  ADD COLUMN IF NOT EXISTS interview_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interview_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS interview_category_id text,
  ADD COLUMN IF NOT EXISTS stages jsonb NOT NULL DEFAULT '["screening","final"]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_account_age_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blacklist_role_ids text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS required_role_ids text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS max_pending_per_user integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#5865F2',
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS submit_message text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Udvid application_submissions med Pro-felter
ALTER TABLE public.application_submissions
  ADD COLUMN IF NOT EXISTS ai_score integer,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'screening',
  ADD COLUMN IF NOT EXISTS interview_thread_id text,
  ADD COLUMN IF NOT EXISTS interview_answers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS votes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_message_id text,
  ADD COLUMN IF NOT EXISTS review_channel_id text,
  ADD COLUMN IF NOT EXISTS time_to_review_seconds integer;

-- 3. Audit-log tabel
CREATE TABLE IF NOT EXISTS public.application_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.application_submissions(id) ON DELETE CASCADE,
  form_id uuid REFERENCES public.application_forms(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'staff',
  actor_id text,
  actor_name text,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_audit_submission ON public.application_audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_application_audit_guild ON public.application_audit_log(guild_id, created_at DESC);

GRANT SELECT ON public.application_audit_log TO anon;
GRANT SELECT, INSERT ON public.application_audit_log TO authenticated;
GRANT ALL ON public.application_audit_log TO service_role;

ALTER TABLE public.application_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert audit log"
  ON public.application_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view audit log"
  ON public.application_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_audit_log.guild_id
      AND user_guilds.user_id = auth.uid()
      AND user_guilds.has_admin_permission = true
  ));

-- 4. Helper: Tjek om guild har applications_pro
CREATE OR REPLACE FUNCTION public.guild_has_applications_pro(_guild_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guild_premium_features
    WHERE guild_id = _guild_id
      AND feature IN ('applications_pro', 'premium', 'all_features')
      AND enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

GRANT EXECUTE ON FUNCTION public.guild_has_applications_pro(uuid) TO anon, authenticated, service_role;