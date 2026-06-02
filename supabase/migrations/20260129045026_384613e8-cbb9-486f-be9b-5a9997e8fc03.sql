-- Create ticket_settings table for guild-level ticket configuration
CREATE TABLE public.ticket_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL UNIQUE REFERENCES public.guilds(id) ON DELETE CASCADE,
  panel_channel_id text,
  thread_category_id text,
  panel_message_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their guild ticket settings"
ON public.ticket_settings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = ticket_settings.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can manage their guild ticket settings"
ON public.ticket_settings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_guilds
  WHERE user_guilds.guild_id = ticket_settings.guild_id
  AND user_guilds.user_id = auth.uid()
  AND user_guilds.has_admin_permission = true
));

-- Trigger for updated_at
CREATE TRIGGER update_ticket_settings_updated_at
BEFORE UPDATE ON public.ticket_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();