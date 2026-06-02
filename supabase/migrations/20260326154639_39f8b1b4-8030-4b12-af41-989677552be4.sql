
CREATE TABLE public.user_premium_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_by UUID NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

ALTER TABLE public.user_premium_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user premium features"
ON public.user_premium_features
FOR ALL
TO authenticated
USING (public.has_admin_or_staff_role(auth.uid()))
WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

CREATE POLICY "Users can read own premium features"
ON public.user_premium_features
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
