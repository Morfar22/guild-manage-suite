-- Create table for pending FiveM commands from dashboard
CREATE TABLE public.fivem_command_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    command_name TEXT NOT NULL,
    command_data JSONB NOT NULL DEFAULT '{}',
    target_player_id INTEGER,
    target_discord_id TEXT,
    target_name TEXT,
    moderator_discord_id TEXT NOT NULL,
    moderator_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executed, failed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    executed_at TIMESTAMP WITH TIME ZONE,
    result TEXT
);

-- Enable RLS
ALTER TABLE public.fivem_command_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view commands for guilds they have access to
CREATE POLICY "Users can view fivem_command_queue for their guilds"
ON public.fivem_command_queue
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = fivem_command_queue.guild_id
        AND user_guilds.user_id = auth.uid()
    )
);

-- Policy: Users with admin permission can insert commands
CREATE POLICY "Admins can insert fivem_command_queue"
ON public.fivem_command_queue
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = fivem_command_queue.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- Index for fast polling of pending commands
CREATE INDEX idx_fivem_command_queue_pending ON public.fivem_command_queue(guild_id, status, created_at) 
WHERE status = 'pending';

-- Index for cleanup of old commands
CREATE INDEX idx_fivem_command_queue_created ON public.fivem_command_queue(created_at);