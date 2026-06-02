-- Create log_settings table for configurable logging
CREATE TABLE public.log_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  log_channel_id TEXT,
  log_member_join BOOLEAN NOT NULL DEFAULT true,
  log_member_leave BOOLEAN NOT NULL DEFAULT true,
  log_member_ban BOOLEAN NOT NULL DEFAULT true,
  log_member_unban BOOLEAN NOT NULL DEFAULT true,
  log_message_delete BOOLEAN NOT NULL DEFAULT true,
  log_message_edit BOOLEAN NOT NULL DEFAULT true,
  log_message_bulk_delete BOOLEAN NOT NULL DEFAULT true,
  log_role_create BOOLEAN NOT NULL DEFAULT false,
  log_role_delete BOOLEAN NOT NULL DEFAULT false,
  log_role_update BOOLEAN NOT NULL DEFAULT false,
  log_channel_create BOOLEAN NOT NULL DEFAULT false,
  log_channel_delete BOOLEAN NOT NULL DEFAULT false,
  log_channel_update BOOLEAN NOT NULL DEFAULT false,
  log_voice_join BOOLEAN NOT NULL DEFAULT false,
  log_voice_leave BOOLEAN NOT NULL DEFAULT false,
  log_voice_move BOOLEAN NOT NULL DEFAULT false,
  log_nickname_change BOOLEAN NOT NULL DEFAULT false,
  log_avatar_change BOOLEAN NOT NULL DEFAULT false,
  log_invite_create BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

-- Enable RLS
ALTER TABLE public.log_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their guild log settings"
  ON public.log_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = log_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert their guild log settings"
  ON public.log_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = log_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can update their guild log settings"
  ON public.log_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = log_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_log_settings_updated_at
  BEFORE UPDATE ON public.log_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();