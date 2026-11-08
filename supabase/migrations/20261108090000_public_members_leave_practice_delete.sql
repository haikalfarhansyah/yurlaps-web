-- Public member directory, self-service leave, and personal practice deletion.

create or replace function public.list_public_club_members(p_club_id uuid)
returns table (user_id uuid, role text, full_name text, nickname text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select m.user_id, m.role, p.full_name, p.nickname, p.avatar_url
  from public.club_members m
  join public.clubs c on c.id = m.club_id and c.visibility = 'public'
  left join public.profiles p on p.id = m.user_id
  where m.club_id = p_club_id and m.status = 'active'
  order by case when m.role = 'leader' then 0 else 1 end, coalesce(p.nickname, p.full_name, '') collate "C";
$$;
revoke all on function public.list_public_club_members(uuid) from public;
grant execute on function public.list_public_club_members(uuid) to anon, authenticated;

create or replace function public.leave_club(p_club_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.club_members where club_id=p_club_id and user_id=auth.uid() and role='leader' and status='active') then
    raise exception 'Leader cannot leave the club. Transfer leadership first.';
  end if;
  delete from public.club_members where club_id=p_club_id and user_id=auth.uid();
end;
$$;
revoke all on function public.leave_club(uuid) from public;
grant execute on function public.leave_club(uuid) to authenticated;

create or replace function public.delete_personal_practice(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.practice_sessions where id=p_session_id and user_id=auth.uid();
end;
$$;
revoke all on function public.delete_personal_practice(uuid) from public;
grant execute on function public.delete_personal_practice(uuid) to authenticated;
