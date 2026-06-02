
-- Create guild_premium_features table
CREATE TABLE public.guild_premium_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_by UUID REFERENCES auth.users(id),
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, feature)
);

-- Enable RLS
ALTER TABLE public.guild_premium_features ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read
CREATE POLICY "Authenticated users can view premium features"
  ON public.guild_premium_features
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admin/staff
CREATE POLICY "Admins can insert premium features"
  ON public.guild_premium_features
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- UPDATE: Only admin/staff
CREATE POLICY "Admins can update premium features"
  ON public.guild_premium_features
  FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- DELETE: Only admin/staff
CREATE POLICY "Admins can delete premium features"
  ON public.guild_premium_features
  FOR DELETE
  TO authenticated
  USING (public.has_admin_or_staff_role(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_guild_premium_features_updated_at
  BEFORE UPDATE ON public.guild_premium_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
