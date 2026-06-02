-- Create table for multiple JTC trigger configurations
CREATE TABLE public.jtc_triggers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'JTC Kanal',
    trigger_channel_id TEXT NOT NULL,
    category_id TEXT,
    channel_name_template TEXT NOT NULL DEFAULT '{username}s kanal',
    default_user_limit INTEGER NOT NULL DEFAULT 0,
    required_role_id TEXT,
    required_role_name TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, trigger_channel_id)
);

-- Enable RLS
ALTER TABLE public.jtc_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_guilds table (matching existing pattern)
CREATE POLICY "Users can view JTC triggers for their guilds"
ON public.jtc_triggers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = jtc_triggers.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can insert JTC triggers for their guilds"
ON public.jtc_triggers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = jtc_triggers.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can update JTC triggers for their guilds"
ON public.jtc_triggers
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = jtc_triggers.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

CREATE POLICY "Users can delete JTC triggers for their guilds"
ON public.jtc_triggers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_guilds
        WHERE user_guilds.guild_id = jtc_triggers.guild_id
        AND user_guilds.user_id = auth.uid()
        AND user_guilds.has_admin_permission = true
    )
);

-- Add trigger_id reference to jtc_channels
ALTER TABLE public.jtc_channels 
ADD COLUMN trigger_id UUID REFERENCES public.jtc_triggers(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_jtc_triggers_updated_at
BEFORE UPDATE ON public.jtc_triggers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();