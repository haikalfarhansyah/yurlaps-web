-- Shared Event documents. Race lap data remains in public.races.
create table if not exists public.club_events (
  id uuid primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists club_events_club_updated_idx on public.club_events(club_id, updated_at desc);
alter table public.club_events enable row level security;
grant select on public.club_events to authenticated;
revoke select on public.club_events from anon;
revoke insert, update, delete on public.club_events from anon, authenticated;

drop policy if exists "club events visible to members or public club" on public.club_events;
create policy "club events visible to members or public club" on public.club_events
  for select to authenticated using (public.club_role(club_id) = 'leader');

create or replace function public.list_visible_club_events(p_club_id uuid)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select (e.document - 'entries' - 'published_standings') || jsonb_build_object('entries', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', person->>'id', 'class_id', person->>'class_id',
      'name', person->>'name', 'nick', person->>'nick',
      'car_class', person->>'car_class', 'car_brand', person->>'car_brand',
      'approved', person->'approved', 'checked_in', person->'checked_in'
    )) from jsonb_array_elements(e.document->'entries') person
    where person->>'approved' = 'true'
  ), '[]'::jsonb), 'published_standings', coalesce((
    select jsonb_agg((grp - 'drivers') || jsonb_build_object('drivers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', pilot->'position', 'name', pilot->>'name',
        'nick', pilot->>'nick', 'points', pilot->'points'
      )) from jsonb_array_elements(grp->'drivers') pilot
    ), '[]'::jsonb)))
    from jsonb_array_elements(coalesce(e.document->'published_standings', '[]'::jsonb)) grp
  ), '[]'::jsonb))
  from public.club_events e
  where e.club_id = p_club_id
    and (public.is_club_member(p_club_id) or exists (
      select 1 from public.clubs c where c.id = p_club_id and c.visibility = 'public'))
    and (e.document->>'status' <> 'draft' or public.is_club_member(p_club_id))
  order by e.updated_at desc;
$$;

revoke all on function public.list_visible_club_events(uuid) from public;
grant execute on function public.list_visible_club_events(uuid) to anon, authenticated;

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
     or jsonb_typeof(p_document->'stages') is distinct from 'array' then
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

create or replace function public.apply_club_event(
  p_event_id uuid, p_class_id uuid, p_transponder text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_row public.club_events;
  device public.transponders;
  driver public.profiles;
  updated_doc jsonb;
  entry jsonb;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  select * into event_row from public.club_events where id = p_event_id for update;
  if event_row.id is null or event_row.document->>'status' <> 'registration' then
    raise exception 'Registration is closed' using errcode = '22023';
  end if;
  if not public.is_club_member(event_row.club_id) and not exists (
    select 1 from public.clubs c where c.id = event_row.club_id and c.visibility = 'public'
  ) then
    raise exception 'Event is not open to this account' using errcode = '42501';
  end if;
  if not exists (select 1 from jsonb_array_elements(event_row.document->'classes') c
      where c->>'id' = p_class_id::text) then
    raise exception 'Class not found' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(event_row.document->'entries') e
      where e->>'class_id' = p_class_id::text and
      (e->>'account_id' = auth.uid()::text or e->>'transponder' = p_transponder)) then
    raise exception 'One car per driver per class' using errcode = '23505';
  end if;
  select * into device from public.transponders
    where user_id = auth.uid() and transponder_id = p_transponder;
  if device.id is null then
    raise exception 'Transponder not registered to this account' using errcode = '42501';
  end if;
  select * into driver from public.profiles where id = auth.uid();
  entry := jsonb_build_object(
    'id', gen_random_uuid()::text, 'class_id', p_class_id::text,
    'member_id', auth.uid()::text, 'account_id', auth.uid()::text,
    'name', coalesce(nullif(driver.full_name, ''), nullif(driver.nickname, ''), 'Driver'),
    'nick', coalesce(driver.nickname, ''), 'tts_name', coalesce(driver.tts_name, ''),
    'transponder', p_transponder, 'car_class', coalesce(device.rc_class, ''),
    'car_brand', coalesce(device.rc_brand, ''), 'approved', false,
    'checked_in', false, 'source', case when public.is_club_member(event_row.club_id) then 'cloud' else 'guest' end
  );
  updated_doc := jsonb_set(event_row.document, '{entries}',
    (event_row.document->'entries') || jsonb_build_array(entry));
  updated_doc := jsonb_set(updated_doc, '{revision}', to_jsonb(coalesce((updated_doc->>'revision')::integer, 0) + 1));
  update public.club_events set document = updated_doc, revision = revision + 1,
    updated_at = now() where id = p_event_id;
  return entry;
end;
$$;

revoke all on function public.apply_club_event(uuid,uuid,text) from public, anon;
grant execute on function public.apply_club_event(uuid,uuid,text) to authenticated;
