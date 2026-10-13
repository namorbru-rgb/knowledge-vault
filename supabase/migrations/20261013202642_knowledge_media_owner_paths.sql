begin;
-- Legacy service-role photo workers may only process an owner's own file.
alter table public.kv_photos add constraint fh_photo_owned_path check(
 storage_path is null or (
  user_id is not null and storage_path not like '%\%' and storage_path not like '%\%%' escape '\'
  and storage_path !~ '(^|/)\.\.?(/|$)'
  and (split_part(storage_path,'/',1)=user_id::text or (split_part(storage_path,'/',1)='photos' and split_part(storage_path,'/',2)=user_id::text))
 ));
commit;
