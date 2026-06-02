ALTER TABLE public.auto_responders ADD COLUMN use_ai boolean NOT NULL DEFAULT false;
ALTER TABLE public.auto_responders ADD COLUMN ai_instructions text;