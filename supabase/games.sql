-- Shared Wordle and Sudoku boards. Run once in Supabase SQL Editor.
create table if not exists public.shared_games (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  game_type text not null check (game_type in ('wordle', 'sudoku')),
  state jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, game_type)
);

create index if not exists shared_games_space_idx on public.shared_games(space_id);
alter table public.shared_games enable row level security;

drop policy if exists "shared games members can read" on public.shared_games;
create policy "shared games members can read" on public.shared_games
  for select to authenticated using (space_id = public.my_space());

drop policy if exists "shared games members can create" on public.shared_games;
create policy "shared games members can create" on public.shared_games
  for insert to authenticated with check (space_id = public.my_space());

drop policy if exists "shared games members can update" on public.shared_games;
create policy "shared games members can update" on public.shared_games
  for update to authenticated using (space_id = public.my_space())
  with check (space_id = public.my_space());

-- Add the table only once; safe to rerun.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_games'
  ) then
    alter publication supabase_realtime add table public.shared_games;
  end if;
end $$;
