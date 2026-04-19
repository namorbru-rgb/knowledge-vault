-- Storage-Bucket und RLS-Policies für Foto-Uploads.
-- Idempotent: kann beliebig oft ausgeführt werden.

insert into storage.buckets (id, name, public)
values ('kv-media', 'kv-media', true)
on conflict (id) do update set public = true;

drop policy if exists "kv_media_read_public" on storage.objects;
drop policy if exists "kv_media_auth_insert_own_folder" on storage.objects;
drop policy if exists "kv_media_auth_update_own" on storage.objects;
drop policy if exists "kv_media_auth_delete_own" on storage.objects;

create policy "kv_media_read_public"
  on storage.objects for select
  using (bucket_id = 'kv-media');

create policy "kv_media_auth_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kv-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kv_media_auth_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'kv-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kv_media_auth_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kv-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
