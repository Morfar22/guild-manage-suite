create index if not exists dashboard_audit_log_command_history_idx
  on public.dashboard_audit_log (guild_id, target_type, target_id, created_at desc);
