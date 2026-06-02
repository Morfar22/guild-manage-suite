-- Create giveaways table
CREATE TABLE public.giveaways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  prize TEXT NOT NULL,
  description TEXT,
  winners_count INTEGER NOT NULL DEFAULT 1,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended BOOLEAN NOT NULL DEFAULT false,
  required_role_id TEXT,
  host_user_id TEXT NOT NULL,
  host_username TEXT,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  winners JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their guild giveaways"
  ON public.giveaways FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = giveaways.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can insert their guild giveaways"
  ON public.giveaways FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = giveaways.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can update their guild giveaways"
  ON public.giveaways FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = giveaways.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

CREATE POLICY "Users can delete their guild giveaways"
  ON public.giveaways FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = giveaways.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
  ));

-- Trigger for updated_at
CREATE TRIGGER update_giveaways_updated_at
  BEFORE UPDATE ON public.giveaways
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();