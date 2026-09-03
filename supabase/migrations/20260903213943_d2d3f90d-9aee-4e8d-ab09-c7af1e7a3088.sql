ALTER TABLE public.honeypot_settings REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='honeypot_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.honeypot_settings;
  END IF;
END $$;