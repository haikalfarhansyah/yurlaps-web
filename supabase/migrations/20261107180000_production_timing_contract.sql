-- Additive production timing contract. Apply after the existing migrations.
-- Existing results and driver identities are retained; no table is replaced.
alter table public.club_presets
  add column if not exists random_delay_max integer not null default 1,
  add column if not exists target_time_ms integer,
  add column if not exists finish_current_lap boolean not null default false,
  add column if not exists stagger_mode text not null default 'manual',
  add column if not exists stagger_gap_ms integer not null default 10000;

update public.club_presets set target_time_ms=value*1000
where target='time' and target_time_ms is null;
alter table public.club_presets drop constraint if exists club_presets_rank_check;
alter table public.club_presets add constraint club_presets_rank_check
  check (rank in ('position','result','lapsTime','best','top3','consecutive'));
alter table public.club_presets drop constraint if exists club_presets_timing_check;
alter table public.club_presets add constraint club_presets_timing_check check (
  random_delay_max between 1 and 3
  and stagger_mode in ('manual','auto') and stagger_gap_ms between 1000 and 600000
  and (target <> 'time' or target_time_ms between 1000 and 86400000)
);

create or replace function public.keep_one_active_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null then new.is_active:=false; end if;
  -- A nested deactivation must not reactivate the previous track while the
  -- new active track is still inside its BEFORE trigger.
  if pg_trigger_depth()>1 then return new; end if;
  if new.is_active then
    update public.club_tracks set is_active=false
    where club_id=new.club_id and id<>new.id and is_active;
  elsif new.deleted_at is null and not exists (
    select 1 from public.club_tracks where club_id=new.club_id and id<>new.id
      and is_active and deleted_at is null
  ) then
    new.is_active:=true;
  end if;
  return new;
end;
$$;

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
      insert into public.club_tracks (id,club_id,created_by,last_mutation_id,deleted_at,name,address,width_m,loop_width_m,note,best_ms,holder,min_lap_ms,is_active)
      values (p_id,p_club_id,auth.uid(),p_mutation_id,case when p_deleted then now() end,btrim(p_data->>'name'),coalesce(p_data->>'address',''),(p_data->>'width_m')::double precision,(p_data->>'loop_width_m')::double precision,coalesce(p_data->>'note',''),(p_data->>'best_ms')::integer,p_data->>'holder',coalesce((p_data->>'min_lap_ms')::integer,1500),coalesce((p_data->>'is_active')::boolean,false))
      returning to_jsonb(club_tracks.*) into current_row;
    else
      update public.club_tracks set name=btrim(p_data->>'name'),address=coalesce(p_data->>'address',''),width_m=(p_data->>'width_m')::double precision,loop_width_m=(p_data->>'loop_width_m')::double precision,note=coalesce(p_data->>'note',''),best_ms=(p_data->>'best_ms')::integer,holder=p_data->>'holder',min_lap_ms=coalesce((p_data->>'min_lap_ms')::integer,1500),is_active=coalesce((p_data->>'is_active')::boolean,false),
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
      insert into public.club_presets (id,club_id,created_by,last_mutation_id,deleted_at,name,target,value,rank,start_mode,cd,sound,random_delay_max,target_time_ms,finish_current_lap,stagger_mode,stagger_gap_ms)
      values (p_id,p_club_id,auth.uid(),p_mutation_id,case when p_deleted then now() end,btrim(p_data->>'name'),p_data->>'target',(p_data->>'value')::integer,p_data->>'rank',p_data->>'start_mode',(p_data->>'cd')::integer,(p_data->>'sound')::integer,coalesce((p_data->>'random_delay_max')::integer,1),case when p_data->>'target'='time' then coalesce((p_data->>'target_time_ms')::integer,(p_data->>'value')::integer*1000) end,coalesce((p_data->>'finish_current_lap')::boolean,false),coalesce(p_data->>'stagger_mode','manual'),coalesce((p_data->>'stagger_gap_ms')::integer,10000))
      returning to_jsonb(club_presets.*) into current_row;
    else
      update public.club_presets set name=btrim(p_data->>'name'),target=p_data->>'target',value=(p_data->>'value')::integer,rank=p_data->>'rank',start_mode=p_data->>'start_mode',cd=(p_data->>'cd')::integer,sound=(p_data->>'sound')::integer,random_delay_max=coalesce((p_data->>'random_delay_max')::integer,1),target_time_ms=case when p_data->>'target'='time' then coalesce((p_data->>'target_time_ms')::integer,(p_data->>'value')::integer*1000) end,finish_current_lap=coalesce((p_data->>'finish_current_lap')::boolean,false),stagger_mode=coalesce(p_data->>'stagger_mode','manual'),stagger_gap_ms=coalesce((p_data->>'stagger_gap_ms')::integer,10000),
        last_mutation_id=p_mutation_id, deleted_at=case when p_deleted then now() end
      where id=p_id returning to_jsonb(club_presets.*) into current_row;
    end if;
  end if;
  return jsonb_build_object('record',current_row);
end;
$$;
revoke all on function public.desktop_sync_entity(text,uuid,uuid,bigint,uuid,jsonb,boolean) from public, anon;
grant execute on function public.desktop_sync_entity(text,uuid,uuid,bigint,uuid,jsonb,boolean) to authenticated;

