-- Create application_forms table for customizable application types
CREATE TABLE public.application_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    emoji text DEFAULT '📝',
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    required_role_id text,
    granted_role_id text,
    approval_channel_id text,
    denial_channel_id text,
    enabled boolean NOT NULL DEFAULT true,
    allow_reapply boolean NOT NULL DEFAULT false,
    reapply_cooldown_hours integer DEFAULT 24,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create application_settings table for guild-wide settings
CREATE TABLE public.application_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id uuid NOT NULL UNIQUE REFERENCES public.guilds(id) ON DELETE CASCADE,
    panel_channel_id text,
    panel_message_id text,
    log_channel_id text,
    dm_on_submit boolean NOT NULL DEFAULT true,
    dm_on_approval boolean NOT NULL DEFAULT true,
    dm_on_denial boolean NOT NULL DEFAULT true,
    approval_message text DEFAULT 'Congratulations! Your {form_name} application has been approved.',
    denial_message text DEFAULT 'Unfortunately, your {form_name} application has been denied.',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create application_submissions table for actual applications
CREATE TABLE public.application_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    form_id uuid NOT NULL REFERENCES public.application_forms(id) ON DELETE CASCADE,
    discord_user_id text NOT NULL,
    discord_username text,
    discord_avatar text,
    answers jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    reviewer_discord_id text,
    reviewer_name text,
    reviewer_notes text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for application_forms
CREATE POLICY "Users can view their guild application forms"
ON public.application_forms FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_forms.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild application forms"
ON public.application_forms FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_forms.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild application forms"
ON public.application_forms FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_forms.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild application forms"
ON public.application_forms FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_forms.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS Policies for application_settings
CREATE POLICY "Users can view their guild application settings"
ON public.application_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild application settings"
ON public.application_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild application settings"
ON public.application_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS Policies for application_submissions
CREATE POLICY "Users can view their guild application submissions"
ON public.application_submissions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_submissions.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild application submissions"
ON public.application_submissions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = application_submissions.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_application_forms_updated_at
BEFORE UPDATE ON public.application_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_application_settings_updated_at
BEFORE UPDATE ON public.application_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_application_submissions_updated_at
BEFORE UPDATE ON public.application_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_application_forms_guild ON public.application_forms(guild_id);
CREATE INDEX idx_application_submissions_guild ON public.application_submissions(guild_id);
CREATE INDEX idx_application_submissions_form ON public.application_submissions(form_id);
CREATE INDEX idx_application_submissions_status ON public.application_submissions(status);
CREATE INDEX idx_application_submissions_user ON public.application_submissions(discord_user_id);