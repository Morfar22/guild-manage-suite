-- Add voter tracking arrays to suggestions table for vote deduplication
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS upvoters text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS downvoters text[] NOT NULL DEFAULT '{}';