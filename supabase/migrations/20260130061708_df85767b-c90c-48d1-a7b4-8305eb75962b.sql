-- Create table for tracked Twitch streamers
CREATE TABLE public.twitch_streamers (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    twitch_username text NOT NULL,
    twitch_user_id text,
    display_name text,
    profile_image_url text,
    notification_channel_id text NOT NULL,
    mention_role_id text,
    is_live boolean NOT NULL DEFAULT false,
    last_stream_id text,
    last_went_live_at timestamp with time zone,
    last_went_offline_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(guild_id, twitch_username)
);

-- Create table for Twitch notification settings per guild
CREATE TABLE public.twitch_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
    enabled boolean NOT NULL DEFAULT true,
    live_message text DEFAULT '🔴 **{streamer}** er nu LIVE på Twitch!',
    offline_message text DEFAULT '⚫ **{streamer}** er gået offline.',
    live_embed_color text DEFAULT '#9146FF',
    offline_embed_color text DEFAULT '#6441A5',
    show_game boolean NOT NULL DEFAULT true,
    show_viewers boolean NOT NULL DEFAULT true,
    show_thumbnail boolean NOT NULL DEFAULT true,
    notify_on_offline boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.twitch_streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitch_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for twitch_streamers
CREATE POLICY "Users can view their guild streamers" 
ON public.twitch_streamers 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_streamers.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild streamers" 
ON public.twitch_streamers 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_streamers.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild streamers" 
ON public.twitch_streamers 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_streamers.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild streamers" 
ON public.twitch_streamers 
FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_streamers.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

-- RLS Policies for twitch_settings
CREATE POLICY "Users can view their guild twitch settings" 
ON public.twitch_settings 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_settings.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild twitch settings" 
ON public.twitch_settings 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_settings.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild twitch settings" 
ON public.twitch_settings 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM user_guilds 
    WHERE user_guilds.guild_id = twitch_settings.guild_id 
    AND user_guilds.user_id = auth.uid() 
    AND user_guilds.has_admin_permission = true
));

-- Add updated_at triggers
CREATE TRIGGER update_twitch_streamers_updated_at
BEFORE UPDATE ON public.twitch_streamers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_twitch_settings_updated_at
BEFORE UPDATE ON public.twitch_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.twitch_streamers;