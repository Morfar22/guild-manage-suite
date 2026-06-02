CREATE TABLE public.protected_discord_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL UNIQUE,
  label TEXT,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.protected_discord_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage protected IDs"
  ON public.protected_discord_ids
  FOR ALL
  TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()))
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

INSERT INTO public.protected_discord_ids (discord_id, label, added_by)
VALUES ('814032394935992350', 'Server Owner', 'system');