-- Disposable database only. Column types and FKs match the actual shop tables.
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE FUNCTION public.has_admin_or_staff_role(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.guilds(id uuid PRIMARY KEY,guild_id text NOT NULL);
CREATE TABLE public.user_guilds(user_id uuid,guild_id uuid REFERENCES public.guilds(id),has_admin_permission boolean NOT NULL);
GRANT SELECT ON public.user_guilds TO authenticated;
CREATE TABLE public.economy_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
 user_id text NOT NULL,discord_username text,wallet bigint NOT NULL DEFAULT 0,bank bigint NOT NULL DEFAULT 0,
 total_earned bigint NOT NULL DEFAULT 0,last_daily_at timestamptz,last_work_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(guild_id,user_id));
CREATE TABLE public.economy_shop_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
 name text NOT NULL,description text,price integer NOT NULL DEFAULT 0,role_id text,stock integer,
 enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.economy_purchases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
 user_id text NOT NULL,user_name text,item_id uuid NOT NULL REFERENCES public.economy_shop_items(id) ON DELETE CASCADE,
 purchased_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.economy_transactions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
 from_user_id text,to_user_id text NOT NULL,amount bigint NOT NULL,transaction_type text NOT NULL,description text,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
