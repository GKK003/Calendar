-- Private chat: messages, reactions, read marks, nicknames/colour, photos and voice.
-- Run this whole file once in Supabase -> SQL Editor -> New query -> Run
-- (safe to run more than once)

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'voice', 'call')),
  body text,
  media text[] not null default '{}',
  meta jsonb,
  reply_to uuid references public.messages on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_space_created on public.messages (space_id, created_at desc);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.chat_reads (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  read_at timestamptz not null
);

create table if not exists public.chat_settings (
  space_id uuid primary key references public.spaces on delete cascade,
  color text,
  quick_emoji text,
  nicknames jsonb not null default '{}'
);

alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_settings enable row level security;

drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select to authenticated using (space_id = public.my_space());
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "msg update own" on public.messages;
create policy "msg update own" on public.messages for update to authenticated
  using (user_id = auth.uid() and space_id = public.my_space())
  with check (user_id = auth.uid() and space_id = public.my_space());

drop policy if exists "react read" on public.message_reactions;
create policy "react read" on public.message_reactions for select to authenticated using (space_id = public.my_space());
drop policy if exists "react insert" on public.message_reactions;
create policy "react insert" on public.message_reactions for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "react update" on public.message_reactions;
create policy "react update" on public.message_reactions for update to authenticated
  using (user_id = auth.uid() and space_id = public.my_space())
  with check (user_id = auth.uid() and space_id = public.my_space());
drop policy if exists "react delete" on public.message_reactions;
create policy "react delete" on public.message_reactions for delete to authenticated using (user_id = auth.uid() and space_id = public.my_space());

drop policy if exists "reads read" on public.chat_reads;
create policy "reads read" on public.chat_reads for select to authenticated using (space_id = public.my_space());
drop policy if exists "reads insert" on public.chat_reads;
create policy "reads insert" on public.chat_reads for insert to authenticated
  with check (space_id = public.my_space() and user_id = auth.uid());
drop policy if exists "reads update" on public.chat_reads;
create policy "reads update" on public.chat_reads for update to authenticated
  using (user_id = auth.uid() and space_id = public.my_space())
  with check (user_id = auth.uid() and space_id = public.my_space());

drop policy if exists "chat settings read" on public.chat_settings;
create policy "chat settings read" on public.chat_settings for select to authenticated using (space_id = public.my_space());
drop policy if exists "chat settings insert" on public.chat_settings;
create policy "chat settings insert" on public.chat_settings for insert to authenticated with check (space_id = public.my_space());
drop policy if exists "chat settings update" on public.chat_settings;
create policy "chat settings update" on public.chat_settings for update to authenticated
  using (space_id = public.my_space())
  with check (space_id = public.my_space());

-- Private storage for chat photos and voice messages: <space id>/<user id>/<file>
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set public = false;

drop policy if exists "chat media read" on storage.objects;
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = public.my_space()::text);
drop policy if exists "chat media insert" on storage.objects;
create policy "chat media insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = public.my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "chat media delete" on storage.objects;
create policy "chat media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = public.my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Realtime sync
do $$
declare t text;
begin
  foreach t in array array['messages', 'message_reactions', 'chat_reads', 'chat_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
