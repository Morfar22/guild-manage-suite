-- Add FiveM moderation and logging tables

-- FiveM action logs (kicks, bans, messages, etc)
CREATE TABLE public.fivem_action_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- kick, ban, unban, message, teleport, revive, kill, announcement
    target_discord_id TEXT,
    target_name TEXT,
    moderator_discord_id TEXT NOT NULL,
    moderator_name TEXT,
    reason TEXT,
    duration_seconds INTEGER, -- for bans
    metadata JSONB DEFAULT '{}', -- extra data like coords, items, etc
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FiveM bans table
CREATE TABLE public.fivem_bans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    discord_username TEXT,
    steam_hex TEXT,
    license TEXT,
    ip_address TEXT,
    reason TEXT NOT NULL,
    banned_by_discord_id TEXT NOT NULL,
    banned_by_name TEXT,
    banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE, -- null = permanent
    is_active BOOLEAN NOT NULL DEFAULT true,
    unbanned_at TIMESTAMP WITH TIME ZONE,
    unbanned_by TEXT
);

-- FiveM online players (live tracking)
CREATE TABLE public.fivem_online_players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    server_id TEXT NOT NULL,
    player_id INTEGER NOT NULL, -- FiveM source id
    discord_user_id TEXT,
    discord_username TEXT,
    steam_hex TEXT,
    license TEXT,
    character_name TEXT,
    ping INTEGER,
    coords JSONB, -- {x, y, z}
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, server_id, player_id)
);

-- FiveM Discord role sync mappings
CREATE TABLE public.fivem_role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    discord_role_id TEXT NOT NULL,
    discord_role_name TEXT,
    permission_level TEXT NOT NULL DEFAULT 'user', -- user, mod, admin, god
    ace_permissions TEXT[], -- ACE permissions to grant
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, discord_role_id)
);

-- Add webhook settings to fivem_settings
ALTER TABLE public.fivem_settings 
ADD COLUMN IF NOT EXISTS status_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS log_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS staff_chat_channel_id TEXT,
ADD COLUMN IF NOT EXISTS announcement_channel_id TEXT,
ADD COLUMN IF NOT EXISTS staff_role_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mod_role_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS admin_role_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS god_role_ids TEXT[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.fivem_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fivem_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fivem_online_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fivem_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fivem_action_logs
CREATE POLICY "Users can view fivem action logs for their guilds"
ON public.fivem_action_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_action_logs.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

CREATE POLICY "Service role can insert fivem action logs"
ON public.fivem_action_logs FOR INSERT
WITH CHECK (true);

-- RLS Policies for fivem_bans
CREATE POLICY "Users can view fivem bans for their guilds"
ON public.fivem_bans FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_bans.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

CREATE POLICY "Users can manage fivem bans for their guilds"
ON public.fivem_bans FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_bans.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

-- RLS Policies for fivem_online_players
CREATE POLICY "Users can view fivem online players for their guilds"
ON public.fivem_online_players FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_online_players.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

CREATE POLICY "Service role can manage fivem online players"
ON public.fivem_online_players FOR ALL
USING (true);

-- RLS Policies for fivem_role_permissions
CREATE POLICY "Users can view fivem role permissions for their guilds"
ON public.fivem_role_permissions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_role_permissions.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

CREATE POLICY "Users can manage fivem role permissions for their guilds"
ON public.fivem_role_permissions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.guilds
        WHERE guilds.id = fivem_role_permissions.guild_id
        AND guilds.owner_id = auth.uid()::text
    )
);

-- Index for faster lookups
CREATE INDEX idx_fivem_action_logs_guild ON public.fivem_action_logs(guild_id);
CREATE INDEX idx_fivem_bans_guild ON public.fivem_bans(guild_id);
CREATE INDEX idx_fivem_bans_discord_id ON public.fivem_bans(discord_user_id);
CREATE INDEX idx_fivem_online_players_guild ON public.fivem_online_players(guild_id);
CREATE INDEX idx_fivem_role_permissions_guild ON public.fivem_role_permissions(guild_id);