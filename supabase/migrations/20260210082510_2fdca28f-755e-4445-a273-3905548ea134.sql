
CREATE TABLE public.tebex_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  tebex_secret_encrypted text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.tebex_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their guild tebex settings"
  ON public.tebex_settings FOR SELECT
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Users can insert their guild tebex settings"
  ON public.tebex_settings FOR INSERT
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Users can update their guild tebex settings"
  ON public.tebex_settings FOR UPDATE
  USING (public.has_admin_or_staff_role(auth.uid()));

CREATE TRIGGER update_tebex_settings_updated_at
  BEFORE UPDATE ON public.tebex_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
