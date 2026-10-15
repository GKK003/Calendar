-- Private chat: messages, reactions, read marks, nicknames/colour, photos and voice.
-- Run this whole file once in Supabase -> SQL Editor -> New query -> Run
-- (safe to run more than once)

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'voice', 'call')),
  body text,
  media text[] not null default '{}',
  meta jsonb,
  reply_to uuid references messages on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_space_created on messages (space_id, created_at desc);

create table if not exists message_reactions (
  message_id uuid not null references messages on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  space_id uuid not null references spaces on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists chat_reads (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  space_id uuid not null references spaces on delete cascade,
  read_at timestamptz not null
);

create table if not exists chat_settings (
  space_id uuid primary key references spaces on delete cascade,
  color text,
  quick_emoji text,
  nicknames jsonb not null default '{}'
);

alter table messages enable row level security;
alter table message_reactions enable row level security;
alter table chat_reads enable row level security;
alter table chat_settings enable row level security;

drop policy if exists "msg read" on messages;
create policy "msg read" on messages for select using (space_id = my_space());
drop policy if exists "msg insert" on messages;
create policy "msg insert" on messages for insert
  with check (space_id = my_space() and user_id = auth.uid());
drop policy if exists "msg update own" on messages;
create policy "msg update own" on messages for update using (user_id = auth.uid());

drop policy if exists "react read" on message_reactions;
create policy "react read" on message_reactions for select using (space_id = my_space());
drop policy if exists "react insert" on message_reactions;
create policy "react insert" on message_reactions for insert
  with check (space_id = my_space() and user_id = auth.uid());
drop policy if exists "react update" on message_reactions;
create policy "react update" on message_reactions for update using (user_id = auth.uid());
drop policy if exists "react delete" on message_reactions;
create policy "react delete" on message_reactions for delete using (user_id = auth.uid());

drop policy if exists "reads read" on chat_reads;
create policy "reads read" on chat_reads for select using (space_id = my_space());
drop policy if exists "reads insert" on chat_reads;
create policy "reads insert" on chat_reads for insert
  with check (space_id = my_space() and user_id = auth.uid());
drop policy if exists "reads update" on chat_reads;
create policy "reads update" on chat_reads for update using (user_id = auth.uid());

drop policy if exists "chat settings read" on chat_settings;
create policy "chat settings read" on chat_settings for select using (space_id = my_space());
drop policy if exists "chat settings insert" on chat_settings;
create policy "chat settings insert" on chat_settings for insert with check (space_id = my_space());
drop policy if exists "chat settings update" on chat_settings;
create policy "chat settings update" on chat_settings for update using (space_id = my_space());

-- Private storage for chat photos and voice messages: <space id>/<user id>/<file>
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

drop policy if exists "chat media read" on storage.objects;
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = my_space()::text);
drop policy if exists "chat media insert" on storage.objects;
create policy "chat media insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = my_space()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "chat media delete" on storage.objects;
create policy "chat media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = my_space()::text
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
