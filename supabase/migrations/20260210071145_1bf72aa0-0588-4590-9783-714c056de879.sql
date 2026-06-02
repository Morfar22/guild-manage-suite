
-- Add new log event columns to log_settings table
ALTER TABLE public.log_settings
  ADD COLUMN IF NOT EXISTS log_emoji_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_emoji_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_emoji_update boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_thread_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_thread_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_thread_archive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_role_add boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_role_remove boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_server_boost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_server_boost_remove boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_screen_share_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_screen_share_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_member_kick boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_voice_server_mute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_voice_server_deafen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_member_voice_move boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_command_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_invite_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_sticker_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS log_sticker_delete boolean NOT NULL DEFAULT false;
