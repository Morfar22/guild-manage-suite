-- Create reaction_roles table
CREATE TABLE public.reaction_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, message_id, emoji)
);

-- Create reaction_role_panels for grouping reaction roles in embeds
CREATE TABLE public.reaction_role_panels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    channel_id TEXT,
    message_id TEXT,
    title TEXT NOT NULL DEFAULT 'Rolle Menu',
    description TEXT DEFAULT 'Reager for at få en rolle',
    color TEXT DEFAULT '#5865F2',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reaction_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reaction_role_panels ENABLE ROW LEVEL SECURITY;

-- RLS policies for reaction_roles
CREATE POLICY "Users can view their guild reaction roles"
ON public.reaction_roles FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild reaction roles"
ON public.reaction_roles FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild reaction roles"
ON public.reaction_roles FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild reaction roles"
ON public.reaction_roles FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_roles.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for reaction_role_panels
CREATE POLICY "Users can view their guild reaction role panels"
ON public.reaction_role_panels FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_role_panels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild reaction role panels"
ON public.reaction_role_panels FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_role_panels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild reaction role panels"
ON public.reaction_role_panels FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_role_panels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild reaction role panels"
ON public.reaction_role_panels FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = reaction_role_panels.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_reaction_roles_updated_at
    BEFORE UPDATE ON public.reaction_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reaction_role_panels_updated_at
    BEFORE UPDATE ON public.reaction_role_panels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();