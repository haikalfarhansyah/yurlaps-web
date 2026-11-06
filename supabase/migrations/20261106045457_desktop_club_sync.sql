-- Additive desktop sync contract; existing account/membership data is unchanged.
-- Public RPCs are SECURITY INVOKER, explicitly check leader membership, and use RLS.
alter table public.club_tracks
  add column if not exists width_m double precision check (width_m > 0),
  add column if not exists loop_width_m double precision check (loop_width_m > 0),
  add column if not exists note text not null default '',
  add column if not exists best_ms integer check (best_ms > 0),
  add column if not exists holder text,
  add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists last_mutation_id uuid;

create table if not exists public.club_presets (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  target text not null default 'time' check (target in ('time', 'laps')),
  value integer not null default 180 check (value > 0),
  rank text not null default 'lapsTime' check (rank in ('lapsTime','best','top3','consecutive')),
  start_mode text not null default 'grid' check (start_mode in ('grid','staggered')),
  cd integer not null default 5 check (cd between 0 and 600),
  sound integer not null default 1 check (sound in (0,1)),
  created_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_mutation_id uuid
);
alter table public.club_presets enable row level security;
grant select, insert, update, delete on public.club_presets to authenticated;
revoke all on public.club_presets from anon;
create policy "club members read presets" on public.club_presets for select to authenticated
  using (public.is_club_member(club_id));
create policy "leaders insert presets" on public.club_presets for insert to authenticated
  with check (public.club_role(club_id) = 'leader');
create policy "leaders update presets" on public.club_presets for update to authenticated
  using (public.club_role(club_id) = 'leader') with check (public.club_role(club_id) = 'leader');

create index if not exists club_presets_club_id_idx on public.club_presets(club_id);
create index if not exists club_presets_created_by_idx on public.club_presets(created_by);

create or replace function public.desktop_entity_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.club_id <> old.club_id then
    raise exception 'Cannot move a synchronized entity to another club' using errcode = '42501';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := now();
  if new.last_mutation_id is not distinct from old.last_mutation_id then
    new.last_mutation_id := null;
  end if;
  return new;
end;
$$;
revoke all on function public.desktop_entity_revision() from public, anon, authenticated;
create trigger desktop_track_revision before update on public.club_tracks
  for each row execute function public.desktop_entity_revision();
create trigger desktop_preset_revision before update on public.club_presets
  for each row execute function public.desktop_entity_revision();

