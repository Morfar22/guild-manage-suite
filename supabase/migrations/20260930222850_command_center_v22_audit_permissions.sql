revoke all on table public.dashboard_audit_log from anon;
revoke all on table public.dashboard_audit_log from authenticated;
grant select, insert on table public.dashboard_audit_log to authenticated;
grant select, insert, update, delete on table public.dashboard_audit_log to service_role;
