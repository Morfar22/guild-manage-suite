-- economy
DROP POLICY IF EXISTS "Allow anon insert economy_accounts" ON public.economy_accounts;
DROP POLICY IF EXISTS "Allow anon select economy_accounts" ON public.economy_accounts;
DROP POLICY IF EXISTS "Allow anon update economy_accounts" ON public.economy_accounts;
DROP POLICY IF EXISTS "Allow anon insert economy_transactions" ON public.economy_transactions;

-- fivem
DROP POLICY IF EXISTS "Allow anon select fivem_bans" ON public.fivem_bans;
DROP POLICY IF EXISTS "Allow anon select fivem_settings" ON public.fivem_settings;
DROP POLICY IF EXISTS "Allow anon select fivem_whitelist" ON public.fivem_whitelist;

-- bot settings (encrypted tokens)
DROP POLICY IF EXISTS "Allow anon select guild_bot_settings" ON public.guild_bot_settings;

-- moderation logs
DROP POLICY IF EXISTS "Allow anon delete moderation_logs" ON public.moderation_logs;
DROP POLICY IF EXISTS "Allow anon insert moderation_logs" ON public.moderation_logs;
DROP POLICY IF EXISTS "Allow anon select moderation_logs" ON public.moderation_logs;

-- tickets
DROP POLICY IF EXISTS "Allow anon insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow anon select tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow anon update tickets" ON public.tickets;

-- warnings
DROP POLICY IF EXISTS "Allow anon insert warnings" ON public.warnings;
DROP POLICY IF EXISTS "Allow anon read warnings" ON public.warnings;
DROP POLICY IF EXISTS "Allow anon update warnings" ON public.warnings;

-- ticket transcripts
DROP POLICY IF EXISTS "Bot manages transcripts" ON public.ticket_transcripts;
DROP POLICY IF EXISTS "Public transcript read" ON public.ticket_transcripts;
CREATE POLICY "Guild admins can view transcripts"
ON public.ticket_transcripts
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_guilds
  WHERE user_guilds.guild_id = ticket_transcripts.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- storage: transcripts bucket is served through signed URLs generated with the service role
DROP POLICY IF EXISTS "Bot read transcripts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Bot update transcripts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Bot write transcripts bucket" ON storage.objects;

-- revoke anon data-api access on these tables
REVOKE ALL ON public.economy_accounts FROM anon;
REVOKE ALL ON public.economy_transactions FROM anon;
REVOKE ALL ON public.fivem_bans FROM anon;
REVOKE ALL ON public.fivem_settings FROM anon;
REVOKE ALL ON public.fivem_whitelist FROM anon;
REVOKE ALL ON public.guild_bot_settings FROM anon;
REVOKE ALL ON public.moderation_logs FROM anon;
REVOKE ALL ON public.tickets FROM anon;
REVOKE ALL ON public.warnings FROM anon;
REVOKE ALL ON public.ticket_transcripts FROM anon;

GRANT ALL ON public.economy_accounts TO service_role;
GRANT ALL ON public.economy_transactions TO service_role;
GRANT ALL ON public.fivem_bans TO service_role;
GRANT ALL ON public.fivem_settings TO service_role;
GRANT ALL ON public.fivem_whitelist TO service_role;
GRANT ALL ON public.guild_bot_settings TO service_role;
GRANT ALL ON public.moderation_logs TO service_role;
GRANT ALL ON public.tickets TO service_role;
GRANT ALL ON public.warnings TO service_role;
GRANT ALL ON public.ticket_transcripts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economy_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economy_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fivem_bans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fivem_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fivem_whitelist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guild_bot_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warnings TO authenticated;
GRANT SELECT ON public.ticket_transcripts TO authenticated;