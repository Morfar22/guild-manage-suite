-- Secure, per-guild FiveM bridge credentials and health metadata.
-- The raw bridge token is never stored. Only a SHA-256 hash is persisted.

ALTER TABLE public.fivem_settings
  ADD COLUMN IF NOT EXISTS bridge_token_hash text,
  ADD COLUMN IF NOT EXISTS bridge_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS bridge_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS bridge_version text,
  ADD COLUMN IF NOT EXISTS bridge_framework text;

COMMENT ON COLUMN public.fivem_settings.bridge_token_hash IS
  'SHA-256 hash of the per-guild FiveM bridge token. Never expose through client queries.';
COMMENT ON COLUMN public.fivem_settings.bridge_last_seen_at IS
  'Last authenticated request received from the FiveM bridge.';
COMMENT ON COLUMN public.fivem_settings.bridge_version IS
  'Version reported by the installed guild_manage_bridge resource.';
COMMENT ON COLUMN public.fivem_settings.bridge_framework IS
  'Framework detected/reported by the FiveM bridge.';

CREATE INDEX IF NOT EXISTS idx_fivem_settings_bridge_last_seen
  ON public.fivem_settings (bridge_last_seen_at);