create or replace function public.desktop_sync_entity(
  p_kind text, p_club_id uuid, p_id uuid, p_base_revision bigint,
  p_mutation_id uuid, p_data jsonb, p_deleted boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row jsonb;
begin
  if auth.uid() is null or public.club_role(p_club_id) is distinct from 'leader' then
    raise exception 'Active leader required' using errcode = '42501';
  end if;
  if p_kind not in ('track','preset') or p_kind is null or p_mutation_id is null
     or p_id is null or p_base_revision is null or p_base_revision < 0
     or p_data is null or jsonb_typeof(p_data) <> 'object'
     or coalesce(length(btrim(p_data->>'name')),0) not between 1 and 200 then
    raise exception 'Invalid sync payload' using errcode = '22023';
  end if;
  -- Serializes inserts too, where SELECT FOR UPDATE would have no row to lock.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  if p_kind = 'track' then
    select to_jsonb(t) into current_row from public.club_tracks t where id=p_id for update;
    if current_row is not null and (current_row->>'club_id')::uuid <> p_club_id then
      raise exception 'Club mismatch' using errcode = '42501';
    end if;
    if current_row is not null and (current_row->>'last_mutation_id')::uuid = p_mutation_id then
      return jsonb_build_object('record',current_row);
    end if;
    if current_row is not null and p_base_revision = 0 and not p_deleted
       and current_row->>'deleted_at' is null and current_row @> p_data then
      return jsonb_build_object('record',current_row);
    end if;
    if (current_row is null and p_base_revision <> 0) or
       (current_row is not null and (current_row->>'revision')::bigint <> p_base_revision) then
      return jsonb_build_object('conflict',true,'current',current_row);
    end if;
    if current_row is null then
      insert into public.club_tracks (id,club_id,created_by,last_mutation_id,deleted_at,name,address,width_m,loop_width_m,note,best_ms,holder)
      values (p_id,p_club_id,auth.uid(),p_mutation_id,case when p_deleted then now() end,btrim(p_data->>'name'),coalesce(p_data->>'address',''),(p_data->>'width_m')::double precision,(p_data->>'loop_width_m')::double precision,coalesce(p_data->>'note',''),(p_data->>'best_ms')::integer,p_data->>'holder')
      returning to_jsonb(club_tracks.*) into current_row;
    else
      update public.club_tracks set name=btrim(p_data->>'name'),address=coalesce(p_data->>'address',''),width_m=(p_data->>'width_m')::double precision,loop_width_m=(p_data->>'loop_width_m')::double precision,note=coalesce(p_data->>'note',''),best_ms=(p_data->>'best_ms')::integer,holder=p_data->>'holder',
        last_mutation_id=p_mutation_id, deleted_at=case when p_deleted then now() end
      where id=p_id returning to_jsonb(club_tracks.*) into current_row;
    end if;
  end if;
  if p_kind = 'preset' then
    select to_jsonb(t) into current_row from public.club_presets t where id=p_id for update;
    if current_row is not null and (current_row->>'club_id')::uuid <> p_club_id then
      raise exception 'Club mismatch' using errcode = '42501';
    end if;
    if current_row is not null and (current_row->>'last_mutation_id')::uuid = p_mutation_id then
      return jsonb_build_object('record',current_row);
    end if;
    if current_row is not null and p_base_revision = 0 and not p_deleted
       and current_row->>'deleted_at' is null and current_row @> p_data then
      return jsonb_build_object('record',current_row);
    end if;
    if (current_row is null and p_base_revision <> 0) or
       (current_row is not null and (current_row->>'revision')::bigint <> p_base_revision) then
      return jsonb_build_object('conflict',true,'current',current_row);
    end if;
    if current_row is null then
      insert into public.club_presets (id,club_id,created_by,last_mutation_id,deleted_at,name,target,value,rank,start_mode,cd,sound)
      values (p_id,p_club_id,auth.uid(),p_mutation_id,case when p_deleted then now() end,btrim(p_data->>'name'),p_data->>'target',(p_data->>'value')::integer,p_data->>'rank',p_data->>'start_mode',(p_data->>'cd')::integer,(p_data->>'sound')::integer)
      returning to_jsonb(club_presets.*) into current_row;
    else
      update public.club_presets set name=btrim(p_data->>'name'),target=p_data->>'target',value=(p_data->>'value')::integer,rank=p_data->>'rank',start_mode=p_data->>'start_mode',cd=(p_data->>'cd')::integer,sound=(p_data->>'sound')::integer,
        last_mutation_id=p_mutation_id, deleted_at=case when p_deleted then now() end
      where id=p_id returning to_jsonb(club_presets.*) into current_row;
    end if;
  end if;
  return jsonb_build_object('record',current_row);
end;
$$;
revoke all on function public.desktop_sync_entity(text,uuid,uuid,bigint,uuid,jsonb,boolean) from public, anon;
grant execute on function public.desktop_sync_entity(text,uuid,uuid,bigint,uuid,jsonb,boolean) to authenticated;

alter table public.races add column if not exists source_race_id text,
  add column if not exists session_data jsonb not null default '{}'::jsonb;

create or replace function public.desktop_upload_race(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cid uuid := (p_payload->>'club_id')::uuid;
  rid uuid := (p_payload->>'id')::uuid;
  saved public.races;
begin
  if auth.uid() is null or public.club_role(cid) is distinct from 'leader' then
    raise exception 'Active leader required' using errcode = '42501';
  end if;
  if rid is null or coalesce(length(btrim(p_payload->>'name')),0) not between 1 and 300
     or p_payload->>'source_race_id' is null
     or p_payload->>'raced_at' is null
     or jsonb_typeof(p_payload->'results') is distinct from 'array'
     or octet_length(p_payload::text) > 10000000 then
    raise exception 'Invalid race payload' using errcode = '22023';
  end if;
  insert into public.races (id,club_id,name,track_name,location,raced_at,results,created_by,source_race_id,session_data)
  values (rid,cid,p_payload->>'name',coalesce(p_payload->>'track_name',''),coalesce(p_payload->>'location',''),
    (p_payload->>'raced_at')::timestamptz,p_payload->'results',auth.uid(),p_payload->>'source_race_id',
    coalesce(p_payload->'session_data','{}'::jsonb)) on conflict (id) do nothing;
  select * into saved from public.races where id=rid and club_id=cid;
  if saved.id is null or saved.source_race_id is distinct from p_payload->>'source_race_id'
      or saved.results is distinct from p_payload->'results' then
    raise exception 'Race ID already exists with different content' using errcode = '23505';
  end if;
  return jsonb_build_object('id',saved.id,'club_id',saved.club_id);
end;
$$;
revoke all on function public.desktop_upload_race(jsonb) from public, anon;
grant execute on function public.desktop_upload_race(jsonb) to authenticated;
