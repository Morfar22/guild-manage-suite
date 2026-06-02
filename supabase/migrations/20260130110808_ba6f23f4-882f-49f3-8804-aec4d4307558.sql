-- Update server_templates to store premium data
COMMENT ON TABLE public.server_templates IS 'Server backup templates with channels, roles, messages, bans, and member data';

-- Note: The existing jsonb columns can already store the new data:
-- bot_settings: Already exists, will store server settings (name, icon, verification_level, etc.)
-- We'll use the existing jsonb structure to store:
--   - messages: Array of channel messages
--   - bans: Array of banned users
--   - members: Array of member data (nicknames, role assignments)
--   - threads: Array of thread/forum post data

-- Add columns for backup options and statistics
ALTER TABLE public.server_templates
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ban_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS thread_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bans JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS threads JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS server_settings JSONB DEFAULT '{}'::jsonb;