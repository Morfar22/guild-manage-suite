-- Create user_levels table for XP tracking
CREATE TABLE public.user_levels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    discord_username TEXT,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    total_messages INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, user_id)
);

-- Create level_roles table for automatic role rewards
CREATE TABLE public.level_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    level_required INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, level_required)
);

-- Create leveling_settings table for guild-specific settings
CREATE TABLE public.leveling_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    xp_per_message_min INTEGER NOT NULL DEFAULT 15,
    xp_per_message_max INTEGER NOT NULL DEFAULT 25,
    cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    level_up_channel_id TEXT,
    level_up_message TEXT DEFAULT 'Tillykke {user}! Du er nu level {level}! 🎉',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leveling_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_levels (view for guild admins)
CREATE POLICY "Users can view their guild user levels"
ON public.user_levels FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = user_levels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for level_roles
CREATE POLICY "Users can view their guild level roles"
ON public.level_roles FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = level_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild level roles"
ON public.level_roles FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = level_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild level roles"
ON public.level_roles FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = level_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild level roles"
ON public.level_roles FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = level_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for leveling_settings
CREATE POLICY "Users can view their guild leveling settings"
ON public.leveling_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = leveling_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild leveling settings"
ON public.leveling_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = leveling_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild leveling settings"
ON public.leveling_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = leveling_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add updated_at triggers
CREATE TRIGGER update_user_levels_updated_at
    BEFORE UPDATE ON public.user_levels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_level_roles_updated_at
    BEFORE UPDATE ON public.level_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leveling_settings_updated_at
    BEFORE UPDATE ON public.leveling_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();