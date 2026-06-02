-- Create server status table for txAdmin-like functionality
CREATE TABLE IF NOT EXISTS public.fivem_server_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL DEFAULT 'main',
  server_name TEXT,
  max_players INTEGER DEFAULT 64,
  player_count INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  server_started_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
  game_type TEXT DEFAULT 'fivem',
  map_name TEXT,
  resources_count INTEGER DEFAULT 0,
  txadmin_version TEXT,
  fxserver_version TEXT,
  server_ip TEXT,
  server_port INTEGER DEFAULT 30120,
  is_online BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, server_id)
);

-- Enable RLS
ALTER TABLE public.fivem_server_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view fivem server status for their guilds"
ON public.fivem_server_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = fivem_server_status.guild_id
    AND user_guilds.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage fivem server status"
ON public.fivem_server_status
FOR ALL
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_fivem_server_status_guild ON public.fivem_server_status(guild_id);

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.fivem_server_status;