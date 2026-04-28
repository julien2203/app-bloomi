begin;

-- Allow each authenticated user to manage only their own cover file
-- in bucket "cover", under path: {auth.uid()}/cover.jpg

drop policy if exists "Cover bucket select public" on storage.objects;
create policy "Cover bucket select public"
on storage.objects
for select
to public
using (bucket_id = 'cover');

drop policy if exists "Cover bucket insert own file" on storage.objects;
create policy "Cover bucket insert own file"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cover'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Cover bucket update own file" on storage.objects;
create policy "Cover bucket update own file"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cover'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'cover'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Cover bucket delete own file" on storage.objects;
create policy "Cover bucket delete own file"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cover'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
