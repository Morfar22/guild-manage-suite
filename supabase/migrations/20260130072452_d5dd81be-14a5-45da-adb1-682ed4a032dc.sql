-- Create AI chat settings table
CREATE TABLE public.ai_chat_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  channel_id TEXT NULL,
  system_prompt TEXT NOT NULL DEFAULT 'Du er en venlig og hjælpsom Discord bot assistent. Svar kort og præcist på dansk.',
  max_history_messages INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);

-- Create AI chat history table for conversation memory
CREATE TABLE public.ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_ai_chat_history_lookup ON public.ai_chat_history(guild_id, channel_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_chat_settings
CREATE POLICY "Users can view their guild AI settings" 
ON public.ai_chat_settings 
FOR SELECT 
USING (EXISTS ( SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = ai_chat_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true));

CREATE POLICY "Users can insert their guild AI settings" 
ON public.ai_chat_settings 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = ai_chat_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true));

CREATE POLICY "Users can update their guild AI settings" 
ON public.ai_chat_settings 
FOR UPDATE 
USING (EXISTS ( SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = ai_chat_settings.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true));

-- RLS policies for ai_chat_history (read only for dashboard users)
CREATE POLICY "Users can view their guild AI chat history" 
ON public.ai_chat_history 
FOR SELECT 
USING (EXISTS ( SELECT 1 FROM user_guilds WHERE user_guilds.guild_id = ai_chat_history.guild_id AND user_guilds.user_id = auth.uid() AND user_guilds.has_admin_permission = true));

-- Add trigger for updated_at
CREATE TRIGGER update_ai_chat_settings_updated_at
BEFORE UPDATE ON public.ai_chat_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();