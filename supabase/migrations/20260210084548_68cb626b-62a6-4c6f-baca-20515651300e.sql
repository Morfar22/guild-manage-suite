
-- Table to store incoming Tebex webhook events (purchases, refunds, chargebacks)
CREATE TABLE public.tebex_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  player_name TEXT,
  player_uuid TEXT,
  player_discord_id TEXT,
  packages JSONB DEFAULT '[]'::jsonb,
  event_type TEXT NOT NULL DEFAULT 'payment.completed',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tebex_purchases_guild ON public.tebex_purchases(guild_id);
CREATE INDEX idx_tebex_purchases_txn ON public.tebex_purchases(txn_id);
CREATE INDEX idx_tebex_purchases_created ON public.tebex_purchases(guild_id, created_at DESC);

ALTER TABLE public.tebex_purchases ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions)
CREATE POLICY "Service role full access on tebex_purchases"
  ON public.tebex_purchases FOR ALL
  USING (true) WITH CHECK (true);

-- Table to map Tebex package IDs to Discord roles
CREATE TABLE public.tebex_role_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id TEXT NOT NULL,
  tebex_package_id INTEGER NOT NULL,
  tebex_package_name TEXT,
  discord_role_id TEXT NOT NULL,
  discord_role_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, tebex_package_id)
);

ALTER TABLE public.tebex_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on tebex_role_mappings"
  ON public.tebex_role_mappings FOR ALL
  USING (true) WITH CHECK (true);

-- Add notification channel to tebex_settings
ALTER TABLE public.tebex_settings
  ADD COLUMN IF NOT EXISTS notification_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
