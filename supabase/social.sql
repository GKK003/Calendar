-- Today's posts, replies, Gallery photos, and profile avatars.
-- Run after schema.sql. Safe to re-run.

alter table public.members add column if not exists about text;
alter table public.members add column if not exists city text not null default 'tbilisi';
alter table public.members add column if not exists avatar_url text;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'checkin')),
  checkin text,
  place text,
  body text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists posts_space_created on public.posts (space_id, created_at desc);

create table if not exists public.post_replies (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_replies_post_created on public.post_replies (post_id, created_at);

alter table public.posts enable row level security;
alter table public.post_replies enable row level security;

drop policy if exists "posts read members" on public.posts;
create policy "posts read members" on public.posts for select to authenticated
  using (space_id = public.my_space());
drop policy if exists "posts insert self" on public.posts;
create policy "posts insert self" on public.posts for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "posts delete self" on public.posts;
create policy "posts delete self" on public.posts for delete to authenticated
  using (space_id = public.my_space() and user_id = auth.uid());

drop policy if exists "post replies read members" on public.post_replies;
create policy "post replies read members" on public.post_replies for select to authenticated
  using (
    space_id = public.my_space()
    and exists (select 1 from public.posts p where p.id = post_id and p.space_id = public.my_space())
  );
drop policy if exists "post replies insert self" on public.post_replies;
create policy "post replies insert self" on public.post_replies for insert to authenticated
  with check (
    space_id = public.my_space()
    and user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and p.space_id = public.my_space())
  );
drop policy if exists "post replies delete self" on public.post_replies;
create policy "post replies delete self" on public.post_replies for delete to authenticated
  using (space_id = public.my_space() and user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "post photos read space" on storage.objects;
create policy "post photos read space" on storage.objects for select to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = public.my_space()::text);
drop policy if exists "post photos insert self" on storage.objects;
create policy "post photos insert self" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = public.my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "post photos delete self" on storage.objects;
create policy "post photos delete self" on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = public.my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- The app uses public avatar URLs but only lets each signed-in user write their own file.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatars insert self" on storage.objects;
create policy "avatars insert self" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars update self" on storage.objects;
create policy "avatars update self" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars delete self" on storage.objects;
create policy "avatars delete self" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_replies') then
    alter publication supabase_realtime add table public.post_replies;
  end if;
end $$;
