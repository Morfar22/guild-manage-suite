-- Create a helper function to check if user has admin OR staff role
-- Using text comparison to avoid enum commit timing issues
CREATE OR REPLACE FUNCTION public.has_admin_or_staff_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'staff')
  )
$$;