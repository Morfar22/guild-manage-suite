-- Race this entire transaction from at least 8 independent psql sessions.
BEGIN;
SET LOCAL ROLE service_role;
WITH claimed AS MATERIALIZED (
  SELECT public.claim_bot_job('reminders','00000000-0000-0000-0000-000000000010',90) AS job
)
INSERT INTO public.test_job_claim_results(phase,lease_token)
SELECT 'race', (job->>'lease_token')::uuid FROM claimed WHERE job IS NOT NULL;
SELECT pg_sleep(0.1);
COMMIT;
