-- Create FiveM whitelist table
CREATE TABLE public.fivem_whitelist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  steam_hex TEXT,
  license TEXT,
  discord_id TEXT,
  fivem_id TEXT,
  ip_address TEXT,
  is_whitelisted BOOLEAN NOT NULL DEFAULT false,
  whitelist_reason TEXT,
  whitelisted_by TEXT,
  whitelisted_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  playtime_minutes INTEGER DEFAULT 0,
  priority_level INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id, discord_user_id)
);

-- Create FiveM settings table
CREATE TABLE public.fivem_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  server_name TEXT,
  server_ip TEXT,
  cfx_code TEXT,
  whitelist_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_whitelist_role_id TEXT,
  whitelisted_role_id TEXT,
  sync_discord_roles BOOLEAN NOT NULL DEFAULT true,
  sync_playtime BOOLEAN NOT NULL DEFAULT true,
  log_channel_id TEXT,
  whitelist_application_form_id UUID REFERENCES public.application_forms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create FiveM player sessions table for tracking
CREATE TABLE public.fivem_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  whitelist_id UUID REFERENCES public.fivem_whitelist(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  server_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fivem_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fivem_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fivem_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fivem_whitelist
CREATE POLICY "Users can view their guild FiveM whitelist" 
ON public.fivem_whitelist 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_whitelist.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild FiveM whitelist" 
ON public.fivem_whitelist 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_whitelist.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild FiveM whitelist" 
ON public.fivem_whitelist 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_whitelist.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild FiveM whitelist" 
ON public.fivem_whitelist 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_whitelist.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

-- RLS Policies for fivem_settings
CREATE POLICY "Users can view their guild FiveM settings" 
ON public.fivem_settings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_settings.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild FiveM settings" 
ON public.fivem_settings 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_settings.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild FiveM settings" 
ON public.fivem_settings 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_settings.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

-- RLS Policies for fivem_sessions
CREATE POLICY "Users can view their guild FiveM sessions" 
ON public.fivem_sessions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_guilds 
  WHERE user_guilds.guild_id = fivem_sessions.guild_id 
  AND user_guilds.user_id = auth.uid() 
  AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_fivem_whitelist_updated_at
BEFORE UPDATE ON public.fivem_whitelist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fivem_settings_updated_at
BEFORE UPDATE ON public.fivem_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();