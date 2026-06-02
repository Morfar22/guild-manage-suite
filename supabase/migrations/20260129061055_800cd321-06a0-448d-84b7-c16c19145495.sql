-- Create application_status enum
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'denied');

-- Create character_status enum  
CREATE TYPE public.character_status AS ENUM ('alive', 'dead', 'retired');

-- =====================
-- 1. APPLICATIONS TABLE
-- =====================
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    discord_user_id TEXT NOT NULL,
    discord_username TEXT,
    application_type TEXT NOT NULL DEFAULT 'whitelist',
    status application_status NOT NULL DEFAULT 'pending',
    answers JSONB DEFAULT '[]'::jsonb,
    reviewer_discord_id TEXT,
    reviewer_name TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for applications
CREATE POLICY "Users can view their guild applications"
ON public.applications FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = applications.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Trigger for updated_at
CREATE TRIGGER update_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- 2. CHARACTERS TABLE
-- =====================
CREATE TABLE public.characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    discord_username TEXT,
    name TEXT NOT NULL,
    age INTEGER,
    background TEXT,
    faction TEXT,
    occupation TEXT,
    appearance TEXT,
    status character_status NOT NULL DEFAULT 'alive',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for characters
CREATE POLICY "Users can view their guild characters"
ON public.characters FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = characters.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Trigger for updated_at
CREATE TRIGGER update_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- 3. WELCOME SETTINGS TABLE
-- =====================
CREATE TABLE public.welcome_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL UNIQUE REFERENCES public.guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    welcome_channel_id TEXT,
    welcome_message TEXT DEFAULT 'Velkommen til serveren, {user}! 🎉',
    leave_channel_id TEXT,
    leave_message TEXT DEFAULT '{user} har forladt serveren.',
    leave_enabled BOOLEAN NOT NULL DEFAULT false,
    dm_enabled BOOLEAN NOT NULL DEFAULT false,
    dm_message TEXT DEFAULT 'Velkommen til {server}! Læs venligst reglerne.',
    auto_role_id TEXT,
    auto_role_enabled BOOLEAN NOT NULL DEFAULT false,
    embed_enabled BOOLEAN NOT NULL DEFAULT true,
    embed_color TEXT DEFAULT '#5865F2',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.welcome_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for welcome_settings
CREATE POLICY "Users can view their guild welcome settings"
ON public.welcome_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = welcome_settings.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild welcome settings"
ON public.welcome_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = welcome_settings.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild welcome settings"
ON public.welcome_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = welcome_settings.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild welcome settings"
ON public.welcome_settings FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = welcome_settings.guild_id 
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Trigger for updated_at
CREATE TRIGGER update_welcome_settings_updated_at
BEFORE UPDATE ON public.welcome_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- 4. WHITELIST ROLE SETTINGS (for auto role assignment on approve)
-- =====================
ALTER TABLE public.guilds 
ADD COLUMN IF NOT EXISTS whitelist_role_id TEXT,
ADD COLUMN IF NOT EXISTS staff_role_id TEXT;