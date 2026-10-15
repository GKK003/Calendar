-- Cinema library metadata and the private Supabase Storage fallback.
-- R2 uploads use the separate authenticated Edge Function in functions/r2.
-- Run after schema.sql. Safe to re-run.

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  type text not null default 'Movies',
  genres text[] not null default '{}',
  year integer,
  description text,
  path text not null,
  poster_path text,
  size bigint,
  store text not null default 'supabase' check (store in ('r2', 'supabase')),
  created_at timestamptz not null default now()
);
create index if not exists movies_space_created on public.movies (space_id, created_at desc);

alter table public.movies enable row level security;
drop policy if exists "movies read members" on public.movies;
create policy "movies read members" on public.movies for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "movies insert self" on public.movies;
create policy "movies insert self" on public.movies for insert to authenticated
  with check (
    space_id = public.my_space()
    and user_id = auth.uid()
    and path like (space_id::text || '/' || auth.uid()::text || '/%')
    and (poster_path is null or poster_path like (space_id::text || '/' || auth.uid()::text || '/%'))
  );
-- The Cinema UI offers shared deletion, so any member can remove a library entry.
drop policy if exists "movies delete members" on public.movies;
create policy "movies delete members" on public.movies for delete to authenticated
  using (space_id = public.my_space());

insert into storage.buckets (id, name, public)
values ('movies', 'movies', false)
on conflict (id) do update set public = false;

drop policy if exists "movie files read space" on storage.objects;
create policy "movie files read space" on storage.objects for select to authenticated
  using (bucket_id = 'movies' and (storage.foldername(name))[1] = public.my_space()::text);
drop policy if exists "movie files insert self" on storage.objects;
create policy "movie files insert self" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'movies'
    and (storage.foldername(name))[1] = public.my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "movie files delete space" on storage.objects;
create policy "movie files delete space" on storage.objects for delete to authenticated
  using (bucket_id = 'movies' and (storage.foldername(name))[1] = public.my_space()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'movies') then
    alter publication supabase_realtime add table public.movies;
  end if;
end $$;
