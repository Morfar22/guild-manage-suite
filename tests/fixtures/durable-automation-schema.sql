-- Isolated fixture with the production columns used by this migration.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role,anon;
CREATE TABLE public.guilds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id text NOT NULL,guild_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.user_guilds(user_id uuid,guild_id uuid REFERENCES public.guilds(id),has_admin_permission boolean);
CREATE TABLE public.test_platform_roles(user_id uuid PRIMARY KEY);
CREATE FUNCTION public.has_admin_or_staff_role(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT FROM public.test_platform_roles WHERE user_id=p_user_id) $$;
GRANT SELECT ON public.user_guilds,public.test_platform_roles TO authenticated;
CREATE TABLE public.automation_workflows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),name text NOT NULL,enabled boolean NOT NULL DEFAULT true,
 trigger_type text NOT NULL,trigger_config jsonb NOT NULL DEFAULT '{}',actions jsonb NOT NULL DEFAULT '[]',run_count integer NOT NULL DEFAULT 0,
 last_run_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.workflow_executions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id),
 trigger_type text NOT NULL,trigger_payload jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'success' CHECK(status IN ('success','partial','error','skipped')),
 error_message text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.moderation_scheduled_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),discord_guild_id text NOT NULL,
 action_type text NOT NULL CHECK(action_type IN ('unban','remove_role')),target_id text NOT NULL,target_name text,role_id text,reason text,
 execute_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executing','executed','failed','cancelled')),
 created_by_id text NOT NULL,created_by_name text,metadata jsonb NOT NULL DEFAULT '{}',last_error text,executed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.moderation_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),action_type text NOT NULL,moderator_id text NOT NULL,
 moderator_name text,target_id text NOT NULL,target_name text,reason text,status text DEFAULT 'open',severity text DEFAULT 'medium',metadata jsonb,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.dashboard_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),type text NOT NULL DEFAULT 'info',title text NOT NULL,message text,
 source text NOT NULL DEFAULT 'system',is_read boolean NOT NULL DEFAULT false,metadata jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 severity text NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','error','critical')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),resolved_at timestamptz);
CREATE TABLE public.tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),channel_id text NOT NULL,creator_id text NOT NULL,
 creator_name text,subject text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,sla_due_at timestamptz,escalated_at timestamptz);
CREATE TABLE public.command_execution_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),command_name text NOT NULL,user_id text,channel_id text,
 status text NOT NULL,error_message text,latency_ms integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.raid_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guild_id uuid NOT NULL REFERENCES public.guilds(id),join_count integer NOT NULL,action_taken text NOT NULL,
 user_ids text[],created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.moderation_scheduled_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
