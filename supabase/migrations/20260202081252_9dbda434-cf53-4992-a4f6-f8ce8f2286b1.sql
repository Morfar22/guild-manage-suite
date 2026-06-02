-- =====================================================
-- FEATURE 1: STARBOARD SYSTEM
-- =====================================================

-- Starboard settings table
CREATE TABLE public.starboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    channel_id TEXT,
    emoji TEXT NOT NULL DEFAULT '⭐',
    threshold INTEGER NOT NULL DEFAULT 5,
    ignore_self_star BOOLEAN NOT NULL DEFAULT true,
    ignored_channels TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id)
);

-- Starboard entries table
CREATE TABLE public.starboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT,
    content TEXT,
    attachments JSONB DEFAULT '[]',
    starboard_message_id TEXT,
    star_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, message_id)
);

-- =====================================================
-- FEATURE 2: WARNING POINTS SYSTEM
-- =====================================================

-- Warning settings table
CREATE TABLE public.warning_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    points_per_warn INTEGER NOT NULL DEFAULT 1,
    decay_days INTEGER DEFAULT 30,
    thresholds JSONB NOT NULL DEFAULT '[
        {"points": 3, "action": "mute", "duration_hours": 1},
        {"points": 5, "action": "mute", "duration_hours": 24},
        {"points": 10, "action": "kick"},
        {"points": 15, "action": "ban"}
    ]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id)
);

-- Warnings table
CREATE TABLE public.warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT,
    moderator_id TEXT NOT NULL,
    moderator_name TEXT,
    reason TEXT,
    points INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_warnings_guild_user ON public.warnings(guild_id, user_id);
CREATE INDEX idx_warnings_active ON public.warnings(guild_id, active);

-- =====================================================
-- FEATURE 3: ANALYTICS SYSTEM
-- =====================================================

-- Analytics events table (raw events)
CREATE TABLE public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    user_id TEXT,
    channel_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_guild_type ON public.analytics_events(guild_id, event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at);

-- Analytics daily stats (aggregated)
CREATE TABLE public.analytics_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    commands_used INTEGER NOT NULL DEFAULT 0,
    members_joined INTEGER NOT NULL DEFAULT 0,
    members_left INTEGER NOT NULL DEFAULT 0,
    mod_actions INTEGER NOT NULL DEFAULT 0,
    voice_minutes INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id, date)
);

CREATE INDEX idx_analytics_daily_guild_date ON public.analytics_daily_stats(guild_id, date);

-- =====================================================
-- FEATURE 4: SCHEDULED MESSAGES
-- =====================================================

CREATE TABLE public.scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    content TEXT,
    embed JSONB,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    repeat_interval TEXT CHECK (repeat_interval IN ('daily', 'weekly', 'monthly', NULL)),
    created_by_id TEXT NOT NULL,
    created_by_name TEXT,
    sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(guild_id, sent, scheduled_at);

-- =====================================================
-- FEATURE 5: MODMAIL SYSTEM
-- =====================================================

-- Modmail settings
CREATE TABLE public.modmail_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    category_id TEXT,
    staff_role_id TEXT,
    log_channel_id TEXT,
    welcome_message TEXT DEFAULT 'Tak for din henvendelse! En staff-medlem vil svare dig hurtigst muligt.',
    close_message TEXT DEFAULT 'Denne samtale er nu lukket. Tak for din henvendelse!',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(guild_id)
);

-- Modmail threads
CREATE TABLE public.modmail_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_avatar TEXT,
    channel_id TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    claimed_by_id TEXT,
    claimed_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_modmail_threads_guild_status ON public.modmail_threads(guild_id, status);
CREATE INDEX idx_modmail_threads_user ON public.modmail_threads(guild_id, user_id);

-- Modmail messages
CREATE TABLE public.modmail_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.modmail_threads(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('user', 'staff')),
    author_id TEXT NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_modmail_messages_thread ON public.modmail_messages(thread_id);

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.starboard_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warning_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modmail_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modmail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modmail_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - STARBOARD
-- =====================================================

CREATE POLICY "Users can view their guild starboard settings"
ON public.starboard_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = starboard_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild starboard settings"
ON public.starboard_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = starboard_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild starboard settings"
ON public.starboard_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = starboard_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can view their guild starboard entries"
ON public.starboard_entries FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = starboard_entries.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- =====================================================
-- RLS POLICIES - WARNINGS
-- =====================================================

CREATE POLICY "Users can view their guild warning settings"
ON public.warning_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = warning_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild warning settings"
ON public.warning_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = warning_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild warning settings"
ON public.warning_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = warning_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can view their guild warnings"
ON public.warnings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = warnings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild warnings"
ON public.warnings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = warnings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- =====================================================
-- RLS POLICIES - ANALYTICS
-- =====================================================

CREATE POLICY "Users can view their guild analytics events"
ON public.analytics_events FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = analytics_events.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can view their guild analytics stats"
ON public.analytics_daily_stats FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = analytics_daily_stats.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- =====================================================
-- RLS POLICIES - SCHEDULED MESSAGES
-- =====================================================

CREATE POLICY "Users can view their guild scheduled messages"
ON public.scheduled_messages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = scheduled_messages.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild scheduled messages"
ON public.scheduled_messages FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = scheduled_messages.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild scheduled messages"
ON public.scheduled_messages FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = scheduled_messages.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can delete their guild scheduled messages"
ON public.scheduled_messages FOR DELETE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = scheduled_messages.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- =====================================================
-- RLS POLICIES - MODMAIL
-- =====================================================

CREATE POLICY "Users can view their guild modmail settings"
ON public.modmail_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = modmail_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can insert their guild modmail settings"
ON public.modmail_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = modmail_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild modmail settings"
ON public.modmail_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = modmail_settings.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can view their guild modmail threads"
ON public.modmail_threads FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = modmail_threads.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can update their guild modmail threads"
ON public.modmail_threads FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = modmail_threads.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can view modmail messages in their guild threads"
ON public.modmail_messages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM modmail_threads
    JOIN user_guilds ON user_guilds.guild_id = modmail_threads.guild_id
    WHERE modmail_threads.id = modmail_messages.thread_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================

CREATE TRIGGER update_starboard_settings_updated_at
BEFORE UPDATE ON public.starboard_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warning_settings_updated_at
BEFORE UPDATE ON public.warning_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON public.scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modmail_settings_updated_at
BEFORE UPDATE ON public.modmail_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();