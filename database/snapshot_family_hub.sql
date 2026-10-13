-- One-time, pre-rollout snapshot. Already applied on 2026-10-13.
-- Contains no credentials/data literals; copies rows inside the existing project.
begin;
create schema fh_rollout_backup_20261013;
revoke all on schema fh_rollout_backup_20261013 from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['kv_profiles','kv_persons','kv_categories','kv_videos','kv_links','kv_photos','kv_notes','kv_video_segments','kv_api_keys'] loop
  execute format('create table fh_rollout_backup_20261013.%I as table public.%I',t,t);
 end loop;
end $$;
create table fh_rollout_backup_20261013.policies as select * from pg_policies where (schemaname='public' and tablename like 'kv_%') or schemaname='storage';
create table fh_rollout_backup_20261013.buckets as select * from storage.buckets where id='kv-media';
create table fh_rollout_backup_20261013.objects as select * from storage.objects where bucket_id='kv-media';
revoke all on all tables in schema fh_rollout_backup_20261013 from public,anon,authenticated;
commit;
