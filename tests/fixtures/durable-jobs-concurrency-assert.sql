DO $$
DECLARE first_token uuid; replacement jsonb; did_finish boolean;
BEGIN
  IF (SELECT count(*) FROM public.test_job_claim_results WHERE phase='race') <> 1 THEN RAISE EXCEPTION 'Concurrent claim was not exclusive'; END IF;
  IF (SELECT attempt_count FROM public.reminders WHERE id='00000000-0000-0000-0000-000000000010') <> 1 THEN RAISE EXCEPTION 'Multiple claims incremented attempts'; END IF;
  SELECT lease_token INTO first_token FROM public.test_job_claim_results WHERE phase='race';
  UPDATE public.reminders SET lease_expires_at=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000010';
  replacement := public.claim_bot_job('reminders','00000000-0000-0000-0000-000000000010',90);
  IF replacement IS NULL OR (replacement->>'lease_token')::uuid = first_token THEN RAISE EXCEPTION 'Expired lease did not recover'; END IF;
  IF public.finish_bot_job('reminders','00000000-0000-0000-0000-000000000010',first_token,true) THEN RAISE EXCEPTION 'Stale worker acknowledged replacement lease'; END IF;
  did_finish := public.finish_bot_job('reminders','00000000-0000-0000-0000-000000000010',(replacement->>'lease_token')::uuid,true,NULL,false,'discord-test',now()+interval '1 day');
  IF NOT did_finish THEN RAISE EXCEPTION 'Recovered lease did not finish'; END IF;
  IF (SELECT count(*) FROM public.reminders WHERE recurrence_parent_id='00000000-0000-0000-0000-000000000010') <> 1 THEN RAISE EXCEPTION 'Recurring child missing or duplicated'; END IF;
  IF (SELECT delivery_status <> 'sent' OR NOT sent OR NOT is_sent FROM public.reminders WHERE id='00000000-0000-0000-0000-000000000010') THEN RAISE EXCEPTION 'Completion flags are inconsistent'; END IF;
  IF has_function_privilege('anon','public.claim_bot_job(text,uuid,integer)','EXECUTE') OR has_function_privilege('authenticated','public.claim_bot_job(text,uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'Unprivileged RPC access'; END IF;
END $$;
SELECT 'exclusive claim, recovery, stale rejection, recurrence, service-role access: passed' AS result;
