
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily',
  max_backups INTEGER NOT NULL DEFAULT 5,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can manage backup schedules" ON public.backup_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can read backup schedules" ON public.backup_schedules FOR SELECT TO anon USING (true);

CREATE TRIGGER update_backup_schedules_updated_at BEFORE UPDATE ON public.backup_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
