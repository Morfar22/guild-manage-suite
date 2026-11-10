-- Recovery for temporary moderation and durable, checkpointed workflow jobs.
ALTER TABLE public.moderation_scheduled_actions
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  ADD COLUMN next_attempt_at timestamptz,
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_expires_at timestamptz;
CREATE INDEX moderation_recovery_due ON public.moderation_scheduled_actions(status,execute_at,next_attempt_at,lease_expires_at)
  WHERE status IN ('pending','executing');

CREATE TABLE public.bot_workflow_cursors (
  guild_id uuid PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  scanned_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Do not replay historical tickets/errors/raids when installing this feature.
INSERT INTO public.bot_workflow_cursors(guild_id) SELECT id FROM public.guilds;
CREATE TABLE public.bot_workflow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  trigger_type text NOT NULL,
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 200),
  trigger_payload jsonb NOT NULL,
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions)='array'),
  action_index integer NOT NULL DEFAULT 0 CHECK (action_index>=0),
  action_inflight boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','success','error','skipped')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(workflow_id,event_key)
);
CREATE INDEX workflow_jobs_due ON public.bot_workflow_jobs(guild_id,status,created_at)
  WHERE status IN ('pending','processing');
ALTER TABLE public.workflow_executions ADD COLUMN job_id uuid UNIQUE REFERENCES public.bot_workflow_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.bot_workflow_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_workflow_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_workflow_cursors,public.bot_workflow_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bot_workflow_cursors,public.bot_workflow_jobs TO service_role;
GRANT SELECT ON public.bot_workflow_jobs TO authenticated;
CREATE POLICY workflow_job_read ON public.bot_workflow_jobs FOR SELECT TO authenticated USING (
  public.has_admin_or_staff_role((SELECT auth.uid())) OR EXISTS(SELECT 1 FROM public.user_guilds ug
    WHERE ug.guild_id=bot_workflow_jobs.guild_id AND ug.user_id=(SELECT auth.uid()) AND ug.has_admin_permission));

