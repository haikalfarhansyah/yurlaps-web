-- One short-lived public scoreboard per club. No lap history or private practice identity.
create table if not exists public.club_live_state (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  mode text not null check (mode in ('event','quick','practice','idle')),
  payload jsonb not null default '{}'::jsonb,
  seq bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.club_live_state enable row level security;
grant select on public.club_live_state to anon, authenticated;
revoke insert, update, delete on public.club_live_state from anon, authenticated;
drop policy if exists "club live visible to public or members" on public.club_live_state;
create policy "club live visible to public or members" on public.club_live_state
  for select to anon, authenticated using (
    public.is_club_member(club_id) or exists (
      select 1 from public.clubs c where c.id = club_live_state.club_id and c.visibility = 'public'
    )
  );

create or replace function public.desktop_publish_club_live(
  p_club_id uuid, p_mode text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_rows jsonb;
  clean_payload jsonb;
  saved public.club_live_state;
begin
  if auth.uid() is null or public.club_role(p_club_id) is distinct from 'leader' then
    raise exception 'Active club leader required' using errcode = '42501';
  end if;
  if p_mode not in ('event','quick','practice','idle') or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'rows') is distinct from 'array'
     or jsonb_array_length(p_payload->'rows') > 50
     or octet_length(p_payload::text) > 90000 then
    raise exception 'Invalid live payload' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'pos', least(50, greatest(1, coalesce((r->>'pos')::integer, 1))),
    'name', case when p_mode = 'practice' then 'Mobil ' || coalesce(r->>'pos','')
      else left(coalesce(r->>'name',''), 80) end,
    'laps', greatest(0, coalesce((r->>'laps')::integer, 0)),
    'total_ms', (r->>'total_ms')::integer,
    'best_ms', (r->>'best_ms')::integer,
    'gap_ms', (r->>'gap_ms')::integer,
    'status', left(coalesce(r->>'status',''), 20)
  ) order by coalesce((r->>'pos')::integer, 999)), '[]'::jsonb)
  into clean_rows from jsonb_array_elements(p_payload->'rows') r;
  clean_payload := jsonb_build_object(
    'name', left(coalesce(p_payload->>'name',''), 100),
    'track', left(coalesce(p_payload->>'track',''), 100),
    'stage', left(coalesce(p_payload->>'stage',''), 100),
    'status', left(coalesce(p_payload->>'status',''), 20),
    'elapsed_ms', (p_payload->>'elapsed_ms')::integer,
    'rows', clean_rows
  );
  insert into public.club_live_state(club_id,mode,payload)
    values (p_club_id,p_mode,clean_payload)
    on conflict (club_id) do update set mode=excluded.mode,payload=excluded.payload,
      seq=club_live_state.seq+1,updated_at=now()
    returning * into saved;
  return jsonb_build_object('club_id',saved.club_id,'seq',saved.seq,'updated_at',saved.updated_at);
end;
$$;

revoke all on function public.desktop_publish_club_live(uuid,text,jsonb) from public, anon;
grant execute on function public.desktop_publish_club_live(uuid,text,jsonb) to authenticated;

-- Supabase Realtime pushes changes; the website also polls as a recovery path.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'club_live_state') then
    alter publication supabase_realtime add table public.club_live_state;
  end if;
end $$;
