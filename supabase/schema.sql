-- Run this whole file once in Supabase -> SQL Editor -> New query -> Run

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null default substr(md5(random()::text), 1, 6),
  created_at timestamptz default now()
);

create table if not exists members (
  user_id uuid primary key references auth.users on delete cascade,
  space_id uuid not null references spaces on delete cascade,
  display_name text not null,
  color text not null default '#2f95ff'
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  type text not null default 'personal' check (type in ('work','study','important','personal')),
  note text,
  created_at timestamptz default now()
);
create index if not exists events_space_date on events (space_id, date);

create or replace function my_space() returns uuid
language sql stable security definer set search_path = public as $$
  select space_id from members where user_id = auth.uid()
$$;

alter table spaces enable row level security;
alter table members enable row level security;
alter table events enable row level security;

drop policy if exists "space read" on spaces;
create policy "space read" on spaces for select using (id = my_space());

drop policy if exists "members read" on members;
create policy "members read" on members for select using (space_id = my_space());
drop policy if exists "members update self" on members;
create policy "members update self" on members for update using (user_id = auth.uid());

drop policy if exists "events read" on events;
create policy "events read" on events for select using (space_id = my_space());
drop policy if exists "events insert" on events;
create policy "events insert" on events for insert with check (space_id = my_space());
drop policy if exists "events update" on events;
create policy "events update" on events for update using (space_id = my_space());
drop policy if exists "events delete" on events;
create policy "events delete" on events for delete using (space_id = my_space());

-- Create a shared calendar (first person)
create or replace function create_space(space_name text, my_name text) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Already in a calendar'; end if;
  insert into spaces (name) values (space_name) returning id into s;
  insert into members (user_id, space_id, display_name, color) values (auth.uid(), s, my_name, '#2f95ff');
end $$;

-- Join with the invite code (second person)
create or replace function join_space(join_code text, my_name text) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Already in a calendar'; end if;
  select id into s from spaces where code = lower(trim(join_code));
  if s is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from members where space_id = s) >= 2 then raise exception 'This calendar already has two people'; end if;
  insert into members (user_id, space_id, display_name, color) values (auth.uid(), s, my_name, '#ff8a5c');
end $$;

grant execute on function create_space(text, text) to authenticated;
grant execute on function join_space(text, text) to authenticated;

-- Realtime sync
alter publication supabase_realtime add table events;
