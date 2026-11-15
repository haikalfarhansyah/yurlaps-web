-- Short lived, one use desktop/Pi pairing tickets.
-- Session credentials never travel through the device's HTTP listener. The
-- website publishes them here over Supabase HTTPS and the app consumes them
-- once with the state+code it generated.
create table if not exists public.device_pairings (
  state text primary key,
  code text not null,
  session_payload jsonb,
  user_id uuid references auth.users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.device_pairings enable row level security;
revoke all on table public.device_pairings from anon, authenticated;

create or replace function public.desktop_pair_begin(p_state text, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_state is null or p_state !~ '^[A-Za-z0-9_-]{32}$'
     or p_code is null or p_code !~ '^[0-9A-F]{8}$' then
    raise exception 'invalid pairing ticket';
  end if;
  delete from public.device_pairings where expires_at <= now();
  insert into public.device_pairings(state, code, expires_at)
    values (p_state, upper(p_code), now() + interval '5 minutes')
    on conflict (state) do nothing;
  return true;
end;
$$;

create or replace function public.desktop_pair_publish(
  p_state text, p_code text, p_session jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_session is null
     or coalesce(p_session->>'access_token', '') = ''
     or coalesce(p_session->>'refresh_token', '') = '' then
    raise exception 'login required';
  end if;
  update public.device_pairings
     set session_payload = p_session, user_id = auth.uid()
   where state = p_state and code = upper(p_code)
     and expires_at > now() and session_payload is null;
  if not found then raise exception 'pairing expired or already used'; end if;
  return true;
end;
$$;

create or replace function public.desktop_pair_consume(p_state text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare payload jsonb;
begin
  delete from public.device_pairings where expires_at <= now();
  delete from public.device_pairings
   where state = p_state and code = upper(p_code) and expires_at > now()
     and session_payload is not null
   returning session_payload into payload;
  return coalesce(payload, 'null'::jsonb);
end;
$$;

revoke all on function public.desktop_pair_begin(text, text) from public;
revoke all on function public.desktop_pair_publish(text, text, jsonb) from public;
revoke all on function public.desktop_pair_consume(text, text) from public;
grant execute on function public.desktop_pair_begin(text, text) to anon, authenticated;
grant execute on function public.desktop_pair_publish(text, text, jsonb) to authenticated;
grant execute on function public.desktop_pair_consume(text, text) to anon, authenticated;
