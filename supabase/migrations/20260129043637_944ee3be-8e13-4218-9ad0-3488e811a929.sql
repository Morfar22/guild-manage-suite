-- Create enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('open', 'claimed', 'closed');

-- Create enum for ticket type
CREATE TYPE public.ticket_type AS ENUM ('support', 'application');

-- Create ticket categories table
CREATE TABLE public.ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ticket_type public.ticket_type NOT NULL DEFAULT 'support',
    emoji TEXT DEFAULT '🎫',
    welcome_message TEXT DEFAULT 'Tak for din henvendelse! En staff member vil hjælpe dig snarest.',
    staff_role_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tickets table
CREATE TABLE public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
    channel_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    creator_name TEXT,
    claimed_by_id TEXT,
    claimed_by_name TEXT,
    status public.ticket_status NOT NULL DEFAULT 'open',
    ticket_type public.ticket_type NOT NULL DEFAULT 'support',
    subject TEXT,
    closed_at TIMESTAMPTZ,
    closed_by_id TEXT,
    closed_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ticket messages table for transcripts
CREATE TABLE public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_categories
CREATE POLICY "Users can view their guild ticket categories"
ON public.ticket_categories FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = ticket_categories.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

CREATE POLICY "Users can manage their guild ticket categories"
ON public.ticket_categories FOR ALL
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = ticket_categories.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for tickets
CREATE POLICY "Users can view their guild tickets"
ON public.tickets FOR SELECT
USING (EXISTS (
    SELECT 1 FROM user_guilds
    WHERE user_guilds.guild_id = tickets.guild_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- RLS policies for ticket_messages
CREATE POLICY "Users can view messages for their guild tickets"
ON public.ticket_messages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM tickets
    JOIN user_guilds ON user_guilds.guild_id = tickets.guild_id
    WHERE tickets.id = ticket_messages.ticket_id
    AND user_guilds.user_id = auth.uid()
    AND user_guilds.has_admin_permission = true
));

-- Add triggers for updated_at
CREATE TRIGGER update_ticket_categories_updated_at
    BEFORE UPDATE ON public.ticket_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_tickets_guild_id ON public.tickets(guild_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_categories_guild_id ON public.ticket_categories(guild_id);

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;