-- More than two people + Messenger-style chats (one group chat and a private chat with each person).
-- Run this whole file once in Supabase -> SQL Editor -> New query -> Run.
-- It is safe to run more than once. Run it BEFORE the third person joins.
--
-- What it does:
--  * messages get a "to_user" column: empty = the group chat, filled = a private chat with that person
--  * everything you two wrote so far becomes your PRIVATE chat (the third person will not see it)
--  * only the two people in a private chat can read it (messages, reactions, photos, voice notes)
--  * "seen" marks are kept per chat
--  * up to 6 people can join with the invite code, each gets a free avatar colour

do $$
declare
  palette text[] := array['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1'];
  r record;
  pick text;
begin
  -- first run only: add the columns and move the old chat into the private chat of the two people
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'to_user'
  ) then
    alter table public.messages add column to_user uuid references auth.users on delete cascade;

    update public.messages m
       set to_user = (select o.user_id from public.members o
                      where o.space_id = m.space_id and o.user_id <> m.user_id limit 1)
     where m.to_user is null
       and (select count(*) from public.members c where c.space_id = m.space_id) = 2;

    alter table public.chat_reads add column chat_key text not null default 'group';

    update public.chat_reads cr
       set chat_key = coalesce((select o.user_id::text from public.members o
                                where o.space_id = cr.space_id and o.user_id <> cr.user_id limit 1), 'group')
     where (select count(*) from public.members c where c.space_id = cr.space_id) = 2;

    alter table public.chat_reads drop constraint if exists chat_reads_pkey;
    alter table public.chat_reads add primary key (user_id, chat_key);
  end if;

  -- every person gets a real, different avatar colour (same order as before for the first two)
  for r in
    select user_id, space_id from public.members
    where color <> all (palette)
    order by space_id, user_id
  loop
    select p into pick from unnest(palette) as t(p)
    where p not in (select color from public.members where space_id = r.space_id)
    limit 1;
    if pick is not null then
      update public.members set color = pick where user_id = r.user_id;
    end if;
  end loop;
end $$;

create index if not exists messages_to_user on public.messages (space_id, to_user, created_at desc);
create index if not exists messages_media_gin on public.messages using gin (media);

-- ---------- who can see what ----------
drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select
  using (
    space_id = my_space()
    and (to_user is null or to_user = auth.uid() or user_id = auth.uid())
  );

drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert
  with check (
    space_id = my_space()
    and user_id = auth.uid()
    and (
      to_user is null
      or (
        to_user <> auth.uid()
        and exists (select 1 from public.members m where m.user_id = to_user and m.space_id = my_space())
      )
    )
  );

drop policy if exists "msg update own" on public.messages;
create policy "msg update own" on public.messages for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and space_id = my_space());

-- reactions follow the message: if you cannot see the message you cannot see its reactions
drop policy if exists "react read" on public.message_reactions;
create policy "react read" on public.message_reactions for select
  using (
    space_id = my_space()
    and exists (select 1 from public.messages m where m.id = message_id)
  );

drop policy if exists "react insert" on public.message_reactions;
create policy "react insert" on public.message_reactions for insert
  with check (
    space_id = my_space()
    and user_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id)
  );

-- "seen" marks: you see your own, the group one, and the ones people set in the private chat with you
drop policy if exists "reads read" on public.chat_reads;
create policy "reads read" on public.chat_reads for select
  using (
    space_id = my_space()
    and (user_id = auth.uid() or chat_key = 'group' or chat_key = auth.uid()::text)
  );

drop policy if exists "reads insert" on public.chat_reads;
create policy "reads insert" on public.chat_reads for insert
  with check (space_id = my_space() and user_id = auth.uid());

drop policy if exists "reads update" on public.chat_reads;
create policy "reads update" on public.chat_reads for update using (user_id = auth.uid());

-- photos and voice notes: the sender, or anyone who can see a message that contains the file
drop policy if exists "chat media read" on storage.objects;
create policy "chat media read" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = my_space()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (select 1 from public.messages m where m.media @> array[name])
    )
  );

-- ---------- joining: up to 6 people ----------
create or replace function join_space(join_code text, my_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s uuid;
  col text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Already in a calendar'; end if;
  select id into s from spaces where code = lower(trim(join_code));
  if s is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from members where space_id = s) >= 6 then raise exception 'This calendar is full (6 people)'; end if;
  select p into col
    from unnest(array['#f6a9c4', '#a9ddc2', '#cdb8f5', '#ffc9a3', '#a8d4f5', '#f7e3a1']) as t(p)
    where p not in (select color from members where space_id = s)
    limit 1;
  insert into members (user_id, space_id, display_name, color)
  values (auth.uid(), s, my_name, coalesce(col, '#ff8a5c'));
end $$;

grant execute on function join_space(text, text) to authenticated;

-- people joining or renaming show up straight away on the other phones
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table public.members;
  end if;
end $$;
