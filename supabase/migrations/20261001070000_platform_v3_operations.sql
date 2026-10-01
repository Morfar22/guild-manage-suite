-- Platform V3 Operations Center
-- Cases/evidence/appeals, Tickets V3, workflows, alerts, permission profiles,
-- dashboard preferences, audit undo and health/staff views.

alter table public.moderation_logs
  add column if not exists status text not null default 'open',
  add column if not exists severity text not null default 'medium',
  add column if not exists assigned_to_id text,
  add column if not exists assigned_to_name text,
  add column if not exists resolution text,
  add column if not exists closed_at timestamptz,
  add column if not exists reopened_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.moderation_logs'::regclass
      and conname='moderation_logs_status_check'
  ) then
    alter table public.moderation_logs
      add constraint moderation_logs_status_check
      check (status in ('open','investigating','resolved','dismissed','appealed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.moderation_logs'::regclass
      and conname='moderation_logs_severity_check'
  ) then
    alter table public.moderation_logs
      add constraint moderation_logs_severity_check
      check (severity in ('low','medium','high','critical'));
  end if;
end $$;

create index if not exists idx_moderation_logs_case_status
  on public.moderation_logs (guild_id, status, severity, created_at desc);

create table if not exists public.moderation_evidence (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  case_id uuid not null references public.moderation_logs(id) on delete cascade,
  evidence_type text not null default 'note',
  label text,
  content text,
  url text,
  message_id text,
  channel_id text,
  added_by_id text not null,
  added_by_name text,
  created_at timestamptz not null default now(),
  constraint moderation_evidence_type_check
    check (evidence_type in ('note','link','message','attachment'))
);

create index if not exists idx_moderation_evidence_case_created
  on public.moderation_evidence (case_id, created_at desc);

create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  case_id uuid references public.moderation_logs(id) on delete set null,
  appellant_discord_id text not null,
  appellant_name text,
  message text not null,
  status text not null default 'pending',
  staff_response text,
  reviewed_by_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moderation_appeals_status_check
    check (status in ('pending','needs_info','accepted','rejected','closed'))
);

create index if not exists idx_moderation_appeals_guild_status
  on public.moderation_appeals (guild_id, status, created_at desc);

alter table public.tickets
  add column if not exists priority text not null default 'normal',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists sla_due_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists transferred_to_role_id text,
  add column if not exists transferred_to_role_name text,
  add column if not exists reopened_at timestamptz,
  add column if not exists resolution text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tickets'::regclass
      and conname='tickets_priority_check'
  ) then
    alter table public.tickets
      add constraint tickets_priority_check
      check (priority in ('low','normal','high','urgent'));
  end if;
end $$;

create index if not exists idx_tickets_priority_status_created
  on public.tickets (guild_id, status, priority, created_at desc);

create index if not exists idx_tickets_sla_due
  on public.tickets (guild_id, sla_due_at)
  where sla_due_at is not null and closed_at is null;

create table if not exists public.ticket_internal_notes (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_discord_id text,
  author_name text,
  author_user_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_internal_notes_ticket
  on public.ticket_internal_notes (ticket_id, created_at desc);

alter table public.custom_commands
  add column if not exists allowed_role_ids text[] not null default '{}'::text[],
  add column if not exists blocked_role_ids text[] not null default '{}'::text[],
  add column if not exists blocked_channel_ids text[] not null default '{}'::text[],
  add column if not exists conditions jsonb not null default '{}'::jsonb,
  add column if not exists response_buttons jsonb not null default '[]'::jsonb,
  add column if not exists response_selects jsonb not null default '[]'::jsonb;

create table if not exists public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_by_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_workflows_trigger_check
    check (trigger_type in (
      'member_join',
      'message_keyword',
      'ticket_created',
      'command_error',
      'raid_detected'
    ))
);

create index if not exists idx_automation_workflows_guild_enabled
  on public.automation_workflows (guild_id, enabled, trigger_type);

