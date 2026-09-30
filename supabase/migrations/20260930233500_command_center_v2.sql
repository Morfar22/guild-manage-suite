-- Command Center V2
-- Adds per-command cooldown and role/channel restrictions.
-- Also removes the legacy anonymous read policy from guild_commands.

alter table public.guild_commands
  add column if not exists cooldown_seconds integer not null default 0,
  add column if not exists allowed_role_ids text[] not null default '{}'::text[],
  add column if not exists allowed_channel_ids text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.guild_commands'::regclass
      and conname = 'guild_commands_cooldown_nonnegative'
  ) then
    alter table public.guild_commands
      add constraint guild_commands_cooldown_nonnegative
      check (cooldown_seconds >= 0 and cooldown_seconds <= 86400);
  end if;
end $$;

alter table public.guild_commands enable row level security;

drop policy if exists "Allow anon select guild_commands" on public.guild_commands;
drop policy if exists "Users can manage their guild commands" on public.guild_commands;
drop policy if exists "Users can view their guild commands" on public.guild_commands;

revoke all on table public.guild_commands from anon;
revoke all on table public.guild_commands from authenticated;

grant select, insert, update, delete on table public.guild_commands to authenticated;
grant select, insert, update, delete on table public.guild_commands to service_role;

create policy "Guild admins can view command settings"
on public.guild_commands
for select
to authenticated
using (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = guild_commands.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);

create policy "Guild admins can insert command settings"
on public.guild_commands
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = guild_commands.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);

create policy "Guild admins can update command settings"
on public.guild_commands
for update
to authenticated
using (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = guild_commands.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
)
with check (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = guild_commands.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);

create policy "Guild admins can delete command settings"
on public.guild_commands
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_guilds ug
    where ug.guild_id = guild_commands.guild_id
      and ug.user_id = (select auth.uid())
      and ug.has_admin_permission = true
  )
);
