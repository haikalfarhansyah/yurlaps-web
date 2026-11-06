-- YurLaps community / club schema
-- Run this once after supabase/schema.sql in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  address text not null default '',
  avatar_url text,
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  join_method text not null default 'open'
    check (join_method in ('open', 'approval')),
  join_code text not null unique,
  role_permissions jsonb not null default '{
    "co_leader": {
      "edit_club": false,
      "manage_members": true,
      "review_applications": true,
      "manage_tracks": true,
      "manage_races": true
    },
    "officer": {
      "edit_club": false,
      "manage_members": false,
      "review_applications": true,
      "manage_tracks": false,
      "manage_races": false
    }
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('leader', 'co_leader', 'officer', 'member')),
  status text not null default 'active'
    check (status in ('active', 'pending')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id);
create index if not exists club_members_club_status_idx on public.club_members (club_id, status);

create table if not exists public.club_tracks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  address text not null default '',
  min_lap_ms integer not null default 1500 check (min_lap_ms >= 100),
  is_active boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists club_tracks_club_idx on public.club_tracks (club_id);

create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  track_name text not null default '',
  location text not null default '',
  raced_at timestamptz not null default now(),
  results jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists races_club_date_idx on public.races (club_id, raced_at desc);

-- ---------------------------------------------------------------------------
-- Join codes and automatic leader membership
-- ---------------------------------------------------------------------------
create or replace function public.generate_club_join_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.clubs where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.prepare_club()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.join_code is null or new.join_code = '' then
      new.join_code := public.generate_club_join_code();
    end if;
  elsif new.visibility = 'private' and old.visibility is distinct from 'private' then
    -- Public rows expose every column to anonymous visitors, so make sure a
    -- club that becomes private never keeps a code that could have been seen.
    new.join_code := public.generate_club_join_code();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clubs_prepare on public.clubs;
create trigger clubs_prepare
  before insert or update on public.clubs
  for each row
  execute function public.prepare_club();

create or replace function public.add_club_leader()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_members (club_id, user_id, role, status)
  values (new.id, new.owner_id, 'leader', 'active')
  on conflict (club_id, user_id)
  do update set role = 'leader', status = 'active';
  return new;
end;
$$;