create table if not exists public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  trigger_type text not null,
  trigger_payload jsonb not null default '{}'::jsonb,
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now(),
  constraint workflow_executions_status_check
    check (status in ('success','partial','error','skipped'))
);

create index if not exists idx_workflow_executions_workflow_created
  on public.workflow_executions (workflow_id, created_at desc);

create table if not exists public.command_permission_profiles (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  description text,
  role_ids text[] not null default '{}'::text[],
  command_names text[] not null default '{}'::text[],
  allowed_channel_ids text[] not null default '{}'::text[],
  cooldown_seconds integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, name),
  constraint command_permission_profiles_cooldown_check
    check (cooldown_seconds is null or (cooldown_seconds >= 0 and cooldown_seconds <= 86400))
);

create table if not exists public.command_presets (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  description text,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, name)
);

create table if not exists public.dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null,
  widgets jsonb not null default '[]'::jsonb,
  compact_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (guild_id, user_id)
);

alter table public.dashboard_notifications
  add column if not exists severity text not null default 'info',
  add column if not exists status text not null default 'open',
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.dashboard_notifications'::regclass
      and conname='dashboard_notifications_severity_check'
  ) then
    alter table public.dashboard_notifications
      add constraint dashboard_notifications_severity_check
      check (severity in ('info','warning','error','critical'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.dashboard_notifications'::regclass
      and conname='dashboard_notifications_status_check'
  ) then
    alter table public.dashboard_notifications
      add constraint dashboard_notifications_status_check
      check (status in ('open','acknowledged','resolved'));
  end if;
end $$;

create index if not exists idx_dashboard_notifications_status_severity
  on public.dashboard_notifications (guild_id, status, severity, created_at desc);

alter table public.dashboard_audit_log
  add column if not exists undo_payload jsonb,
  add column if not exists undone_at timestamptz,
  add column if not exists undone_by uuid;

-- Secure moderation_logs.
alter table public.moderation_logs enable row level security;
revoke all on table public.moderation_logs from anon;
revoke all on table public.moderation_logs from authenticated;
grant select, update on table public.moderation_logs to authenticated;
grant select, insert, update, delete on table public.moderation_logs to service_role;

drop policy if exists "Users can view moderation logs for their guilds" on public.moderation_logs;
drop policy if exists "Guild admins can view moderation logs" on public.moderation_logs;
drop policy if exists "Guild admins can update moderation logs" on public.moderation_logs;

create policy "Guild admins can view moderation logs"
on public.moderation_logs for select to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=moderation_logs.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can update moderation logs"
on public.moderation_logs for update to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=moderation_logs.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=moderation_logs.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

-- Secure tickets.
alter table public.tickets enable row level security;
revoke all on table public.tickets from anon;
revoke all on table public.tickets from authenticated;
grant select, update, delete on table public.tickets to authenticated;
grant select, insert, update, delete on table public.tickets to service_role;

drop policy if exists "Users can view their guild tickets" on public.tickets;
drop policy if exists "Guild admins can view tickets" on public.tickets;
drop policy if exists "Guild admins can update tickets" on public.tickets;
drop policy if exists "Guild admins can delete tickets" on public.tickets;

create policy "Guild admins can view tickets"
on public.tickets for select to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=tickets.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can update tickets"
on public.tickets for update to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=tickets.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=tickets.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can delete tickets"
on public.tickets for delete to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=tickets.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

-- Secure custom_commands.
alter table public.custom_commands enable row level security;
revoke all on table public.custom_commands from anon;
revoke all on table public.custom_commands from authenticated;
grant select, insert, update, delete on table public.custom_commands to authenticated;
grant select, insert, update, delete on table public.custom_commands to service_role;

drop policy if exists "Custom commands deletable by authenticated" on public.custom_commands;
drop policy if exists "Custom commands insertable by authenticated" on public.custom_commands;
drop policy if exists "Custom commands updatable by authenticated" on public.custom_commands;
drop policy if exists "Custom commands viewable by authenticated" on public.custom_commands;
drop policy if exists "Guild admins can view custom commands" on public.custom_commands;
drop policy if exists "Guild admins can insert custom commands" on public.custom_commands;
drop policy if exists "Guild admins can update custom commands" on public.custom_commands;
drop policy if exists "Guild admins can delete custom commands" on public.custom_commands;

create policy "Guild admins can view custom commands"
on public.custom_commands for select to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=custom_commands.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can insert custom commands"
on public.custom_commands for insert to authenticated
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=custom_commands.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can update custom commands"
on public.custom_commands for update to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=custom_commands.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=custom_commands.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can delete custom commands"
on public.custom_commands for delete to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=custom_commands.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

-- Secure alerts.
alter table public.dashboard_notifications enable row level security;
revoke all on table public.dashboard_notifications from anon;
revoke all on table public.dashboard_notifications from authenticated;
grant select, update on table public.dashboard_notifications to authenticated;
grant select, insert, update, delete on table public.dashboard_notifications to service_role;

drop policy if exists "Bot can insert notifications" on public.dashboard_notifications;
drop policy if exists "Users can read notifications for their guilds" on public.dashboard_notifications;
drop policy if exists "Users can update read status" on public.dashboard_notifications;
drop policy if exists "Guild admins can view notifications" on public.dashboard_notifications;
drop policy if exists "Guild admins can update notifications" on public.dashboard_notifications;

create policy "Guild admins can view notifications"
on public.dashboard_notifications for select to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_notifications.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create policy "Guild admins can update notifications"
on public.dashboard_notifications for update to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_notifications.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_notifications.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

-- Guild-admin CRUD for new V3 tables.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'moderation_evidence',
    'moderation_appeals',
    'ticket_internal_notes',
    'automation_workflows',
    'workflow_executions',
    'command_permission_profiles',
    'command_presets'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon', tbl);
    execute format('revoke all on table public.%I from authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to service_role', tbl);

    execute format('drop policy if exists "Guild admins can view %s" on public.%I', tbl, tbl);
    execute format('drop policy if exists "Guild admins can insert %s" on public.%I', tbl, tbl);
    execute format('drop policy if exists "Guild admins can update %s" on public.%I', tbl, tbl);
    execute format('drop policy if exists "Guild admins can delete %s" on public.%I', tbl, tbl);

    execute format(
      'create policy "Guild admins can view %s" on public.%I for select to authenticated using (exists (select 1 from public.user_guilds ug where ug.guild_id=%I.guild_id and ug.user_id=(select auth.uid()) and ug.has_admin_permission=true))',
      tbl, tbl, tbl
    );
    execute format(
      'create policy "Guild admins can insert %s" on public.%I for insert to authenticated with check (exists (select 1 from public.user_guilds ug where ug.guild_id=%I.guild_id and ug.user_id=(select auth.uid()) and ug.has_admin_permission=true))',
      tbl, tbl, tbl
    );
    execute format(
      'create policy "Guild admins can update %s" on public.%I for update to authenticated using (exists (select 1 from public.user_guilds ug where ug.guild_id=%I.guild_id and ug.user_id=(select auth.uid()) and ug.has_admin_permission=true)) with check (exists (select 1 from public.user_guilds ug where ug.guild_id=%I.guild_id and ug.user_id=(select auth.uid()) and ug.has_admin_permission=true))',
      tbl, tbl, tbl, tbl
    );
    execute format(
      'create policy "Guild admins can delete %s" on public.%I for delete to authenticated using (exists (select 1 from public.user_guilds ug where ug.guild_id=%I.guild_id and ug.user_id=(select auth.uid()) and ug.has_admin_permission=true))',
      tbl, tbl, tbl
    );
  end loop;
end $$;

-- Per-user dashboard preferences.
alter table public.dashboard_preferences enable row level security;
revoke all on table public.dashboard_preferences from anon;
revoke all on table public.dashboard_preferences from authenticated;
grant select, insert, update, delete on table public.dashboard_preferences to authenticated;
grant select, insert, update, delete on table public.dashboard_preferences to service_role;

drop policy if exists "Users can manage dashboard preferences" on public.dashboard_preferences;
create policy "Users can manage dashboard preferences"
on public.dashboard_preferences for all to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_preferences.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_preferences.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

-- Audit undo metadata.
revoke all on table public.dashboard_audit_log from authenticated;
grant select, insert, update on table public.dashboard_audit_log to authenticated;
grant select, insert, update, delete on table public.dashboard_audit_log to service_role;

drop policy if exists "Users can update audit undo state" on public.dashboard_audit_log;
create policy "Users can update audit undo state"
on public.dashboard_audit_log for update to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_audit_log.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
)
with check (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id=dashboard_audit_log.guild_id
      and ug.user_id=(select auth.uid())
      and ug.has_admin_permission=true
  )
);

