-- Run only in an isolated test DB after durable-jobs-schema.sql + the migration.
INSERT INTO public.guilds(id,guild_id) VALUES ('00000000-0000-0000-0000-000000000001','test-guild');
INSERT INTO public.reminders(id,guild_id,created_by_user_id,message,remind_at,is_recurring,recurrence_interval,repeat_interval)
VALUES ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',NULL,'test',now()-interval '1 minute',true,'daily','daily');
CREATE TABLE public.test_job_claim_results (phase text, lease_token uuid);
GRANT INSERT, SELECT ON public.test_job_claim_results TO service_role;