drop trigger if exists clubs_add_leader on public.clubs;
create trigger clubs_add_leader
  after insert on public.clubs
  for each row
  execute function public.add_club_leader();

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------
create or replace function public.club_role(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.club_members
  where club_id = p_club_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.club_role(p_club_id) is not null;
$$;

create or replace function public.club_permission(p_club_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when membership.role = 'leader' then true
    when membership.role is null then false
    else coalesce(
      (club.role_permissions -> membership.role ->> p_permission)::boolean,
      false
    )
  end
  from (select public.club_role(p_club_id) as role) as membership
  left join public.clubs as club on club.id = p_club_id;
$$;

create or replace function public.shares_club_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members as me
    join public.club_members as other on other.club_id = me.club_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and other.user_id = target_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Community RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.list_public_clubs();
create or replace function public.list_public_clubs()
returns table (
  id uuid,
  name text,
  description text,
  address text,
  avatar_url text,
  visibility text,
  join_method text,
  member_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    club.id,
    club.name,
    club.description,
    club.address,
    club.avatar_url,
    club.visibility,
    club.join_method,
    count(member.user_id) filter (where member.status = 'active') as member_count,
    club.created_at
  from public.clubs as club
  left join public.club_members as member on member.club_id = club.id
  where club.visibility = 'public'
  group by club.id
  order by club.created_at desc;
$$;

create or replace function public.join_club(p_club_id uuid, p_code text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  club public.clubs;
  existing public.club_members;
  result text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into club from public.clubs where id = p_club_id;
  if not found then
    raise exception 'Club not found';
  end if;

  select * into existing
  from public.club_members
  where club_id = p_club_id and user_id = auth.uid();
  if found then
    return existing.status;
  end if;

  if club.visibility = 'private'
    and (p_code is null or trim(p_code) <> club.join_code) then
    raise exception 'Invalid join code';
  end if;

  if club.join_method = 'open' then
    insert into public.club_members (club_id, user_id, role, status)
    values (p_club_id, auth.uid(), 'member', 'active');
    result := 'active';
  else
    insert into public.club_members (club_id, user_id, role, status)
    values (p_club_id, auth.uid(), 'member', 'pending');
    result := 'pending';
  end if;

  return result;
end;
$$;

create or replace function public.join_club_by_code(p_code text)
returns table (club_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.clubs;
  result text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into target from public.clubs where join_code = trim(p_code);
  if not found then
    raise exception 'Invalid join code';
  end if;

  result := public.join_club(target.id, p_code);
  return query select target.id, result;
end;
$$;

create or replace function public.review_join_request(
  p_club_id uuid,
  p_user_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.club_permission(p_club_id, 'review_applications') then
    raise exception 'Not allowed';
  end if;

  if p_approve then
    update public.club_members
    set status = 'active', joined_at = now()
    where club_id = p_club_id and user_id = p_user_id and status = 'pending';
  else
    delete from public.club_members
    where club_id = p_club_id and user_id = p_user_id and status = 'pending';
  end if;
end;
$$;

create or replace function public.update_member_role(
  p_club_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.club_permission(p_club_id, 'manage_members') then
    raise exception 'Not allowed';
  end if;

  if p_role not in ('co_leader', 'officer', 'member') then
    raise exception 'Invalid role';
  end if;

  if exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = p_user_id and role = 'leader'
  ) then
    raise exception 'The leader role cannot be changed';
  end if;

  update public.club_members
  set role = p_role
  where club_id = p_club_id and user_id = p_user_id and status = 'active';
end;
$$;

create or replace function public.remove_club_member(
  p_club_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.club_permission(p_club_id, 'manage_members') then
    raise exception 'Not allowed';
  end if;

  delete from public.club_members
  where club_id = p_club_id
    and user_id = p_user_id
    and role <> 'leader';
end;
$$;

create or replace function public.update_club_profile(
  p_club_id uuid,
  p_name text,
  p_description text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.club_permission(p_club_id, 'edit_club') then
    raise exception 'Not allowed';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Club name is required';
  end if;

  update public.clubs
  set name = trim(p_name),
      description = coalesce(p_description, ''),
      address = coalesce(p_address, ''),
      updated_at = now()
  where id = p_club_id;
end;
$$;

create or replace function public.update_club_settings(
  p_club_id uuid,
  p_visibility text,
  p_join_method text,
  p_role_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.club_role(p_club_id) <> 'leader' then
    raise exception 'Only the leader can change club settings';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;

  if p_join_method not in ('open', 'approval') then
    raise exception 'Invalid join method';
  end if;

  update public.clubs
  set visibility = p_visibility,
      join_method = p_join_method,
      role_permissions = coalesce(p_role_permissions, role_permissions),
      updated_at = now()
  where id = p_club_id;
end;
$$;

create or replace function public.regenerate_join_code(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if public.club_role(p_club_id) <> 'leader' then
    raise exception 'Only the leader can change the join code';
  end if;

  new_code := public.generate_club_join_code();
  update public.clubs
  set join_code = new_code, updated_at = now()
  where id = p_club_id;
  return new_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_tracks enable row level security;
alter table public.races enable row level security;

drop policy if exists "clubs are viewable by members or when public" on public.clubs;
create policy "clubs are viewable by members or when public"
  on public.clubs for select
  using (visibility = 'public' or owner_id = auth.uid() or public.is_club_member(id));

drop policy if exists "clubs are insertable by their owner" on public.clubs;
create policy "clubs are insertable by their owner"
  on public.clubs for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "clubs are updatable by permitted members" on public.clubs;
drop policy if exists "clubs are updatable by their leader" on public.clubs;
create policy "clubs are updatable by their leader"
  on public.clubs for update
  to authenticated
  using (public.club_role(id) = 'leader')
  with check (public.club_role(id) = 'leader');

drop policy if exists "clubs are deletable by their leader" on public.clubs;
create policy "clubs are deletable by their leader"
  on public.clubs for delete
  to authenticated
  using (public.club_role(id) = 'leader');

drop policy if exists "memberships are viewable by self or club members" on public.club_members;
create policy "memberships are viewable by self or club members"
  on public.club_members for select
  using (user_id = auth.uid() or public.is_club_member(club_id));

drop policy if exists "tracks are viewable by club members" on public.club_tracks;
create policy "tracks are viewable by club members"
  on public.club_tracks for select
  using (public.is_club_member(club_id));

drop policy if exists "tracks are writable by permitted members" on public.club_tracks;
create policy "tracks are writable by permitted members"
  on public.club_tracks for insert
  to authenticated
  with check (public.club_permission(club_id, 'manage_tracks'));

drop policy if exists "tracks are updatable by permitted members" on public.club_tracks;
create policy "tracks are updatable by permitted members"
  on public.club_tracks for update
  to authenticated
  using (public.club_permission(club_id, 'manage_tracks'))
  with check (public.club_permission(club_id, 'manage_tracks'));

drop policy if exists "tracks are deletable by permitted members" on public.club_tracks;
create policy "tracks are deletable by permitted members"
  on public.club_tracks for delete
  to authenticated
  using (public.club_permission(club_id, 'manage_tracks'));

drop policy if exists "races are viewable by club members" on public.races;
create policy "races are viewable by club members"
  on public.races for select
  using (public.is_club_member(club_id) or created_by = auth.uid());

drop policy if exists "races are writable by permitted members" on public.races;
create policy "races are writable by permitted members"
  on public.races for insert
  to authenticated
  with check (public.club_permission(club_id, 'manage_races'));

drop policy if exists "races are updatable by permitted members" on public.races;
create policy "races are updatable by permitted members"
  on public.races for update
  to authenticated
  using (public.club_permission(club_id, 'manage_races'))
  with check (public.club_permission(club_id, 'manage_races'));

drop policy if exists "races are deletable by permitted members" on public.races;
create policy "races are deletable by permitted members"
  on public.races for delete
  to authenticated
  using (public.club_permission(club_id, 'manage_races'));

-- Club mates can see each other's profile and transponders (needed for the
-- member list). These replace the owner-only select policies from schema.sql.
drop policy if exists "profiles are viewable by owner" on public.profiles;
drop policy if exists "profiles are viewable by owner or club mates" on public.profiles;
create policy "profiles are viewable by owner or club mates"
  on public.profiles for select
  using (auth.uid() = id or public.shares_club_with(id));

drop policy if exists "transponders are viewable by owner" on public.transponders;
drop policy if exists "transponders are viewable by owner or club mates" on public.transponders;
create policy "transponders are viewable by owner or club mates"
  on public.transponders for select
  using (auth.uid() = user_id or public.shares_club_with(user_id));
