-- Include club branding in the public community directory.
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
language sql stable security definer set search_path = public as $$
  select club.id, club.name, club.description, club.address, club.avatar_url,
    club.visibility, club.join_method,
    count(member.user_id) filter (where member.status = 'active'), club.created_at
  from public.clubs as club
  left join public.club_members as member on member.club_id = club.id
  where club.visibility = 'public'
  group by club.id
  order by club.created_at desc;
$$;
grant execute on function public.list_public_clubs() to anon, authenticated;
