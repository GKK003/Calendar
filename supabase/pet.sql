-- Shared virtual pet and room. Run once in Supabase SQL Editor after schema.sql.
create table if not exists public.shared_pet_rooms (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null unique references public.spaces(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_pet_rooms_space_idx on public.shared_pet_rooms(space_id);
alter table public.shared_pet_rooms enable row level security;

drop policy if exists "shared pet room members can read" on public.shared_pet_rooms;
create policy "shared pet room members can read" on public.shared_pet_rooms
  for select to authenticated using (space_id = public.my_space());

drop policy if exists "shared pet room members can create" on public.shared_pet_rooms;
create policy "shared pet room members can create" on public.shared_pet_rooms
  for insert to authenticated with check (space_id = public.my_space());

drop policy if exists "shared pet room members can update" on public.shared_pet_rooms;
create policy "shared pet room members can update" on public.shared_pet_rooms
  for update to authenticated using (space_id = public.my_space())
  with check (space_id = public.my_space());

grant select, insert, update on public.shared_pet_rooms to authenticated;
revoke all on public.shared_pet_rooms from anon, public;

-- Add Realtime only once; if the publication is unavailable, the rest still applies.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_pet_rooms'
     ) then
    alter publication supabase_realtime add table public.shared_pet_rooms;
  end if;
end $$;
