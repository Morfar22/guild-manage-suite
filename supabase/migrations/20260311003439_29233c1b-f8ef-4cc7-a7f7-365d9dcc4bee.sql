
-- Add live tracking columns to tiktok_accounts
ALTER TABLE public.tiktok_accounts 
  ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_live_at timestamptz;

-- Add live notification settings to tiktok_settings
ALTER TABLE public.tiktok_settings 
  ADD COLUMN IF NOT EXISTS live_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_message text DEFAULT '🔴 **{username}** er nu LIVE på TikTok!',
  ADD COLUMN IF NOT EXISTS offline_message text DEFAULT '⚫ **{username}** er gået offline på TikTok.';
