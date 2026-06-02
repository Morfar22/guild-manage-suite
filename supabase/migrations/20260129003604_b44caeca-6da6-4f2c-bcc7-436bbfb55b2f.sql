-- Fix the overly permissive INSERT policy on guilds
-- Drop the current policy and create a more restrictive one
DROP POLICY IF EXISTS "Users can insert guilds" ON public.guilds;

-- The edge function uses service role which bypasses RLS
-- For client-side inserts (like demo server creation), we need a policy
-- that only allows authenticated users to insert
CREATE POLICY "Authenticated users can insert guilds"
ON public.guilds FOR INSERT
TO authenticated
WITH CHECK (true);