CREATE FUNCTION public.bot_enqueue_workflow_event(p_guild_id uuid,p_trigger_type text,p_event_key text,p_payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer; g public.guilds;
BEGIN
  IF p_trigger_type NOT IN ('member_join','message_keyword','ticket_created','command_error','raid_detected')
     OR p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 1 AND 200 OR jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION 'Invalid workflow event';
  END IF;
  SELECT * INTO STRICT g FROM public.guilds WHERE id=p_guild_id;
  p_payload:=p_payload||jsonb_build_object('guildId',g.guild_id,'guildName',g.guild_name);
  INSERT INTO public.bot_workflow_jobs(guild_id,workflow_id,workflow_name,trigger_type,event_key,trigger_payload,actions)
  SELECT w.guild_id,w.id,w.name,w.trigger_type,p_event_key,p_payload,
    CASE WHEN jsonb_typeof(w.actions)='array' THEN w.actions ELSE '[{"type":"invalid_configuration"}]'::jsonb END
    FROM public.automation_workflows w WHERE w.guild_id=p_guild_id AND w.enabled AND w.trigger_type=p_trigger_type
    AND w.created_at<=coalesce((p_payload->>'eventOccurredAt')::timestamptz,clock_timestamp())
    AND (p_trigger_type<>'message_keyword' OR
      (length(btrim(coalesce(w.trigger_config->>'keyword','')))>0 AND
       CASE WHEN coalesce(w.trigger_config->>'case_sensitive','false')='true'
        THEN strpos(coalesce(p_payload->>'messageContent',''),btrim(w.trigger_config->>'keyword'))>0
        ELSE strpos(lower(coalesce(p_payload->>'messageContent','')),lower(btrim(w.trigger_config->>'keyword')))>0 END))
  ON CONFLICT(workflow_id,event_key) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE FUNCTION public.bot_ingest_workflow_events(p_guild_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cursor_row public.bot_workflow_cursors; upper_bound timestamptz:=clock_timestamp(); lower_bound timestamptz;
  e record; n integer:=0; g public.guilds;
BEGIN
  SELECT * INTO STRICT g FROM public.guilds WHERE id=p_guild_id;
  INSERT INTO public.bot_workflow_cursors(guild_id,started_at,scanned_at)
    VALUES(p_guild_id,g.created_at,g.created_at) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT cursor_row FROM public.bot_workflow_cursors WHERE guild_id=p_guild_id FOR UPDATE;
  -- Re-read a bounded overlap for transactions committed shortly after a scan.
  -- Idempotent event keys prevent duplicate work; cursor advancement and enqueue
  -- share this transaction, so an SQL failure cannot skip the failed interval.
  lower_bound:=greatest(cursor_row.started_at,cursor_row.scanned_at-interval '5 minutes');
  FOR e IN
    SELECT 'ticket_created'::text kind,'ticket:'||t.id event_key,
      jsonb_build_object('ticketId',t.id,'userId',t.creator_id,'username',t.creator_name,'channelId',t.channel_id,
        'subject',t.subject,'guildId',g.guild_id,'guildName',g.guild_name,'eventOccurredAt',t.created_at) payload
      FROM public.tickets t WHERE t.guild_id=p_guild_id AND t.created_at>=lower_bound AND t.created_at<upper_bound
    UNION ALL
    SELECT 'command_error','command:'||c.id,
      jsonb_build_object('eventId',c.id,'userId',c.user_id,'channelId',c.channel_id,'commandName',c.command_name,
        'errorMessage',c.error_message,'latencyMs',c.latency_ms,'guildId',g.guild_id,'guildName',g.guild_name,'eventOccurredAt',c.created_at)
      FROM public.command_execution_events c WHERE c.guild_id=p_guild_id AND c.status='error'
        AND c.created_at>=lower_bound AND c.created_at<upper_bound
    UNION ALL
    SELECT 'raid_detected','raid:'||r.id,
      jsonb_build_object('raidId',r.id,'joinCount',r.join_count,'actionTaken',r.action_taken,'userIds',r.user_ids,
        'guildId',g.guild_id,'guildName',g.guild_name,'eventOccurredAt',r.created_at)
      FROM public.raid_logs r WHERE r.guild_id=p_guild_id AND r.created_at>=lower_bound AND r.created_at<upper_bound
  LOOP n:=n+public.bot_enqueue_workflow_event(p_guild_id,e.kind,e.event_key,e.payload); END LOOP;
  UPDATE public.bot_workflow_cursors SET scanned_at=upper_bound WHERE guild_id=p_guild_id;
  RETURN n;
END $$;

-- Internal finalization also runs when an expired non-idempotent action needs
-- manual review. It never claims an ambiguous Discord result was successful.
CREATE FUNCTION public.bot_complete_workflow(p_id uuid,p_status text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j public.bot_workflow_jobs;
BEGIN
  IF p_status NOT IN ('success','error','skipped') THEN RAISE EXCEPTION 'Invalid final workflow state'; END IF;
  SELECT * INTO STRICT j FROM public.bot_workflow_jobs WHERE id=p_id FOR UPDATE;
  IF j.status IN ('success','error','skipped') THEN RETURN; END IF;
  IF p_status='success' AND j.action_index<jsonb_array_length(j.actions) THEN RAISE EXCEPTION 'Workflow actions remain incomplete'; END IF;
  UPDATE public.bot_workflow_jobs SET status=p_status,last_error=left(p_error,1000),completed_at=clock_timestamp(),
    lease_token=NULL,lease_expires_at=NULL,next_attempt_at=NULL WHERE id=p_id;
  INSERT INTO public.workflow_executions(guild_id,workflow_id,trigger_type,trigger_payload,status,error_message,job_id)
    VALUES(j.guild_id,j.workflow_id,j.trigger_type,j.trigger_payload,
      CASE WHEN p_status='error' AND j.action_index>0 THEN 'partial' ELSE p_status END,left(p_error,1000),j.id)
    ON CONFLICT(job_id) DO NOTHING;
  UPDATE public.automation_workflows SET run_count=run_count+1,last_run_at=clock_timestamp() WHERE id=j.workflow_id;
END $$;

CREATE FUNCTION public.bot_claim_operational_job(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j jsonb; t text; processing text; ts timestamptz:=clock_timestamp(); token uuid:=gen_random_uuid();
BEGIN
  IF p_kind='moderation' THEN t:='moderation_scheduled_actions';processing:='executing';
  ELSIF p_kind='workflow' THEN t:='bot_workflow_jobs';processing:='processing';
  ELSE RAISE EXCEPTION 'Invalid operational job'; END IF;
  EXECUTE format('SELECT to_jsonb(j) FROM public.%I j WHERE id=$1 FOR UPDATE SKIP LOCKED',t) INTO j USING p_id;
  IF j IS NULL OR j->>'status' NOT IN ('pending',processing) OR
    coalesce((j->>'next_attempt_at')::timestamptz,'-infinity')>ts OR
    (j->>'status'=processing AND coalesce((j->>'lease_expires_at')::timestamptz,'-infinity')>ts) OR
    (p_kind='moderation' AND (j->>'execute_at')::timestamptz>ts) THEN RETURN NULL; END IF;
  IF p_kind='workflow' AND NOT EXISTS(SELECT 1 FROM public.automation_workflows w WHERE w.id=(j->>'workflow_id')::uuid AND w.enabled) THEN
    PERFORM public.bot_complete_workflow(p_id,'skipped','Workflow disabled before execution'); RETURN NULL;
  END IF;
  IF (j->>'attempt_count')::integer>=5 OR (p_kind='workflow' AND (j->>'action_inflight')::boolean AND
      j->'actions'->((j->>'action_index')::integer)->>'type' IN ('send_message','dm')) THEN
    IF p_kind='workflow' THEN
      PERFORM public.bot_complete_workflow(p_id,'error',CASE WHEN (j->>'action_inflight')::boolean THEN
        'Discord-resultatet er ukendt efter afbrud. Kontrollér Discord før workflowet gentages.' ELSE 'Maksimalt antal forsøg nået.' END);
    ELSE UPDATE public.moderation_scheduled_actions SET status='failed',last_error='Maksimalt antal forsøg nået.',lease_token=NULL,lease_expires_at=NULL WHERE id=p_id; END IF;
    RETURN jsonb_build_object('terminal',true,'guild_id',j->>'guild_id','id',p_id,
      'last_error',CASE WHEN p_kind='workflow' AND (j->>'action_inflight')::boolean THEN
        'Discord-resultatet er ukendt efter afbrud. Kontrollér Discord før workflowet gentages.' ELSE 'Maksimalt antal forsøg nået.' END);
  END IF;
  EXECUTE format('UPDATE public.%I j SET status=$2,attempt_count=attempt_count+1,lease_token=$3,
    lease_expires_at=$4+interval ''90 seconds'',next_attempt_at=NULL WHERE id=$1 RETURNING to_jsonb(j)',t)
    INTO j USING p_id,processing,token,ts;
  RETURN j;
END $$;

CREATE FUNCTION public.bot_renew_operational_job(p_kind text,p_id uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer; t text; processing text;
BEGIN
  IF p_kind='moderation' THEN t:='moderation_scheduled_actions';processing:='executing';
  ELSIF p_kind='workflow' THEN t:='bot_workflow_jobs';processing:='processing'; ELSE RAISE EXCEPTION 'Invalid operational job'; END IF;
  EXECUTE format('UPDATE public.%I SET lease_expires_at=clock_timestamp()+interval ''90 seconds'' WHERE id=$1 AND lease_token=$2 AND status=$3',t) USING p_id,p_token,processing;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE FUNCTION public.bot_finish_operational_job(p_kind text,p_id uuid,p_token uuid,p_success boolean,p_error text DEFAULT NULL,p_permanent boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j jsonb;t text;processing text;terminal boolean;ts timestamptz:=clock_timestamp();
BEGIN
  IF p_kind='moderation' THEN t:='moderation_scheduled_actions';processing:='executing';
  ELSIF p_kind='workflow' THEN t:='bot_workflow_jobs';processing:='processing'; ELSE RAISE EXCEPTION 'Invalid operational job'; END IF;
  EXECUTE format('SELECT to_jsonb(j) FROM public.%I j WHERE id=$1 AND lease_token=$2 AND status=$3 FOR UPDATE',t) INTO j USING p_id,p_token,processing;
  IF j IS NULL THEN RETURN false; END IF;
  terminal:=p_permanent OR (j->>'attempt_count')::integer>=5;
  IF p_kind='workflow' AND (p_success OR terminal) THEN
    PERFORM public.bot_complete_workflow(p_id,CASE WHEN p_success THEN 'success' ELSE 'error' END,p_error);
  ELSIF p_kind='moderation' AND p_success THEN
    UPDATE public.moderation_scheduled_actions SET status='executed',executed_at=ts,updated_at=ts,last_error=NULL,
      lease_token=NULL,lease_expires_at=NULL,next_attempt_at=NULL WHERE id=p_id;
  ELSE
    EXECUTE format('UPDATE public.%I SET status=$2,last_error=$3,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=$4 WHERE id=$1',t)
      USING p_id,CASE WHEN terminal THEN 'failed' ELSE 'pending' END,left(coalesce(p_error,'Ukendt fejl'),1000),
        CASE WHEN terminal THEN NULL ELSE ts+make_interval(secs=>30*(2^((j->>'attempt_count')::integer-1))::integer) END;
    IF p_kind='workflow' THEN UPDATE public.bot_workflow_jobs SET action_inflight=false WHERE id=p_id; END IF;
  END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.bot_workflow_action(p_id uuid,p_token uuid,p_index integer,p_phase text,p_record jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j public.bot_workflow_jobs; kind text;
BEGIN
  SELECT * INTO j FROM public.bot_workflow_jobs WHERE id=p_id AND lease_token=p_token AND status='processing' FOR UPDATE;
  IF NOT FOUND OR j.action_index<>p_index THEN RAISE EXCEPTION 'Workflow action lease/index lost'; END IF;
  kind:=j.actions->p_index->>'type';
  IF p_phase='begin' THEN
    IF kind IS NULL THEN RAISE EXCEPTION 'No workflow action'; END IF;
    UPDATE public.bot_workflow_jobs SET action_inflight=true WHERE id=p_id;
  ELSIF p_phase='complete' THEN
    IF NOT j.action_inflight THEN RAISE EXCEPTION 'Workflow action not started'; END IF;
    IF kind='dashboard_alert' THEN
      IF p_record IS NULL THEN RAISE EXCEPTION 'Missing workflow alert'; END IF;
      INSERT INTO public.dashboard_notifications(guild_id,type,severity,status,title,message,source,metadata)
      VALUES(j.guild_id,CASE WHEN p_record->>'severity'='critical' THEN 'error' ELSE 'system' END,
        coalesce(p_record->>'severity','info'),'open',p_record->>'title',p_record->>'message','workflow',
        jsonb_build_object('workflow_id',j.workflow_id,'job_id',j.id,'action_index',p_index,'context',j.trigger_payload));
    ELSIF kind='create_case' THEN
      IF p_record IS NULL OR j.trigger_payload->>'userId' IS NULL THEN RAISE EXCEPTION 'Missing workflow case target'; END IF;
      INSERT INTO public.moderation_logs(guild_id,action_type,moderator_id,moderator_name,target_id,target_name,reason,status,severity,metadata)
      VALUES(j.guild_id,'warn',p_record->>'moderator_id',p_record->>'moderator_name',j.trigger_payload->>'userId',
        coalesce(j.trigger_payload->>'username',j.trigger_payload->>'userId'),p_record->>'reason','open',coalesce(p_record->>'severity','medium'),
        jsonb_build_object('automated',true,'workflow_id',j.workflow_id,'job_id',j.id,'action_index',p_index));
    END IF;
    UPDATE public.bot_workflow_jobs SET action_index=action_index+1,action_inflight=false WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Invalid workflow action phase'; END IF;
  RETURN (SELECT to_jsonb(x) FROM public.bot_workflow_jobs x WHERE id=p_id);
END $$;

-- Only unresolved alerts share a dedupe key; resolving an incident permits a
-- later incident. Existing matching open alerts are adopted without deleting history.
ALTER TABLE public.dashboard_notifications ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX notification_active_dedupe ON public.dashboard_notifications(guild_id,dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status<>'resolved';
CREATE FUNCTION public.bot_upsert_operational_alert(p_guild_id uuid,p_source text,p_key text,p_title text,p_message text,p_severity text,p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE found_id uuid;
BEGIN
  IF p_source NOT IN ('command-health','ticket-sla') OR p_key IS NULL OR length(p_key)>200 THEN RAISE EXCEPTION 'Invalid operational alert'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guild_id::text||':'||p_source||':'||p_key,0));
  SELECT id INTO found_id FROM public.dashboard_notifications
    WHERE guild_id=p_guild_id AND source=p_source AND status<>'resolved' AND
      (dedupe_key=p_source||':'||p_key OR (dedupe_key IS NULL AND
        CASE WHEN p_source='command-health' THEN metadata->>'command_name'=p_key ELSE metadata->>'ticket_id'=p_key END))
    ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF found_id IS NOT NULL THEN
    UPDATE public.dashboard_notifications SET dedupe_key=p_source||':'||p_key WHERE id=found_id;
    RETURN found_id;
  END IF;
  INSERT INTO public.dashboard_notifications(guild_id,type,severity,status,title,message,source,metadata,dedupe_key)
    VALUES(p_guild_id,'warning',p_severity,'open',p_title,p_message,p_source,p_metadata,p_source||':'||p_key) RETURNING id INTO found_id;
  RETURN found_id;
END $$;

DO $permissions$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('bot_enqueue_workflow_event','bot_ingest_workflow_events','bot_complete_workflow','bot_claim_operational_job',
     'bot_renew_operational_job','bot_finish_operational_job','bot_workflow_action','bot_upsert_operational_alert') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
END $permissions$;
NOTIFY pgrst,'reload schema';