create or replace view public.command_health_7d
with (security_invoker=true)
as
select
  guild_id,
  command_name,
  sum(successes + errors)::bigint as executions,
  sum(successes)::bigint as successes,
  sum(errors)::bigint as errors,
  sum(blocked)::bigint as blocked,
  case
    when sum(successes + errors) > 0
      then round((sum(errors)::numeric / sum(successes + errors)::numeric) * 100, 1)
    else 0
  end as error_rate,
  case
    when sum(successes + errors) > 0
      then round(
        sum(avg_latency_ms * (successes + errors))::numeric /
        sum(successes + errors)::numeric
      )
    else 0
  end::bigint as avg_latency_ms,
  max(last_used_at) as last_used_at
from public.command_execution_daily_stats
where day >= (current_date - 6)
group by guild_id, command_name;

revoke all on public.command_health_7d from anon;
grant select on public.command_health_7d to authenticated;
grant select on public.command_health_7d to service_role;

create or replace view public.staff_performance_30d
with (security_invoker=true)
as
with mod as (
  select
    guild_id,
    moderator_id as staff_id,
    max(moderator_name) as staff_name,
    count(*)::bigint as moderation_actions,
    count(*) filter (where action_type='ban')::bigint as bans,
    count(*) filter (where action_type='warn')::bigint as warns,
    count(*) filter (where action_type='kick')::bigint as kicks,
    count(*) filter (where action_type='timeout')::bigint as timeouts,
    max(created_at) as last_action_at
  from public.moderation_logs
  where created_at >= now() - interval '30 days'
  group by guild_id, moderator_id
),
ticket as (
  select
    guild_id,
    closed_by_id as staff_id,
    max(closed_by_name) as staff_name,
    count(*)::bigint as tickets_closed,
    max(closed_at) as last_ticket_at
  from public.tickets
  where closed_at >= now() - interval '30 days'
    and closed_by_id is not null
  group by guild_id, closed_by_id
)
select
  coalesce(mod.guild_id, ticket.guild_id) as guild_id,
  coalesce(mod.staff_id, ticket.staff_id) as staff_id,
  coalesce(mod.staff_name, ticket.staff_name) as staff_name,
  coalesce(mod.moderation_actions, 0)::bigint as moderation_actions,
  coalesce(mod.bans, 0)::bigint as bans,
  coalesce(mod.warns, 0)::bigint as warns,
  coalesce(mod.kicks, 0)::bigint as kicks,
  coalesce(mod.timeouts, 0)::bigint as timeouts,
  coalesce(ticket.tickets_closed, 0)::bigint as tickets_closed,
  greatest(mod.last_action_at, ticket.last_ticket_at) as last_activity_at
from mod
full join ticket
  on mod.guild_id=ticket.guild_id
 and mod.staff_id=ticket.staff_id;

revoke all on public.staff_performance_30d from anon;
grant select on public.staff_performance_30d to authenticated;
grant select on public.staff_performance_30d to service_role;
