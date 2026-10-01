-- Advanced moderation: persistent cases, notes and scheduled actions.

alter type public.moderation_action_type add value if not exists 'tempban';
alter type public.moderation_action_type add value if not exists 'role';
alter type public.moderation_action_type add value if not exists 'quarantine';

alter table public.moderation_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_moderation_logs_guild_target_created
  on public.moderation_logs (guild_id, target_id, created_at desc);

create table if not exists public.moderation_notes (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id text not null,
  user_name text,
  moderator_id text not null,
  moderator_name text,
  note text not null,
  case_id uuid references public.moderation_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_notes_guild_user_created
  on public.moderation_notes (guild_id, user_id, created_at desc);
create index if not exists idx_moderation_notes_case
  on public.moderation_notes (case_id, created_at desc);

alter table public.moderation_notes enable row level security;
revoke all on table public.moderation_notes from anon;
revoke all on table public.moderation_notes from authenticated;
grant select on table public.moderation_notes to authenticated;
grant select, insert, update, delete on table public.moderation_notes to service_role;

drop policy if exists "Guild admins can view moderation notes" on public.moderation_notes;
create policy "Guild admins can view moderation notes"
on public.moderation_notes
for select
to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id = moderation_notes.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);

create table if not exists public.moderation_scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  discord_guild_id text not null,
  action_type text not null,
  target_id text not null,
  target_name text,
  role_id text,
  reason text,
  execute_at timestamptz not null,
  status text not null default 'pending',
  created_by_id text not null,
  created_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moderation_scheduled_actions_action_check
    check (action_type in ('unban','remove_role')),
  constraint moderation_scheduled_actions_status_check
    check (status in ('pending','executing','executed','failed','cancelled'))
);

create index if not exists idx_moderation_scheduled_due
  on public.moderation_scheduled_actions (status, execute_at)
  where status = 'pending';
create index if not exists idx_moderation_scheduled_guild
  on public.moderation_scheduled_actions (guild_id, created_at desc);

alter table public.moderation_scheduled_actions enable row level security;
revoke all on table public.moderation_scheduled_actions from anon;
revoke all on table public.moderation_scheduled_actions from authenticated;
grant select on table public.moderation_scheduled_actions to authenticated;
grant select, insert, update, delete on table public.moderation_scheduled_actions to service_role;

drop policy if exists "Guild admins can view scheduled moderation actions"
  on public.moderation_scheduled_actions;
create policy "Guild admins can view scheduled moderation actions"
on public.moderation_scheduled_actions
for select
to authenticated
using (
  exists (
    select 1 from public.user_guilds ug
    where ug.guild_id = moderation_scheduled_actions.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);

with new_commands(command_name, category) as (
  values
    ('purge','moderation'),
    ('massban','moderation'),
    ('case','moderation'),
    ('history','moderation'),
    ('reason','moderation'),
    ('note','moderation'),
    ('tempban','moderation'),
    ('role','moderation'),
    ('quarantine','moderation')
)
insert into public.guild_commands (
  guild_id, command_name, category, enabled,
  cooldown_seconds, allowed_role_ids, allowed_channel_ids
)
select
  g.id, c.command_name, c.category, true,
  0, '{}'::text[], '{}'::text[]
from public.guilds g
cross join new_commands c
on conflict (guild_id, command_name)
do update set category = excluded.category, updated_at = now();
