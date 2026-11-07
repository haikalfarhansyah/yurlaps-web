-- Public club pages can show race results and race-only track records.
-- Personal dashboards remain protected by their existing RLS policies.

grant select (id, name, description, address, avatar_url, visibility, created_at)
  on public.clubs to anon;
grant select on public.club_tracks, public.races to anon;

drop policy if exists "public tracks for public clubs" on public.club_tracks;
create policy "public tracks for public clubs"
  on public.club_tracks for select
  to anon, authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.clubs as club
      where club.id = club_tracks.club_id
        and club.visibility = 'public'
    )
  );

drop policy if exists "public races for public clubs" on public.races;
create policy "public races for public clubs"
  on public.races for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.clubs as club
      where club.id = races.club_id
        and club.visibility = 'public'
    )
  );
