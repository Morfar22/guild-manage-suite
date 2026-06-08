ALTER TABLE public.application_submissions
  ADD COLUMN IF NOT EXISTS ai_generated_likelihood integer,
  ADD COLUMN IF NOT EXISTS ai_generated_reasoning text;