CREATE POLICY "Allow anon insert fivem_command_queue"
  ON public.fivem_command_queue FOR INSERT WITH CHECK (true);