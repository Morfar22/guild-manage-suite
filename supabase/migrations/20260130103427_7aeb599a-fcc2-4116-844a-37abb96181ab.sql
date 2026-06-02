-- Create table for server templates
CREATE TABLE public.server_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
    created_by UUID NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    bot_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.server_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view their own templates"
ON public.server_templates
FOR SELECT
USING (created_by = auth.uid());

-- Users can view public templates
CREATE POLICY "Users can view public templates"
ON public.server_templates
FOR SELECT
USING (is_public = true);

-- Users can insert their own templates
CREATE POLICY "Users can insert their own templates"
ON public.server_templates
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update their own templates"
ON public.server_templates
FOR UPDATE
USING (created_by = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
ON public.server_templates
FOR DELETE
USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_server_templates_updated_at
BEFORE UPDATE ON public.server_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();