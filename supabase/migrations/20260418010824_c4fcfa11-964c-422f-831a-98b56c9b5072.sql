-- Tabel til at gemme aktive invites pr. guild
CREATE TABLE public.invite_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  inviter_discord_id TEXT,
  inviter_username TEXT,
  channel_id TEXT,
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, invite_code)
);

CREATE INDEX idx_invite_tracker_guild ON public.invite_tracker(guild_id);
CREATE INDEX idx_invite_tracker_inviter ON public.invite_tracker(guild_id, inviter_discord_id);

-- Tabel til at logge hver join via invite
CREATE TABLE public.invite_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  invite_code TEXT,
  inviter_discord_id TEXT,
  inviter_username TEXT,
  joined_user_id TEXT NOT NULL,
  joined_username TEXT,
  joined_account_created_at TIMESTAMPTZ,
  is_fake BOOLEAN NOT NULL DEFAULT false,
  has_left BOOLEAN NOT NULL DEFAULT false,
  left_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_uses_guild ON public.invite_uses(guild_id);
CREATE INDEX idx_invite_uses_inviter ON public.invite_uses(guild_id, inviter_discord_id);
CREATE INDEX idx_invite_uses_joined ON public.invite_uses(guild_id, joined_user_id);

-- RLS
ALTER TABLE public.invite_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invite_tracker" ON public.invite_tracker FOR SELECT USING (true);
CREATE POLICY "Anyone can insert invite_tracker" ON public.invite_tracker FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update invite_tracker" ON public.invite_tracker FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete invite_tracker" ON public.invite_tracker FOR DELETE USING (true);

CREATE POLICY "Anyone can read invite_uses" ON public.invite_uses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert invite_uses" ON public.invite_uses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update invite_uses" ON public.invite_uses FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete invite_uses" ON public.invite_uses FOR DELETE USING (true);

-- Trigger til updated_at
CREATE TRIGGER update_invite_tracker_updated_at
  BEFORE UPDATE ON public.invite_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();