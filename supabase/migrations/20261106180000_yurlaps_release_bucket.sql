-- Public download bucket for stable YurLaps Windows releases.
-- CI uploads with the Supabase service-role key; visitors only need read access.
insert into storage.buckets (id, name, public)
values ('yurlaps-releases', 'yurlaps-releases', true)
on conflict (id) do update set public = true;

create policy "public can download YurLaps releases"
on storage.objects for select
to public
using (bucket_id = 'yurlaps-releases');
