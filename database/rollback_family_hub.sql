-- Schema rollback ONLY before Family Hub has been used. Export/restore review is
-- required once any resource exists. Keep Knowledge ownership fences/private media.
begin;
do $$ begin
 if exists(select 1 from public.fh_resources) or exists(select 1 from public.fh_families)
    or exists(select 1 from storage.objects where bucket_id='fh-vault') then
  raise exception 'Family Hub contains data: rollback refused. Back up and plan a data-preserving restore.';
 end if;
end $$;
drop policy fh_vault_read on storage.objects;
drop policy fh_vault_insert on storage.objects;
drop policy fh_vault_delete on storage.objects;
-- Keep a restrictive deny on fh-vault even after rollback.
drop policy fh_storage_read_fence on storage.objects;
drop policy fh_storage_insert_fence on storage.objects;
drop policy fh_storage_delete_fence on storage.objects;
create policy fh_storage_read_fence on storage.objects as restrictive for select to public using(bucket_id not in ('kv-media','fh-vault') or (bucket_id='kv-media' and auth.uid() is not null and fh_private.photo_path(name)));
create policy fh_storage_insert_fence on storage.objects as restrictive for insert to public with check(bucket_id not in ('kv-media','fh-vault') or (bucket_id='kv-media' and auth.uid() is not null and fh_private.photo_path(name)));
create policy fh_storage_delete_fence on storage.objects as restrictive for delete to public using(bucket_id not in ('kv-media','fh-vault') or (bucket_id='kv-media' and auth.uid() is not null and fh_private.photo_path(name)));
drop function public.fh_create_family(text,text),public.fh_add_member(uuid,uuid,text,text),public.fh_review_extraction(uuid,boolean),public.fh_record_open(uuid);
drop table public.fh_document_refs,public.fh_doses,public.fh_extractions,public.fh_grants,public.fh_audit;
drop table public.fh_resources,public.fh_members,public.fh_families;
drop function fh_private.access(uuid,boolean),fh_private.owns(uuid),fh_private.member(uuid,boolean),fh_private.protect_resource(),fh_private.audit_change(),fh_private.valid_schedule(jsonb);
delete from storage.buckets where id='fh-vault';
-- kv_persons classification and security policies are intentionally retained:
-- they contain no new records and removing the policies would reopen exposure.
commit;
