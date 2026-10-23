-- The Supabase Postgres image creates these roles. These passwords are local only.
ALTER USER authenticator WITH PASSWORD 'guildos-local-postgres';
ALTER USER supabase_auth_admin WITH PASSWORD 'guildos-local-postgres';
ALTER USER supabase_storage_admin WITH PASSWORD 'guildos-local-postgres';
-- supabase_functions_admin is created later by pg_net, not by the base image.
-- No local service logs in as that legacy role.
ALTER USER supabase_admin WITH PASSWORD 'guildos-local-postgres';

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';
