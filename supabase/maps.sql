-- Upgrade an existing calendar to the shared Maps page. Safe to re-run.
alter table public.members add column if not exists location_lat double precision;
alter table public.members add column if not exists location_lng double precision;
alter table public.members add column if not exists location_accuracy double precision;
alter table public.members add column if not exists location_updated_at timestamptz;
alter table public.members add column if not exists location_sharing boolean not null default false;

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

do $$
begin
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
