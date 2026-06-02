-- Add panel_type column to application_settings
ALTER TABLE public.application_settings
ADD COLUMN panel_type text NOT NULL DEFAULT 'buttons';

-- Add comment for clarity
COMMENT ON COLUMN public.application_settings.panel_type IS 'Panel display type: buttons or dropdown';