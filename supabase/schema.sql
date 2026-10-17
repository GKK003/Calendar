-- Core calendar schema and safe upgrades for the current app.
-- Run in Supabase -> SQL Editor. Safe to re-run.

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  created_at timestamptz not null default now()
);

-- New invite codes have 64 bits of random data. Existing codes remain valid.
alter table public.spaces
  alter column code set default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  display_name text not null,
  color text not null default '#2f95ff',
  about text,
  city text not null default 'tbilisi',
  avatar_url text
);

alter table public.members add column if not exists about text;
alter table public.members add column if not exists city text not null default 'tbilisi';
alter table public.members add column if not exists avatar_url text;
alter table public.members add column if not exists location_lat double precision;
alter table public.members add column if not exists location_lng double precision;
alter table public.members add column if not exists location_accuracy double precision;
alter table public.members add column if not exists location_updated_at timestamptz;
alter table public.members add column if not exists location_sharing boolean not null default false;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  type text not null default 'personal',
  note text,
  place text,
  tz text not null default 'Asia/Tbilisi',
  series_id uuid,
  created_at timestamptz not null default now()
);

-- Add fields used by the current event editor to databases created by older versions.
alter table public.events add column if not exists place text;
alter table public.events add column if not exists tz text not null default 'Asia/Tbilisi';
alter table public.events add column if not exists series_id uuid;
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('work', 'study', 'important', 'personal', 'special'));
create index if not exists events_space_date on public.events (space_id, date);
create index if not exists events_series_id on public.events (series_id) where series_id is not null;

create or replace function public.prevent_event_identity_change() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.id is distinct from old.id
     or new.space_id is distinct from old.space_id
     or new.user_id is distinct from old.user_id
     or new.series_id is distinct from old.series_id then
    raise exception 'Event identity and ownership cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists events_identity_immutable on public.events;
create trigger events_identity_immutable
  before update on public.events
  for each row execute function public.prevent_event_identity_change();

create or replace function public.my_space() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select m.space_id from public.members as m where m.user_id = auth.uid() limit 1
$$;
revoke all on function public.my_space() from public;
grant execute on function public.my_space() to authenticated;

-- Shared map: saved places, opt-in location history, and circle alerts.
create table if not exists public.family_places (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 150 check (radius_m between 50 and 2000),
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists family_places_space on public.family_places (space_id);

create table if not exists public.location_history (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists location_history_space_time on public.location_history (space_id, recorded_at desc);

create table if not exists public.family_alerts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('check_in', 'sos', 'place_enter', 'place_exit')),
  place_id uuid references public.family_places on delete set null,
  message text not null check (length(btrim(message)) between 1 and 240),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);
create index if not exists family_alerts_space_time on public.family_alerts (space_id, created_at desc);

alter table public.family_places enable row level security;
alter table public.location_history enable row level security;
alter table public.family_alerts enable row level security;

drop policy if exists "family places read" on public.family_places;
create policy "family places read" on public.family_places for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "family places insert" on public.family_places;
create policy "family places insert" on public.family_places for insert to authenticated
  with check (space_id = public.my_space() and created_by = auth.uid());
drop policy if exists "family places update" on public.family_places;
create policy "family places update" on public.family_places for update to authenticated
  using (space_id = public.my_space()) with check (space_id = public.my_space());
drop policy if exists "family places delete" on public.family_places;
create policy "family places delete" on public.family_places for delete to authenticated
  using (space_id = public.my_space());

drop policy if exists "location history read" on public.location_history;
create policy "location history read" on public.location_history for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "location history insert self" on public.location_history;
create policy "location history insert self" on public.location_history for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "location history delete self" on public.location_history;
create policy "location history delete self" on public.location_history for delete to authenticated
  using (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "family alerts read" on public.family_alerts;
create policy "family alerts read" on public.family_alerts for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "family alerts insert self" on public.family_alerts;
create policy "family alerts insert self" on public.family_alerts for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());

-- Calendar membership is assigned only through create_space/join_space.
-- A member can edit their profile, but cannot move their row into another space.
create or replace function public.prevent_member_identity_change() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.user_id is distinct from old.user_id or new.space_id is distinct from old.space_id then
    raise exception 'Calendar membership cannot be changed directly' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists members_identity_immutable on public.members;
create trigger members_identity_immutable
  before update on public.members
  for each row execute function public.prevent_member_identity_change();

alter table public.spaces enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;

drop policy if exists "space read" on public.spaces;
create policy "space read" on public.spaces for select to authenticated
  using (id = public.my_space());

drop policy if exists "members read" on public.members;
create policy "members read" on public.members for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "members update self" on public.members;
create policy "members update self" on public.members for update to authenticated
  using (user_id = auth.uid() and space_id = public.my_space())
  with check (user_id = auth.uid() and space_id = public.my_space());

drop policy if exists "events read" on public.events;
create policy "events read" on public.events for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "events insert" on public.events;
create policy "events insert" on public.events for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "events update" on public.events;
create policy "events update" on public.events for update to authenticated
  using (space_id = public.my_space())
  with check (space_id = public.my_space());
drop policy if exists "events delete" on public.events;
create policy "events delete" on public.events for delete to authenticated
  using (space_id = public.my_space());

create or replace function public.create_space(space_name text, my_name text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare s uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(btrim(coalesce(space_name, ''))) not between 1 and 80 then
    raise exception 'Calendar name must be between 1 and 80 characters';
  end if;
  if length(btrim(coalesce(my_name, ''))) not between 1 and 30 then
    raise exception 'Name must be between 1 and 30 characters';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Already in a calendar';
  end if;
  insert into public.spaces (name) values (btrim(space_name)) returning id into s;
  insert into public.members (user_id, space_id, display_name, color)
    values (auth.uid(), s, btrim(my_name), '#2f95ff');
end $$;

create or replace function public.join_space(join_code text, my_name text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare s uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(btrim(coalesce(my_name, ''))) not between 1 and 30 then
    raise exception 'Name must be between 1 and 30 characters';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Already in a calendar';
  end if;

  -- Lock the space so simultaneous joins cannot pass the capacity check together.
  select sp.id into s from public.spaces as sp
    where sp.code = lower(btrim(coalesce(join_code, '')))
    for update;
  if s is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from public.members where space_id = s) >= 6 then
    raise exception 'This calendar is full (6 people)';
  end if;
  insert into public.members (user_id, space_id, display_name, color)
    values (auth.uid(), s, btrim(my_name), '#ff8a5c');
end $$;

revoke all on function public.create_space(text, text) from public;
revoke all on function public.join_space(text, text) from public;
grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.join_space(text, text) to authenticated;

-- Add tables to Realtime only once.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members') then
    alter publication supabase_realtime add table public.members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_places') then
    alter publication supabase_realtime add table public.family_places;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'location_history') then
    alter publication supabase_realtime add table public.location_history;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_alerts') then
    alter publication supabase_realtime add table public.family_alerts;
  end if;
end $$;
