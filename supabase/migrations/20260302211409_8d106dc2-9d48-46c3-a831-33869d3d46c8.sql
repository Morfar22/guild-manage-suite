
-- Custom Commands table
CREATE TABLE public.custom_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'command',
  trigger TEXT NOT NULL,
  response_type TEXT NOT NULL DEFAULT 'text',
  response_content TEXT,
  response_embed JSONB,
  response_options JSONB DEFAULT '[]'::jsonb,
  role_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  required_role_id TEXT,
  allowed_channels TEXT[] DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, trigger)
);

ALTER TABLE public.custom_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom commands viewable by authenticated" ON public.custom_commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Custom commands insertable by authenticated" ON public.custom_commands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Custom commands updatable by authenticated" ON public.custom_commands FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Custom commands deletable by authenticated" ON public.custom_commands FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_custom_commands_updated_at
  BEFORE UPDATE ON public.custom_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_custom_commands_guild ON public.custom_commands(guild_id);

-- Realtime event feed table
CREATE TABLE public.realtime_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT,
  user_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.realtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Realtime events viewable by authenticated" ON public.realtime_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Realtime events insertable by all" ON public.realtime_events FOR INSERT WITH CHECK (true);

CREATE INDEX idx_realtime_events_guild_created ON public.realtime_events(guild_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_events;
