-- Create table for custom bot settings per guild
CREATE TABLE public.guild_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    is_custom_bot BOOLEAN NOT NULL DEFAULT false,
    bot_token_encrypted TEXT,
    bot_client_id TEXT,
    bot_public_key TEXT,
    bot_name TEXT,
    bot_avatar_url TEXT,
    bot_status TEXT DEFAULT 'online',
    bot_activity_type TEXT DEFAULT 'PLAYING',
    bot_activity_text TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(guild_id)
);

-- Enable RLS
ALTER TABLE public.guild_bot_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - only guild admins can manage bot settings
CREATE POLICY "Users can view their guild bot settings"
ON public.guild_bot_settings
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_guilds
        WHERE user_guilds.guild_id = guild_bot_settings.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can insert their guild bot settings"
ON public.guild_bot_settings
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_guilds
        WHERE user_guilds.guild_id = guild_bot_settings.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can update their guild bot settings"
ON public.guild_bot_settings
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM user_guilds
        WHERE user_guilds.guild_id = guild_bot_settings.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can delete their guild bot settings"
ON public.guild_bot_settings
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM user_guilds
        WHERE user_guilds.guild_id = guild_bot_settings.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- Add trigger for updated_at
CREATE TRIGGER update_guild_bot_settings_updated_at
    BEFORE UPDATE ON public.guild_bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();