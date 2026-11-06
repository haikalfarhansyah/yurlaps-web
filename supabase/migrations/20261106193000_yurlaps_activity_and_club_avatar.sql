-- Public data model for club branding and personal activity.
alter table public.clubs add column if not exists avatar_url text;

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  track_id uuid,
  track_name text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  laps jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now()
);
alter table public.practice_sessions enable row level security;
grant select, insert, update on public.practice_sessions to authenticated;
create policy "users read own or public practice" on public.practice_sessions for select to authenticated
  using (user_id = auth.uid() or visibility = 'public' or (club_id is not null and public.is_club_member(club_id)));
create policy "users insert own practice" on public.practice_sessions for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own practice" on public.practice_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists practice_sessions_user_date_idx on public.practice_sessions(user_id, started_at desc);
create index if not exists practice_sessions_track_date_idx on public.practice_sessions(track_id, started_at desc);

-- Track deletion is archival: old races keep their copied track_name and remain queryable.
comment on column public.club_tracks.deleted_at is 'Archived from the app; never hard-delete historical race references.';
