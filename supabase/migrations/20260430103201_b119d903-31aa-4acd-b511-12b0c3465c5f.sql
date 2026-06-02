-- Music quiz songs pool
CREATE TABLE public.music_quiz_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  hints TEXT[] NOT NULL DEFAULT '{}',
  lyrics_snippet TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_music_quiz_songs_guild ON public.music_quiz_songs(guild_id);

ALTER TABLE public.music_quiz_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view songs" ON public.music_quiz_songs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage songs" ON public.music_quiz_songs
  FOR ALL TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()))
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));
CREATE POLICY "Anon read songs" ON public.music_quiz_songs
  FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_music_quiz_songs_updated
  BEFORE UPDATE ON public.music_quiz_songs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Music quiz scores
CREATE TABLE public.music_quiz_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  rounds_won INTEGER NOT NULL DEFAULT 0,
  rounds_played INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);

CREATE INDEX idx_music_quiz_scores_guild ON public.music_quiz_scores(guild_id, points DESC);

ALTER TABLE public.music_quiz_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view scores" ON public.music_quiz_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage scores" ON public.music_quiz_scores
  FOR ALL TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()))
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));
CREATE POLICY "Anon read scores" ON public.music_quiz_scores
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon write scores" ON public.music_quiz_scores
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update scores" ON public.music_quiz_scores
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER trg_music_quiz_scores_updated
  BEFORE UPDATE ON public.music_quiz_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();