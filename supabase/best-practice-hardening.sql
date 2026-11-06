-- Run after schema.sql, social.sql, chat.sql, three-people.sql, and games.sql.
-- This migration is safe to re-run. Constraints are added NOT VALID so existing
-- rows are preserved; they still validate new or updated rows immediately.

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_profile_limits') then
    alter table public.members add constraint members_profile_limits
      check (
        char_length(btrim(display_name)) between 1 and 30
        and color ~ '^#[0-9a-fA-F]{6}$'
        and (about is null or char_length(about) <= 60)
        and city in ('tbilisi', 'nyc')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_content_limits') then
    alter table public.events add constraint events_content_limits
      check (
        char_length(btrim(title)) between 1 and 120
        and (note is null or char_length(note) <= 2000)
        and (place is null or char_length(place) <= 500)
        and tz in ('Asia/Tbilisi', 'America/New_York')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.posts'::regclass and conname = 'posts_content_limits') then
    alter table public.posts add constraint posts_content_limits
      check (
        (body is null or char_length(body) <= 1000)
        and (checkin is null or char_length(checkin) <= 120)
        and (place is null or char_length(place) <= 120)
        and cardinality(photos) <= 4
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.post_replies'::regclass and conname = 'post_replies_body_limit') then
    alter table public.post_replies add constraint post_replies_body_limit
      check (char_length(btrim(body)) between 1 and 500) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.messages'::regclass and conname = 'messages_content_limits') then
    alter table public.messages add constraint messages_content_limits
      check (
        (body is null or char_length(body) <= 4000)
        and cardinality(media) <= 6
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.message_reactions'::regclass and conname = 'message_reactions_emoji_limit') then
    alter table public.message_reactions add constraint message_reactions_emoji_limit
      check (char_length(emoji) between 1 and 16) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.chat_settings'::regclass and conname = 'chat_settings_limits') then
    alter table public.chat_settings add constraint chat_settings_limits
      check (
        (color is null or color ~ '^#[0-9a-fA-F]{6}$')
        and (quick_emoji is null or char_length(quick_emoji) <= 16)
        and jsonb_typeof(nicknames) = 'object'
        and octet_length(nicknames::text) <= 4096
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.shared_games'::regclass and conname = 'shared_games_state_size_limit') then
    alter table public.shared_games add constraint shared_games_state_size_limit
      check (pg_column_size(state) <= 65536) not valid;
  end if;
end $$;

-- Enforce upload size and MIME limits at storage, in addition to browser checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 12 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 25 * 1024 * 1024,
  array['image/jpeg', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/3gpp', 'audio/wav', 'application/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Use a revision check so two devices cannot silently overwrite each other's
-- shared-game board. The client gets a conflict error and reloads the latest row.
alter table public.shared_games
  add column if not exists revision bigint not null default 0;

create or replace function public.save_shared_game_state(
  p_game_id uuid,
  p_expected_revision bigint,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  saved public.shared_games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'Game state must be an object' using errcode = '22023';
  end if;

  update public.shared_games
     set state = p_state,
         updated_by = auth.uid(),
         updated_at = clock_timestamp(),
         revision = revision + 1
   where id = p_game_id
     and space_id = public.my_space()
     and revision = p_expected_revision
   returning * into saved;

  if not found then
    if exists (select 1 from public.shared_games where id = p_game_id and space_id = public.my_space()) then
      raise exception 'The board changed on another device. Reload the latest board and try again.' using errcode = '40001';
    end if;
    raise exception 'Shared board not found' using errcode = 'P0002';
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.save_shared_game_state(uuid, bigint, jsonb) from public;
grant execute on function public.save_shared_game_state(uuid, bigint, jsonb) to authenticated;

-- Require the compare-and-save function for authenticated updates.
drop policy if exists "shared games members can update" on public.shared_games;
revoke update on public.shared_games from authenticated;

notify pgrst, 'reload schema';
