-- Create enum for module types
CREATE TYPE public.module_type AS ENUM ('moderation', 'music', 'leveling', 'utility', 'fun');

-- Create guilds table to store guild configurations
CREATE TABLE public.guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL UNIQUE,
    guild_name TEXT NOT NULL,
    guild_icon TEXT,
    owner_id TEXT NOT NULL,
    command_prefix TEXT DEFAULT '!' NOT NULL,
    log_channel_id TEXT,
    auto_moderation_enabled BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create guild_modules table to track enabled/disabled modules per guild
CREATE TABLE public.guild_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    module_type module_type NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(guild_id, module_type)
);

-- Create guild_commands table to track enabled/disabled commands per guild
CREATE TABLE public.guild_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    command_name TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(guild_id, command_name)
);

-- Create user_guilds table to link Supabase users to their Discord guilds
CREATE TABLE public.user_guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    discord_user_id TEXT NOT NULL,
    has_admin_permission BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, guild_id)
);

-- Enable RLS on all tables
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_guilds ENABLE ROW LEVEL SECURITY;

-- RLS policies for guilds - users can only access guilds they're linked to
CREATE POLICY "Users can view their guilds"
ON public.guilds FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guilds.id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can update their guilds"
ON public.guilds FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guilds.id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- RLS policies for guild_modules
CREATE POLICY "Users can view their guild modules"
ON public.guild_modules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guild_modules.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can manage their guild modules"
ON public.guild_modules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guild_modules.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- RLS policies for guild_commands
CREATE POLICY "Users can view their guild commands"
ON public.guild_commands FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guild_commands.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can manage their guild commands"
ON public.guild_commands FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = guild_commands.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- RLS policies for user_guilds
CREATE POLICY "Users can view their own guild links"
ON public.user_guilds FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own guild links"
ON public.user_guilds FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_guilds_updated_at
BEFORE UPDATE ON public.guilds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guild_modules_updated_at
BEFORE UPDATE ON public.guild_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guild_commands_updated_at
BEFORE UPDATE ON public.guild_commands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();