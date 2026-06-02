
-- Table to track posted content (avoid duplicates)
CREATE TABLE IF NOT EXISTS public.twitch_content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  streamer_id UUID NOT NULL REFERENCES public.twitch_streamers(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  twitch_content_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  channel_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, twitch_content_id)
);

ALTER TABLE public.twitch_content_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their guild content posts"
  ON public.twitch_content_posts FOR SELECT
  TO authenticated
  USING (
    guild_id IN (
      SELECT id FROM public.guilds WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role full access to content posts"
  ON public.twitch_content_posts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
