-- One active decoder track per club. Timing settings stay with the track.
alter table public.club_tracks
  add column if not exists min_lap_ms integer not null default 1500 check (min_lap_ms >= 100),
  add column if not exists is_active boolean not null default false;

create or replace function public.keep_one_active_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    update public.club_tracks set is_active = false
    where club_id = new.club_id and id <> new.id;
  elsif not exists (
    select 1 from public.club_tracks
    where club_id = new.club_id and id <> new.id and is_active and deleted_at is null
  ) and new.deleted_at is null then
    new.is_active := true;
  end if;
  return new;
end;
$$;
drop trigger if exists club_tracks_one_active on public.club_tracks;
create trigger club_tracks_one_active
before insert or update of is_active, club_id, deleted_at on public.club_tracks
for each row execute function public.keep_one_active_track();

create unique index if not exists club_tracks_one_active_idx
  on public.club_tracks(club_id) where is_active and deleted_at is null;
