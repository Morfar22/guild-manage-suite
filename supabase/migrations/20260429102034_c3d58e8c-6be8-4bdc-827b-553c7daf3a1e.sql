ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS automod_bypass_role_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.guilds.automod_bypass_role_ids IS 'Discord role IDs that bypass ALL automod systems (rules, AI toxicity, raid protection, anti-spam, warnings auto-trigger, alt detection)';