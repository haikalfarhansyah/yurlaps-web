-- Jadwal sesi Event: urutan, jam mulai, dan peserta per grup.
-- Jadwal dihitung di aplikasi YurLaps (app/schedule.py) lalu ikut di dalam
-- dokumen Event, jadi website hanya menampilkan hasil yang sama.
--
-- Aturan privasi mengikuti pola yang sudah dipakai Event: nama pembalap hanya
-- tampil untuk peserta yang disetujui, dan untuk tamu club publik peserta
-- harus sudah check-in.

create or replace function public.list_visible_club_events(p_club_id uuid)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select (e.document - 'entries' - 'published_standings' - 'schedule')
    || jsonb_build_object(
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', person->>'id', 'class_id', person->>'class_id',
          'name', person->>'name', 'nick', person->>'nick',
          'car_class', person->>'car_class', 'car_brand', person->>'car_brand',
          'approved', person->'approved', 'checked_in', person->'checked_in'
        )) from jsonb_array_elements(e.document->'entries') person
        where person->>'approved' = 'true'
      ), '[]'::jsonb),
      'published_standings', coalesce((
        select jsonb_agg((grp - 'drivers') || jsonb_build_object('drivers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'position', pilot->'position', 'name', pilot->>'name',
            'nick', pilot->>'nick', 'points', pilot->'points'
          )) from jsonb_array_elements(grp->'drivers') pilot
        ), '[]'::jsonb)))
        from jsonb_array_elements(coalesce(e.document->'published_standings', '[]'::jsonb)) grp
      ), '[]'::jsonb),
      'schedule', coalesce((
        select jsonb_agg(jsonb_build_object(
          'stage_id', row->>'stage_id',
          'class_id', row->>'class_id',
          'class_name', row->>'class_name',
          'group', row->>'group',
          'kind', row->>'kind',
          'name', row->>'name',
          'status', row->>'status',
          'start_ms', row->'start_ms',
          'duration_ms', row->'duration_ms',
          'gap_ms', row->'gap_ms',
          'seed_source', row->>'seed_source',
          'drivers', coalesce((
            select jsonb_agg(jsonb_build_object(
              'entry_id', driver->>'entry_id',
              'name', driver->>'name',
              'nick', driver->>'nick'
            )) from jsonb_array_elements(coalesce(row->'drivers', '[]'::jsonb)) driver
            where exists (
              select 1
              from jsonb_array_elements(coalesce(e.document->'entries', '[]'::jsonb)) person
              where person->>'id' = driver->>'entry_id'
                and person->>'approved' = 'true'
                and (public.is_club_member(e.club_id) or person->>'checked_in' = 'true')
            )
          ), '[]'::jsonb)
        )) from jsonb_array_elements(coalesce(e.document->'schedule', '[]'::jsonb)) row
      ), '[]'::jsonb)
    )
  from public.club_events e
  where e.club_id = p_club_id
    and (public.is_club_member(p_club_id) or exists (
      select 1 from public.clubs c where c.id = p_club_id and c.visibility = 'public'))
    and (e.document->>'status' <> 'draft' or public.is_club_member(p_club_id))
  order by e.updated_at desc;
$$;

revoke all on function public.list_visible_club_events(uuid) from public;
grant execute on function public.list_visible_club_events(uuid) to anon, authenticated;

-- save_club_event: jadwal opsional, tapi kalau ada harus berupa array.
create or replace function public.save_club_event(
  p_club_id uuid, p_event_id uuid, p_base_revision bigint, p_document jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing public.club_events;
  saved public.club_events;
begin
  if auth.uid() is null or public.club_role(p_club_id) is distinct from 'leader' then
    raise exception 'Active club leader required' using errcode = '42501';
  end if;
  if p_event_id is null or p_base_revision is null or p_base_revision < 0
     or p_document is null or jsonb_typeof(p_document) <> 'object'
     or p_document->>'id' is distinct from p_event_id::text
     or p_document->>'club_id' is distinct from p_club_id::text
     or coalesce(length(btrim(p_document->>'name')), 0) not between 1 and 100
     or p_document->>'status' not in ('draft','registration','running','completed')
     or jsonb_typeof(p_document->'classes') is distinct from 'array'
     or jsonb_typeof(p_document->'entries') is distinct from 'array'
     or jsonb_typeof(p_document->'stages') is distinct from 'array'
     or (p_document ? 'schedule' and jsonb_typeof(p_document->'schedule') is distinct from 'array')
     or (p_document ? 'plans' and jsonb_typeof(p_document->'plans') is distinct from 'array') then
    raise exception 'Invalid event document' using errcode = '22023';
  end if;
  if p_document->>'status' in ('running','completed') and not exists (
    select 1 from jsonb_array_elements(p_document->'entries') e
    where e->>'approved' = 'true' and e->>'checked_in' = 'true'
  ) then
    raise exception 'At least one approved checked-in driver is required' using errcode = '22023';
  end if;
  if p_document->>'status' = 'completed' and (
    not exists (select 1 from jsonb_array_elements(p_document->'stages') s where s->>'status' = 'saved')
    or exists (select 1 from jsonb_array_elements(p_document->'stages') s where s->>'status' = 'live')
  ) then
    raise exception 'Complete and save sessions before closing Event' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select * into existing from public.club_events where id = p_event_id for update;
  if found and existing.club_id <> p_club_id then
    raise exception 'Event belongs to another club' using errcode = '42501';
  end if;
  if (existing.id is null and p_base_revision <> 0)
     or (existing.id is not null and existing.revision <> p_base_revision) then
    return jsonb_build_object('conflict', true, 'current', to_jsonb(existing));
  end if;
  if existing.id is null then
    insert into public.club_events(id, club_id, document, created_by)
      values (p_event_id, p_club_id, p_document, auth.uid()) returning * into saved;
  else
    update public.club_events set document = p_document, revision = revision + 1,
      updated_at = now() where id = p_event_id returning * into saved;
  end if;
  return jsonb_build_object('record', to_jsonb(saved));
end;
$$;

revoke all on function public.save_club_event(uuid,uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_club_event(uuid,uuid,bigint,jsonb) to authenticated;
