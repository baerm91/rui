insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-previews',
  'story-previews',
  true,
  52428800,
  array['video/webm', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authors upload story previews" on storage.objects;
create policy "authors upload story previews"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "authors update story previews" on storage.objects;
create policy "authors update story previews"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "authors delete story previews" on storage.objects;
create policy "authors delete story previews"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'story-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
