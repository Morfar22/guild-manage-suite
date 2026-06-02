ALTER TABLE public.welcome_settings 
  ADD COLUMN IF NOT EXISTS embed_title text DEFAULT '🎉 Et nyt medlem er ankommet!',
  ADD COLUMN IF NOT EXISTS embed_footer text DEFAULT '',
  ADD COLUMN IF NOT EXISTS embed_image_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS leave_embed_enabled boolean DEFAULT false;