
-- Drop the old ALL policy that conflicts with the specific INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Users can manage fivem role permissions for their guilds" ON public.fivem_role_permissions;

-- Drop the old SELECT policy tied to owner_id and replace with one for authenticated users
DROP POLICY IF EXISTS "Users can view fivem role permissions for their guilds" ON public.fivem_role_permissions;

CREATE POLICY "Authenticated users can select fivem_role_permissions"
ON public.fivem_role_permissions
FOR SELECT
TO authenticated
USING (true);
