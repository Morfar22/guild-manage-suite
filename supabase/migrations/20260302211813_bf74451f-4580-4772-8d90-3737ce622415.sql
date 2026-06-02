
-- Add ai_toxicity to the automod_rule_type enum
ALTER TYPE public.automod_rule_type ADD VALUE IF NOT EXISTS 'ai_toxicity';
