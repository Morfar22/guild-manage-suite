
-- Allow bot (anon) to read warning_settings
CREATE POLICY "Allow anon read warning_settings"
  ON public.warning_settings FOR SELECT
  USING (true);

-- Allow bot (anon) to insert warning_settings
CREATE POLICY "Allow anon insert warning_settings"
  ON public.warning_settings FOR INSERT
  WITH CHECK (true);

-- Allow bot (anon) to update warning_settings
CREATE POLICY "Allow anon update warning_settings"
  ON public.warning_settings FOR UPDATE
  USING (true);

-- Allow bot (anon) to read warnings
CREATE POLICY "Allow anon read warnings"
  ON public.warnings FOR SELECT
  USING (true);

-- Allow bot (anon) to insert warnings
CREATE POLICY "Allow anon insert warnings"
  ON public.warnings FOR INSERT
  WITH CHECK (true);

-- Allow bot (anon) to update warnings (for deactivating)
CREATE POLICY "Allow anon update warnings"
  ON public.warnings FOR UPDATE
  USING (true);
