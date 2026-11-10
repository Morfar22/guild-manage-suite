-- Durable Discord jobs. Guild admins/platform staff manage their schedules; only service_role
-- can acquire/renew/finish leases. Historical completed rows are never replayed.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS created_by_id text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS repeat_interval text,
  ADD COLUMN IF NOT EXISTS sent boolean DEFAULT false;
ALTER TABLE public.reminders ALTER COLUMN created_by_user_id DROP NOT NULL;
UPDATE public.reminders
SET channel_id = COALESCE(channel_id, target_channel_id),
    repeat_interval = COALESCE(repeat_interval, recurrence_interval),
    created_by_id = COALESCE(created_by_id, created_by_user_id::text),
    sent = COALESCE(sent, false) OR COALESCE(is_sent, false),
    is_sent = COALESCE(sent, false) OR COALESCE(is_sent, false);

DO $migration$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reminders', 'scheduled_messages', 'scheduled_actions'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN delivery_status text NOT NULL DEFAULT ''pending'' CHECK (delivery_status IN (''pending'', ''processing'', ''sent'', ''failed'')),
      ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
      ADD COLUMN next_attempt_at timestamptz,
      ADD COLUMN last_attempt_at timestamptz,
      ADD COLUMN lease_token uuid,
      ADD COLUMN lease_expires_at timestamptz,
      ADD COLUMN last_error text,
      ADD COLUMN delivered_at timestamptz,
      ADD COLUMN delivery_message_id text,
      ADD COLUMN recurrence_parent_id uuid UNIQUE REFERENCES public.%I(id) ON DELETE SET NULL', t, t);
    EXECUTE format('CREATE INDEX %I ON public.%I (delivery_status, next_attempt_at, lease_expires_at)
      WHERE delivery_status IN (''pending'', ''processing'')', t || '_delivery_queue', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$migration$;
UPDATE public.reminders SET delivery_status = 'sent' WHERE sent OR is_sent;
UPDATE public.scheduled_messages SET delivery_status = 'sent', delivered_at = sent_at WHERE sent;
UPDATE public.scheduled_actions SET delivery_status = 'sent', delivered_at = executed_at WHERE executed;

-- Legacy queue policies included unconditional PUBLIC/anon access. Replace only
-- these three tables' policies, and keep worker-owned state out of browser writes.
DO $policies$
DECLARE t text; policy_row record; access_expr text; editable text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reminders', 'scheduled_messages', 'scheduled_actions'] LOOP
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, t);
    END LOOP;
    access_expr := format('(public.has_admin_or_staff_role((SELECT auth.uid())) OR EXISTS
      (SELECT 1 FROM public.user_guilds ug WHERE ug.guild_id = %I.guild_id
       AND ug.user_id = (SELECT auth.uid()) AND ug.has_admin_permission = true))', t);
    EXECUTE format('CREATE POLICY queue_read ON public.%I FOR SELECT TO authenticated USING (%s)', t, access_expr);
    EXECUTE format('CREATE POLICY queue_create ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t, access_expr);
    EXECUTE format('CREATE POLICY queue_edit ON public.%I FOR UPDATE TO authenticated
      USING (%s AND delivery_status IN (''pending'', ''failed'')) WITH CHECK (%s)', t, access_expr, access_expr);
    EXECUTE format('CREATE POLICY queue_delete ON public.%I FOR DELETE TO authenticated
      USING (%s AND delivery_status <> ''processing'')', t, access_expr);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, DELETE ON TABLE public.%I TO authenticated', t);
    editable := CASE t
      WHEN 'reminders' THEN 'guild_id,channel_id,target_channel_id,target_user_discord_id,message,remind_at,repeat_interval,recurrence_interval,is_recurring,created_by_id,created_by_name,created_by_user_id'
      WHEN 'scheduled_messages' THEN 'guild_id,channel_id,content,embed,scheduled_at,repeat_interval,created_by_id,created_by_name'
      ELSE 'guild_id,action_type,target_discord_id,target_name,execute_at,reason,role_id,created_by' END;
    EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.%I TO authenticated', editable, editable, t);
  END LOOP;
END;
$policies$;

CREATE FUNCTION public.claim_bot_job(p_table text, p_id uuid, p_lease_seconds integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  job jsonb;
  due_column text;
  ts timestamptz := clock_timestamp();
  token uuid := gen_random_uuid();
BEGIN
  IF p_table NOT IN ('reminders', 'scheduled_messages', 'scheduled_actions') THEN
    RAISE EXCEPTION 'Invalid job table';
  END IF;
  due_column := CASE p_table WHEN 'reminders' THEN 'remind_at' WHEN 'scheduled_messages' THEN 'scheduled_at' ELSE 'execute_at' END;
  EXECUTE format('SELECT to_jsonb(j) FROM public.%I j WHERE id = $1 FOR UPDATE', p_table) INTO job USING p_id;
  IF job IS NULL OR job->>'delivery_status' NOT IN ('pending', 'processing') OR (job->>due_column)::timestamptz > ts THEN RETURN NULL; END IF;
  IF job->>'delivery_status' = 'processing' AND (job->>'lease_expires_at')::timestamptz > ts THEN RETURN NULL; END IF;
  IF job->>'delivery_status' = 'pending' AND (job->>'next_attempt_at')::timestamptz > ts THEN RETURN NULL; END IF;
  -- Kicking twice could remove someone who rejoined after the first kick. Do not
  -- repeat a kick whose previous worker disappeared with an unknown outcome.
  IF (job->>'attempt_count')::integer >= 5 OR
     (p_table = 'scheduled_actions' AND job->>'action_type' = 'kick' AND job->>'delivery_status' = 'processing') THEN
    EXECUTE format('UPDATE public.%I SET delivery_status = ''failed'', lease_token = NULL, lease_expires_at = NULL,
      last_error = $2 WHERE id = $1', p_table) USING p_id,
      CASE WHEN job->>'action_type' = 'kick' THEN 'Kick-resultatet er ukendt efter genstart. Kontrollér Discord før handlingen gentages.' ELSE 'Maksimalt antal leveringsforsøg nået efter genstart.' END;
    RETURN NULL;
  END IF;
  EXECUTE format('UPDATE public.%I AS j SET delivery_status = ''processing'', attempt_count = attempt_count + 1,
    last_attempt_at = $2, next_attempt_at = NULL, lease_token = $3, lease_expires_at = $2 + make_interval(secs => $4)
    WHERE id = $1 RETURNING to_jsonb(j)', p_table)
    INTO job USING p_id, ts, token, GREATEST(30, LEAST(p_lease_seconds, 300));
  RETURN job;
END;
$function$;

CREATE FUNCTION public.extend_bot_job_lease(p_table text, p_id uuid, p_lease_token uuid, p_lease_seconds integer DEFAULT 90)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE changed integer;
BEGIN
  IF p_table NOT IN ('reminders', 'scheduled_messages', 'scheduled_actions') THEN RAISE EXCEPTION 'Invalid job table'; END IF;
  EXECUTE format('UPDATE public.%I SET lease_expires_at = clock_timestamp() + make_interval(secs => $3)
    WHERE id = $1 AND lease_token = $2 AND delivery_status = ''processing''', p_table)
    USING p_id, p_lease_token, GREATEST(30, LEAST(p_lease_seconds, 300));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$function$;

CREATE FUNCTION public.finish_bot_job(
  p_table text, p_id uuid, p_lease_token uuid, p_success boolean,
  p_error text DEFAULT NULL, p_permanent boolean DEFAULT false,
  p_message_id text DEFAULT NULL, p_next_at timestamptz DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE job jsonb; ts timestamptz := clock_timestamp(); terminal boolean;
BEGIN
  IF p_table NOT IN ('reminders', 'scheduled_messages', 'scheduled_actions') THEN RAISE EXCEPTION 'Invalid job table'; END IF;
  EXECUTE format('SELECT to_jsonb(j) FROM public.%I j WHERE id = $1 AND lease_token = $2 AND delivery_status = ''processing'' FOR UPDATE', p_table)
    INTO job USING p_id, p_lease_token;
  IF job IS NULL THEN RETURN false; END IF;
  IF NOT p_success THEN
    terminal := p_permanent OR (job->>'attempt_count')::integer >= 5;
    EXECUTE format('UPDATE public.%I SET delivery_status = $2, lease_token = NULL, lease_expires_at = NULL,
      last_error = $3, next_attempt_at = $4 WHERE id = $1', p_table)
      USING p_id, CASE WHEN terminal THEN 'failed' ELSE 'pending' END,
        left(COALESCE(p_error, 'Ukendt leveringsfejl'), 500),
        CASE WHEN terminal THEN NULL ELSE ts + make_interval(secs => LEAST(480, 30 * (2 ^ ((job->>'attempt_count')::integer - 1))::integer)) END;
    RETURN true;
  END IF;
  -- Completion and the next recurring occurrence share this transaction. A
  -- unique parent occurrence also prevents duplicate children after retries.
  IF p_table = 'reminders' THEN
    UPDATE public.reminders SET sent = true, is_sent = true WHERE id = p_id;
    IF p_next_at IS NOT NULL AND p_next_at > (job->>'remind_at')::timestamptz THEN
      INSERT INTO public.reminders (guild_id, channel_id, target_channel_id, target_user_discord_id, message,
        remind_at, repeat_interval, recurrence_interval, is_recurring, created_by_id, created_by_name,
        created_by_user_id, sent, is_sent, recurrence_parent_id)
      SELECT guild_id, channel_id, target_channel_id, target_user_discord_id, message,
        p_next_at, repeat_interval, recurrence_interval, is_recurring, created_by_id, created_by_name,
        created_by_user_id, false, false, id FROM public.reminders WHERE id = p_id
      ON CONFLICT (recurrence_parent_id) DO NOTHING;
    END IF;
  ELSIF p_table = 'scheduled_messages' THEN
    UPDATE public.scheduled_messages SET sent = true, sent_at = ts WHERE id = p_id;
    IF p_next_at IS NOT NULL AND p_next_at > (job->>'scheduled_at')::timestamptz THEN
      INSERT INTO public.scheduled_messages (guild_id, channel_id, content, embed, scheduled_at,
        repeat_interval, created_by_id, created_by_name, sent, recurrence_parent_id)
      SELECT guild_id, channel_id, content, embed, p_next_at, repeat_interval, created_by_id, created_by_name, false, id
      FROM public.scheduled_messages WHERE id = p_id ON CONFLICT (recurrence_parent_id) DO NOTHING;
    END IF;
  ELSE
    UPDATE public.scheduled_actions SET executed = true, executed_at = ts WHERE id = p_id;
  END IF;
  EXECUTE format('UPDATE public.%I SET delivery_status = ''sent'', delivered_at = $2, delivery_message_id = $3,
    lease_token = NULL, lease_expires_at = NULL, next_attempt_at = NULL, last_error = NULL WHERE id = $1', p_table)
    USING p_id, ts, p_message_id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_bot_job(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extend_bot_job_lease(text, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_bot_job(text, uuid, uuid, boolean, text, boolean, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bot_job(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_bot_job_lease(text, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_bot_job(text, uuid, uuid, boolean, text, boolean, text, timestamptz) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders, public.scheduled_messages, public.scheduled_actions TO service_role;
NOTIFY pgrst, 'reload schema';
