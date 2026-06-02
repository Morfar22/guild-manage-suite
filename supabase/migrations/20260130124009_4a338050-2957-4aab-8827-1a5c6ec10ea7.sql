-- Add new columns to leveling_settings for extended features
ALTER TABLE public.leveling_settings 
ADD COLUMN IF NOT EXISTS blacklist_channels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS voice_xp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_xp_per_minute integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS voice_xp_cooldown_seconds integer DEFAULT 60;

-- Create XP multipliers table
CREATE TABLE public.xp_multipliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  multiplier_type text NOT NULL CHECK (multiplier_type IN ('role', 'channel', 'global')),
  target_id text, -- role_id or channel_id, null for global
  multiplier numeric(3,2) NOT NULL DEFAULT 1.5,
  enabled boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create rank card settings table
CREATE TABLE public.rank_card_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  background_color text DEFAULT '#1a1a2e',
  accent_color text DEFAULT '#5865F2',
  text_color text DEFAULT '#ffffff',
  progress_bar_color text DEFAULT '#5865F2',
  background_image_url text,
  show_rank boolean DEFAULT true,
  show_level boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);

-- Enable RLS
ALTER TABLE public.xp_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_card_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for xp_multipliers
CREATE POLICY "Users can view their guild XP multipliers"
  ON public.xp_multipliers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = xp_multipliers.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert their guild XP multipliers"
  ON public.xp_multipliers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = xp_multipliers.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can update their guild XP multipliers"
  ON public.xp_multipliers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = xp_multipliers.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can delete their guild XP multipliers"
  ON public.xp_multipliers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = xp_multipliers.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

-- RLS policies for rank_card_settings
CREATE POLICY "Users can view their guild rank card settings"
  ON public.rank_card_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = rank_card_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert their guild rank card settings"
  ON public.rank_card_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = rank_card_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can update their guild rank card settings"
  ON public.rank_card_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = rank_card_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can delete their guild rank card settings"
  ON public.rank_card_settings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = rank_card_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

-- Add triggers for updated_at
CREATE TRIGGER update_xp_multipliers_updated_at
  BEFORE UPDATE ON public.xp_multipliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rank_card_settings_updated_at
  BEFORE UPDATE ON public.rank_card_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();