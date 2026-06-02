-- JTC Settings table - stores configuration per guild
CREATE TABLE public.jtc_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_channel_id TEXT, -- The voice channel users join to create their own
    category_id TEXT, -- Category where new channels are created
    default_user_limit INTEGER DEFAULT 0, -- 0 = unlimited
    channel_name_template TEXT DEFAULT '{username}s kanal',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id)
);

-- JTC Active Channels table - tracks temporary channels
CREATE TABLE public.jtc_channels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL, -- Discord user ID of the channel owner
    owner_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jtc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jtc_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jtc_settings
CREATE POLICY "Users can view their guild JTC settings"
ON public.jtc_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = jtc_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild JTC settings"
ON public.jtc_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = jtc_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild JTC settings"
ON public.jtc_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = jtc_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS Policies for jtc_channels (read-only from dashboard)
CREATE POLICY "Users can view their guild JTC channels"
ON public.jtc_channels FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = jtc_channels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Create trigger for updated_at
CREATE TRIGGER update_jtc_settings_updated_at
BEFORE UPDATE ON public.jtc_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();