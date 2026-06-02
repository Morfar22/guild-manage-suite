-- Create enum for automod rule types
CREATE TYPE public.automod_rule_type AS ENUM ('spam', 'links', 'words', 'mentions', 'caps', 'invites');

-- Create enum for automod actions
CREATE TYPE public.automod_action AS ENUM ('warn', 'mute', 'kick', 'ban', 'delete');

-- Create automod_rules table
CREATE TABLE public.automod_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    rule_type automod_rule_type NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    action automod_action NOT NULL DEFAULT 'warn',
    action_duration_seconds INTEGER,
    exempt_roles TEXT[] DEFAULT '{}',
    exempt_channels TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, rule_type)
);

-- Create automod_logs table for tracking triggered rules
CREATE TABLE public.automod_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    rule_type automod_rule_type NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    channel_id TEXT,
    message_content TEXT,
    action_taken automod_action NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automod_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automod_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for automod_rules
CREATE POLICY "Users can view their guild automod rules"
ON public.automod_rules FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = automod_rules.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild automod rules"
ON public.automod_rules FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = automod_rules.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild automod rules"
ON public.automod_rules FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = automod_rules.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild automod rules"
ON public.automod_rules FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = automod_rules.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for automod_logs
CREATE POLICY "Users can view their guild automod logs"
ON public.automod_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = automod_logs.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_automod_rules_updated_at
    BEFORE UPDATE ON public.automod_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();