-- Historical participation follows the saved account identity, including
-- visiting drivers and drivers who have since left a club. Never use the
-- current owner of a transponder to grant access to an old result.
create or replace function public.race_has_participant(p_results jsonb, p_session jsonb, p_user uuid)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(p_results)='array' then p_results else '[]'::jsonb end
      || case when jsonb_typeof(p_session->'drivers')='array' then p_session->'drivers' else '[]'::jsonb end
    ) as participant
    where p_user::text in (participant->>'user_id',participant->>'driver_id',
      participant->>'account_id',participant->>'member_id',participant->>'userId',participant->>'member_user_id')
  );
$$;
revoke all on function public.race_has_participant(jsonb,jsonb,uuid) from public, anon;
grant execute on function public.race_has_participant(jsonb,jsonb,uuid) to authenticated;
drop policy if exists "participants read historical races" on public.races;
create policy "participants read historical races" on public.races for select to authenticated
  using (public.race_has_participant(results,session_data,auth.uid()));

create or replace function public.list_personal_races(p_limit integer default 500, p_offset integer default 0)
returns setof public.races language sql stable security invoker set search_path = '' as $$
  select r.* from public.races r
  where public.race_has_participant(r.results,r.session_data,auth.uid())
  order by r.raced_at desc,r.id
  limit least(greatest(coalesce(p_limit,500),1),500)
  offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function public.list_personal_races(integer,integer) from public, anon;
grant execute on function public.list_personal_races(integer,integer) to authenticated;

-- Practice is personal. Club membership must not expose another driver's
-- private log; a driver explicitly publishes each session in their dashboard.
drop policy if exists "users read own or public practice" on public.practice_sessions;
create policy "users read own or public practice" on public.practice_sessions for select to authenticated
  using (user_id=auth.uid() or visibility='public');
revoke update on public.practice_sessions from authenticated;
grant update (visibility) on public.practice_sessions to authenticated;

create or replace function public.desktop_upload_practice(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cid uuid := nullif(p_payload->>'club_id','')::uuid;
  sid uuid := nullif(p_payload->>'id','')::uuid;
  uid uuid := nullif(p_payload->>'user_id','')::uuid;
  tid uuid := case when coalesce(p_payload->>'track_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_payload->>'track_id')::uuid else null end;
  saved public.practice_sessions;
begin
  if auth.uid() is null or public.club_role(cid) is distinct from 'leader' then
    raise exception 'Active leader required' using errcode='42501';
  end if;
  if sid is null or cid is null or jsonb_typeof(p_payload->'laps') is distinct from 'array'
     or coalesce(length(btrim(p_payload->>'track_name')),0) not between 1 and 300
     or p_payload->>'started_at' is null or octet_length(p_payload::text)>10000000 then
    raise exception 'Invalid practice payload' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
  select * into saved from public.practice_sessions where id=sid for update;
  if saved.id is not null and (saved.club_id is distinct from cid or saved.user_id is distinct from uid) then
    raise exception 'Practice identity does not match the saved session' using errcode='23505';
  end if;
  insert into public.practice_sessions
    (id,user_id,club_id,track_id,track_name,started_at,ended_at,laps,summary,visibility)
  values
    (sid,uid,cid,tid,p_payload->>'track_name',(p_payload->>'started_at')::timestamptz,
     nullif(p_payload->>'ended_at','')::timestamptz,p_payload->'laps',
     coalesce(p_payload->'summary','{}'::jsonb),'private')
  on conflict (id) do update set
    ended_at=excluded.ended_at,laps=excluded.laps,summary=excluded.summary;
  -- Owner, track, start time, and user-selected visibility stay frozen on retry.
  return jsonb_build_object('id',sid,'club_id',cid);
end;
$$;
revoke all on function public.desktop_upload_practice(jsonb) from public, anon;
grant execute on function public.desktop_upload_practice(jsonb) to authenticated;

-- Resolve visiting drivers when their transponder is observed at a club. Only
-- an active leader may call this; no email or authentication data is returned.
create or replace function public.desktop_resolve_drivers(p_club_id uuid,p_transponders text[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or public.club_role(p_club_id) is distinct from 'leader' then
    raise exception 'Active leader required' using errcode='42501';
  end if;
  if coalesce(cardinality(p_transponders),0)>100
     or exists (select 1 from unnest(p_transponders) as tid where
       case when tid ~ '^[0-9]{1,10}$' then tid::bigint>4294967295 else true end) then
    raise exception 'Use at most 100 numeric transponder IDs' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.full_name,'full_name',p.full_name,'nick',p.nickname,'nickname',p.nickname,
    'tts_name',p.tts_name,'avatar_url',p.avatar_url,'transponder_details',devices.items
  )),'[]'::jsonb) into result
  from public.profiles p join lateral (
    select jsonb_agg(jsonb_build_object('user_id',t.user_id,'transponder_id',t.transponder_id,
      'rc_class',t.rc_class,'rc_brand',t.rc_brand)) as items
    from public.transponders t where t.user_id=p.id and t.transponder_id=any(p_transponders)
  ) devices on devices.items is not null;
  return result;
end;
$$;
revoke all on function public.desktop_resolve_drivers(uuid,text[]) from public,anon;
grant execute on function public.desktop_resolve_drivers(uuid,text[]) to authenticated;

