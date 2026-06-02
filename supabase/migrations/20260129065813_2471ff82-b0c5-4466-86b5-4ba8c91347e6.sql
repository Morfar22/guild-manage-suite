-- Create economy_accounts table
CREATE TABLE public.economy_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    discord_username TEXT,
    wallet BIGINT NOT NULL DEFAULT 0,
    bank BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    last_daily_at TIMESTAMP WITH TIME ZONE,
    last_work_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, user_id)
);

-- Create economy_transactions table
CREATE TABLE public.economy_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    from_user_id TEXT,
    to_user_id TEXT NOT NULL,
    amount BIGINT NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create economy_settings table
CREATE TABLE public.economy_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE UNIQUE,
    currency_name TEXT NOT NULL DEFAULT 'coins',
    currency_symbol TEXT NOT NULL DEFAULT '💰',
    daily_amount INTEGER NOT NULL DEFAULT 100,
    work_min INTEGER NOT NULL DEFAULT 50,
    work_max INTEGER NOT NULL DEFAULT 200,
    work_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
    daily_cooldown_hours INTEGER NOT NULL DEFAULT 24,
    starting_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.economy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for economy_accounts
CREATE POLICY "Users can view their guild economy accounts"
ON public.economy_accounts FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = economy_accounts.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for economy_transactions
CREATE POLICY "Users can view their guild economy transactions"
ON public.economy_transactions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = economy_transactions.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for economy_settings
CREATE POLICY "Users can view their guild economy settings"
ON public.economy_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = economy_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild economy settings"
ON public.economy_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = economy_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild economy settings"
ON public.economy_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = economy_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_economy_accounts_updated_at
    BEFORE UPDATE ON public.economy_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_economy_settings_updated_at
    BEFORE UPDATE ON public.economy_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();