-- Keep personal race history visible to the account that created the race.
alter table public.clubs add column if not exists avatar_url text;
drop policy if exists "races are viewable by club members" on public.races;
create policy "races are viewable by club members or owner"
  on public.races for select to authenticated
  using (public.is_club_member(club_id) or created_by = auth.uid());

-- The app's authenticated club leader uploads practice records for linked drivers.
-- This keeps the timing computer from needing each driver's access token.
create or replace function public.desktop_upload_practice(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cid uuid := nullif(p_payload->>'club_id','')::uuid;
  sid uuid := nullif(p_payload->>'id','')::uuid;
  uid uuid := case when coalesce(p_payload->>'user_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (p_payload->>'user_id')::uuid else null end;
  saved public.practice_sessions;
begin
  if auth.uid() is null or public.club_role(cid) is distinct from 'leader' then
    raise exception 'Active leader required' using errcode = '42501';
  end if;
  if sid is null or cid is null or jsonb_typeof(p_payload->'laps') is distinct from 'array'
     or coalesce(p_payload->>'track_name','') = '' then
    raise exception 'Invalid practice payload' using errcode = '22023';
  end if;
  insert into public.practice_sessions
    (id,user_id,club_id,track_id,track_name,started_at,ended_at,laps,summary,visibility)
  values
    (sid,uid,cid,case when coalesce(p_payload->>'track_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (p_payload->>'track_id')::uuid else null end,p_payload->>'track_name',
     coalesce((p_payload->>'started_at')::timestamptz,now()),
     nullif(p_payload->>'ended_at','')::timestamptz,
     p_payload->'laps',coalesce(p_payload->'summary','{}'::jsonb),
     case when p_payload->>'visibility' = 'public' then 'public' else 'private' end)
  on conflict (id) do update set
    user_id = excluded.user_id,
    track_id = excluded.track_id,
    track_name = excluded.track_name,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    laps = excluded.laps,
    summary = excluded.summary;
  select * into saved from public.practice_sessions where id = sid;
  if saved.id is null or saved.club_id is distinct from cid then
    raise exception 'Practice ID already exists with different content' using errcode = '23505';
  end if;
  return jsonb_build_object('id',saved.id,'club_id',saved.club_id);
end;
$$;
revoke all on function public.desktop_upload_practice(jsonb) from public, anon;
grant execute on function public.desktop_upload_practice(jsonb) to authenticated;
