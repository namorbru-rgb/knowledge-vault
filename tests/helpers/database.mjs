import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003'
const P='00000000-0000-4000-8000-000000000011', PB='00000000-0000-4000-8000-000000000012', R='00000000-0000-4000-8000-000000000021', D='00000000-0000-4000-8000-000000000022'
export const fixture = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
create policy existing_broad_storage on storage.objects for all to authenticated using(true) with check(true);
create policy kv_media_read_public on storage.objects for select using(bucket_id='kv-media');
insert into storage.buckets values('kv-media','kv-media',true,null,null),('unrelated','unrelated',true,null,null);
create table kv_persons(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),name text,color text default 'blue',emoji text default '👤',created_at timestamptz default now());
create table kv_profiles(id uuid primary key references auth.users(id),email text);
create table kv_photos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),storage_path text,filename text);
create table kv_notes(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),content text);
create table kv_videos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),title text);
create table kv_links(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),title text);
create table kv_categories(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),name text);
create table kv_video_segments(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),video_id uuid);
create table kv_api_keys(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),key_hash text);
do $$declare t text; begin foreach t in array array['kv_persons','kv_profiles','kv_photos','kv_notes','kv_videos','kv_links','kv_categories','kv_video_segments','kv_api_keys'] loop execute format('alter table %I enable row level security',t); execute format('grant all on %I to anon,authenticated',t); execute format('create policy legacy_open on %I for all using(true) with check(true)',t); end loop; end$$;
insert into auth.users values('${A}'),('${B}'),('${C}');
insert into kv_persons(id,user_id,name) values('${P}','${A}','Synthetic A'),('${PB}','${B}','Synthetic B');
insert into kv_notes(user_id,content) values('${A}','Knowledge regression A'),('${B}','Knowledge regression B');
`
export async function setup() {
  const db=new PGlite(); await db.exec(fixture)
  await db.exec(await readFile(new URL('../../supabase/migrations/20261013185309_family_hub.sql',import.meta.url),'utf8'))
  return db
}
