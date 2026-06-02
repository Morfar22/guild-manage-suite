-- Create bot_status table for tracking bot health and metrics
CREATE TABLE public.bot_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
  member_count INTEGER DEFAULT 0,
  message_count_today INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

-- Create moderation action type enum
CREATE TYPE public.moderation_action_type AS ENUM ('ban', 'kick', 'mute', 'warn', 'delete', 'timeout', 'unban', 'unmute');

-- Create moderation_logs table for storing bot actions
CREATE TABLE public.moderation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  action_type public.moderation_action_type NOT NULL,
  moderator_id TEXT NOT NULL,
  moderator_name TEXT,
  target_id TEXT NOT NULL,
  target_name TEXT,
  reason TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bot_status
ALTER TABLE public.bot_status ENABLE ROW LEVEL SECURITY;

-- Bot can update status using BOT_SECRET_KEY (handled in edge function)
-- Users can view status for their guilds
CREATE POLICY "Users can view bot status for their guilds"
ON public.bot_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = bot_status.guild_id
    AND user_guilds.user_id = auth.uid()
  )
);

-- Enable RLS on moderation_logs
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view moderation logs for their guilds
CREATE POLICY "Users can view moderation logs for their guilds"
ON public.moderation_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = moderation_logs.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  )
);

-- Create indexes for performance
CREATE INDEX idx_bot_status_guild_id ON public.bot_status(guild_id);
CREATE INDEX idx_moderation_logs_guild_id ON public.moderation_logs(guild_id);
CREATE INDEX idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);
CREATE INDEX idx_moderation_logs_action_type ON public.moderation_logs(action_type);

-- Add trigger for updated_at on bot_status
CREATE TRIGGER update_bot_status_updated_at
BEFORE UPDATE ON public.bot_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.guilds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_status;