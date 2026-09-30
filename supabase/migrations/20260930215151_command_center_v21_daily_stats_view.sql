create or replace view public.command_execution_daily_stats
with (security_invoker = true)
as
select
  guild_id,
  command_name,
  (created_at at time zone 'UTC')::date as day,
  count(*)::bigint as executions,
  count(*) filter (where status = 'success')::bigint as successes,
  count(*) filter (where status = 'error')::bigint as errors,
  count(*) filter (where status = 'blocked')::bigint as blocked,
  coalesce(round(avg(latency_ms) filter (where status in ('success','error'))), 0)::bigint as avg_latency_ms,
  coalesce(max(latency_ms) filter (where status in ('success','error')), 0)::integer as max_latency_ms,
  max(created_at) as last_used_at
from public.command_execution_events
group by guild_id, command_name, (created_at at time zone 'UTC')::date;

revoke all on public.command_execution_daily_stats from anon;
grant select on public.command_execution_daily_stats to authenticated;
grant select on public.command_execution_daily_stats to service_role;
