
-- Add INSERT policy for fivem_role_permissions
CREATE POLICY "Authenticated users can insert fivem_role_permissions"
ON public.fivem_role_permissions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for fivem_role_permissions
CREATE POLICY "Authenticated users can update fivem_role_permissions"
ON public.fivem_role_permissions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy for fivem_role_permissions
CREATE POLICY "Authenticated users can delete fivem_role_permissions"
ON public.fivem_role_permissions
FOR DELETE
TO authenticated
USING (true);
