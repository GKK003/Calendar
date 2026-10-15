-- Phone notifications (messages and ringing calls).
-- 1) Replace the TWO values marked CHANGE ME below.  2) Run in Supabase -> SQL Editor.
-- (safe to run more than once)

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  space_id uuid not null references spaces on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists "push read own" on push_subscriptions;
create policy "push read own" on push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push insert own" on push_subscriptions;
create policy "push insert own" on push_subscriptions for insert
  with check (user_id = auth.uid() and space_id = my_space());
drop policy if exists "push update own" on push_subscriptions;
create policy "push update own" on push_subscriptions for update using (user_id = auth.uid());
drop policy if exists "push delete own" on push_subscriptions;
create policy "push delete own" on push_subscriptions for delete using (user_id = auth.uid());

create extension if not exists pg_net;

create or replace function notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://CHANGE-ME-PROJECT-REF.supabase.co/functions/v1/notify',          -- CHANGE ME (1)
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'CHANGE-ME-LONG-RANDOM-SECRET'                              -- CHANGE ME (2)
    ),
    body := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    timeout_milliseconds := 5000
  );
  return new;
end $$;

drop trigger if exists notify_message_insert on messages;
create trigger notify_message_insert after insert on messages
  for each row execute function notify_message();
