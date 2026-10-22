-- Remove Maps and Pet Room data from an existing Supabase project.
-- This permanently deletes saved places, location history, alerts, and room state.

begin;

drop table if exists public.family_alerts;
drop table if exists public.location_history;
drop table if exists public.family_places;
drop table if exists public.shared_pet_rooms;

alter table public.members drop column if exists location_lat;
alter table public.members drop column if exists location_lng;
alter table public.members drop column if exists location_accuracy;
alter table public.members drop column if exists location_updated_at;
alter table public.members drop column if exists location_sharing;

commit;
