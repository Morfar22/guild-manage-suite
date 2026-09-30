create table if not exists public.command_execution_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  command_name text not null,
  user_id text,
  channel_id text,
  source text not null default 'slash',
  status text not null,
  latency_ms integer not null default 0,
  blocked_reason text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint command_execution_events_source_check check (source in ('slash','prefix')),
  constraint command_execution_events_status_check check (status in ('success','error','blocked')),
  constraint command_execution_events_latency_check check (latency_ms >= 0 and latency_ms <= 3600000)
);

create index if not exists command_execution_events_guild_created_idx
  on public.command_execution_events (guild_id, created_at desc);

create index if not exists command_execution_events_guild_command_created_idx
  on public.command_execution_events (guild_id, command_name, created_at desc);

create index if not exists command_execution_events_guild_status_created_idx
  on public.command_execution_events (guild_id, status, created_at desc);

alter table public.command_execution_events enable row level security;

revoke all on table public.command_execution_events from anon;
revoke all on table public.command_execution_events from authenticated;
grant select on table public.command_execution_events to authenticated;
grant select, insert, update, delete on table public.command_execution_events to service_role;

drop policy if exists "Guild admins can view command execution events" on public.command_execution_events;

create policy "Guild admins can view command execution events"
on public.command_execution_events
for select
to authenticated
using (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = command_execution_events.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);
