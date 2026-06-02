
-- Counting Channel Settings
CREATE TABLE public.counting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id TEXT,
  current_count INTEGER NOT NULL DEFAULT 0,
  last_counter_id TEXT,
  high_score INTEGER NOT NULL DEFAULT 0,
  allow_same_user BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counting_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view counting settings" ON public.counting_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage counting settings" ON public.counting_settings FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Confession Settings
CREATE TABLE public.confession_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id TEXT,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  approval_channel_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.confession_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view confession settings" ON public.confession_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage confession settings" ON public.confession_settings FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Confessions
CREATE TABLE public.confessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_id TEXT,
  confession_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view confessions" ON public.confessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage confessions" ON public.confessions FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Birthday Settings
CREATE TABLE public.birthday_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id TEXT,
  role_id TEXT,
  message_template TEXT DEFAULT '🎂 Tillykke med fødselsdagen, {user}! 🎉',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.birthday_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view birthday settings" ON public.birthday_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage birthday settings" ON public.birthday_settings FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Birthdays
CREATE TABLE public.birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  birthday_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);
ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view birthdays" ON public.birthdays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage birthdays" ON public.birthdays FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Music Quiz Settings
CREATE TABLE public.music_quiz_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id TEXT,
  rounds INTEGER NOT NULL DEFAULT 10,
  time_per_round INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.music_quiz_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view music quiz settings" ON public.music_quiz_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage music quiz settings" ON public.music_quiz_settings FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Economy Shop Items
CREATE TABLE public.economy_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  role_id TEXT,
  stock INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.economy_shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view shop items" ON public.economy_shop_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shop items" ON public.economy_shop_items FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));

-- Economy Purchases
CREATE TABLE public.economy_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  item_id UUID REFERENCES public.economy_shop_items(id) ON DELETE CASCADE NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.economy_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view purchases" ON public.economy_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage purchases" ON public.economy_purchases FOR ALL TO authenticated USING (public.has_admin_or_staff_role(auth.uid())) WITH CHECK (public.has_admin_or_staff_role(auth.uid()));
