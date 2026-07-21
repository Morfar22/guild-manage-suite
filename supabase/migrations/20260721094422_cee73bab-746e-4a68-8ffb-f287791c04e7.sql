
CREATE TABLE public.ticket_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_id text,
  message_id text,
  embed_title text DEFAULT '🎫 Support Tickets',
  embed_description text DEFAULT 'Select a category below to create a ticket.',
  embed_color integer DEFAULT 5793266,
  embed_image_url text,
  embed_thumbnail_url text,
  embed_footer_text text,
  component_style text NOT NULL DEFAULT 'select',
  button_label text DEFAULT 'Open Ticket',
  button_emoji text DEFAULT '📩',
  button_style integer DEFAULT 1,
  category_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  operating_hours jsonb NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_panels TO authenticated;
GRANT ALL ON public.ticket_panels TO service_role;
GRANT SELECT ON public.ticket_panels TO anon;
ALTER TABLE public.ticket_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view guild panels" ON public.ticket_panels FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_guilds ug WHERE ug.user_id = auth.uid() AND ug.guild_id = ticket_panels.guild_id AND ug.has_admin_permission = true));
CREATE POLICY "Admins insert guild panels" ON public.ticket_panels FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_guilds ug WHERE ug.user_id = auth.uid() AND ug.guild_id = ticket_panels.guild_id AND ug.has_admin_permission = true));
CREATE POLICY "Admins update guild panels" ON public.ticket_panels FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_guilds ug WHERE ug.user_id = auth.uid() AND ug.guild_id = ticket_panels.guild_id AND ug.has_admin_permission = true));
CREATE POLICY "Admins delete guild panels" ON public.ticket_panels FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_guilds ug WHERE ug.user_id = auth.uid() AND ug.guild_id = ticket_panels.guild_id AND ug.has_admin_permission = true));
CREATE POLICY "Bot manages panels" ON public.ticket_panels FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ticket_panels_updated BEFORE UPDATE ON public.ticket_panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS form_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS panel_id uuid REFERENCES public.ticket_panels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS button_color integer DEFAULT 5793266,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

CREATE TABLE public.ticket_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  rated_by_id text NOT NULL,
  staff_id text,
  staff_name text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_ratings TO authenticated;
GRANT ALL ON public.ticket_ratings TO service_role;
GRANT SELECT ON public.ticket_ratings TO anon;
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view guild ratings" ON public.ticket_ratings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_guilds ug WHERE ug.user_id = auth.uid() AND ug.guild_id = ticket_ratings.guild_id AND ug.has_admin_permission = true));
CREATE POLICY "Bot manages ratings" ON public.ticket_ratings FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.ticket_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  html_url text,
  storage_path text,
  message_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_transcripts TO authenticated;
GRANT ALL ON public.ticket_transcripts TO service_role;
GRANT SELECT ON public.ticket_transcripts TO anon;
ALTER TABLE public.ticket_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public transcript read" ON public.ticket_transcripts FOR SELECT USING (true);
CREATE POLICY "Bot manages transcripts" ON public.ticket_transcripts FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.ticket_settings
  ADD COLUMN IF NOT EXISTS enable_ratings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_transcripts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dm_transcript_to_user boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ratings_dm_prompt text DEFAULT 'How would you rate the support you received? Please rate 1-5 stars.',
  ADD COLUMN IF NOT EXISTS operating_hours jsonb NOT NULL DEFAULT '{"enabled":false}'::jsonb;

CREATE POLICY "Bot read transcripts bucket" ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-transcripts');
CREATE POLICY "Bot write transcripts bucket" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ticket-transcripts');
CREATE POLICY "Bot update transcripts bucket" ON storage.objects FOR UPDATE
  USING (bucket_id = 'ticket-transcripts');
