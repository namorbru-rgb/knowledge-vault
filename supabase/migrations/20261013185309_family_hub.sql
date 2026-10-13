-- Reviewed deployment only. Additive tables; existing Knowledge records are retained.
begin;
create schema if not exists fh_private;
revoke all on schema fh_private from public;
grant usage on schema fh_private to authenticated;

-- Restrictive fences are necessary: the live project has permissive USING(true) policies.
do $$ declare t text; c text; begin
  foreach t in array array['kv_profiles','kv_persons','kv_categories','kv_videos','kv_links','kv_photos','kv_notes','kv_video_segments','kv_api_keys'] loop
    if to_regclass('public.' || t) is not null then
      c := case when t='kv_profiles' then 'id' else 'user_id' end;
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on public.%I from anon',t);
      execute format('grant select,insert,update,delete on public.%I to authenticated',t);
      execute format('create policy fh_owner_allow on public.%I for all to authenticated using (auth.uid()=%I) with check (auth.uid()=%I)',t,c,c);
      execute format('create policy fh_owner_fence on public.%I as restrictive for all to public using (auth.uid()=%I) with check (auth.uid()=%I)',t,c,c);
    end if;
  end loop;
end $$;

-- Existing persons remain Knowledge labels until explicitly classified by their owner.
alter table public.kv_persons add column fh_kind text not null default 'legacy' check (fh_kind in ('legacy','self','child'));
alter table public.kv_persons add constraint fh_person_owner_unique unique(id,user_id);
create unique index fh_one_self on public.kv_persons(user_id) where fh_kind='self';

create table public.fh_families (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), created_at timestamptz not null default now()
);
create table public.fh_members (
 family_id uuid not null references public.fh_families(id), user_id uuid not null references auth.users(id),
 display_name text not null check(length(display_name) between 1 and 120), role text not null check(role in ('admin','member')),
 primary key(family_id,user_id)
);
create table public.fh_resources (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 person_id uuid not null, kind text not null check(kind in ('symptom','case','visit','hospital','examination','prescription','medication','nutrition','reminder','document')),
 title text not null check(length(title) between 1 and 200), occurred_at timestamptz not null default now(),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 intensity integer check(intensity between 0 and 10), expires_on date,
 storage_path text unique, mime_type text, created_at timestamptz not null default now(),
 unique(id,owner_id,person_id), foreign key(person_id,owner_id) references public.kv_persons(id,user_id),
 check((kind='document' and storage_path=owner_id::text || '/' || id::text) or (kind<>'document' and storage_path is null)),
 check(kind<>'document' or (storage_path is not null and mime_type in ('application/pdf','image/jpeg','image/png','image/webp')))
);
create index fh_resources_owner_time on public.fh_resources(owner_id,occurred_at desc);
create index fh_resources_person on public.fh_resources(person_id);
alter table public.fh_resources add constraint fh_medication_schedule check(kind<>'medication' or
 (details ? 'dosage' and jsonb_typeof(details->'dosage')='string' and details ? 'slots' and jsonb_typeof(details->'slots')='array' and jsonb_array_length(details->'slots')>0));
create function fh_private.valid_schedule(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p->'slots')='array' then
   jsonb_array_length(p->'slots') between 1 and 24 and length(trim(p->>'dosage'))>0
   and not exists(select 1 from jsonb_array_elements_text(p->'slots') s where s !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
 else false end;
$$;
revoke all on function fh_private.valid_schedule(jsonb) from public;
grant execute on function fh_private.valid_schedule(jsonb) to authenticated;
alter table public.fh_resources add constraint fh_medication_times check(kind<>'medication' or fh_private.valid_schedule(details));
create table public.fh_grants (
 resource_id uuid not null references public.fh_resources(id) on delete cascade,
 recipient_id uuid not null references auth.users(id), permission text not null check(permission in ('read','edit')),
 created_at timestamptz not null default now(), primary key(resource_id,recipient_id)
);
create index fh_grants_recipient on public.fh_grants(recipient_id,resource_id);
create table public.fh_document_refs (
 document_id uuid not null, resource_id uuid not null, owner_id uuid not null, person_id uuid not null,
 primary key(document_id,resource_id),
 foreign key(document_id,owner_id,person_id) references public.fh_resources(id,owner_id,person_id) on delete cascade,
 foreign key(resource_id,owner_id,person_id) references public.fh_resources(id,owner_id,person_id) on delete cascade,
 check(document_id<>resource_id)
);
create table public.fh_doses (
 resource_id uuid not null references public.fh_resources(id) on delete cascade, day date not null, slot text not null check(length(slot) between 1 and 80),
 taken_by uuid not null references auth.users(id) default auth.uid(), taken_at timestamptz not null default now(), primary key(resource_id,day,slot)
);
create table public.fh_extractions (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.fh_resources(id) on delete cascade,
 proposal jsonb not null check(jsonb_typeof(proposal)='object'), source text not null,
 confidence numeric not null check(confidence between 0 and 1), status text not null default 'pending' check(status in ('pending','confirmed','rejected')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.fh_audit (
 id bigint generated always as identity primary key, actor_id uuid, owner_id uuid not null,
 resource_id uuid, action text not null, created_at timestamptz not null default now()
);

-- Small internal lookups bypass only policy recursion, never auth/ownership.
create function fh_private.access(p_id uuid, p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.fh_resources r where r.id=p_id and
 (r.owner_id=auth.uid() or exists(select 1 from public.fh_grants g where g.resource_id=r.id and g.recipient_id=auth.uid() and (not p_write or g.permission='edit'))));
$$;
create function fh_private.owns(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.fh_resources where id=p_id and owner_id=auth.uid());
$$;
create function fh_private.member(p_family uuid, p_admin boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.fh_members where family_id=p_family and user_id=auth.uid() and (not p_admin or role='admin'));
$$;
revoke all on all functions in schema fh_private from public;
grant execute on function fh_private.access(uuid,boolean),fh_private.owns(uuid),fh_private.member(uuid,boolean) to authenticated;

alter table public.fh_families enable row level security;
alter table public.fh_members enable row level security;
alter table public.fh_resources enable row level security;
alter table public.fh_grants enable row level security;
alter table public.fh_document_refs enable row level security;
alter table public.fh_doses enable row level security;
alter table public.fh_extractions enable row level security;
alter table public.fh_audit enable row level security;
revoke all on public.fh_families,public.fh_members,public.fh_resources,public.fh_grants,public.fh_document_refs,public.fh_doses,public.fh_extractions,public.fh_audit from anon,authenticated;
grant select on public.fh_families,public.fh_members,public.fh_audit to authenticated;
grant select,insert,update,delete on public.fh_resources,public.fh_grants,public.fh_document_refs,public.fh_doses to authenticated;
grant select on public.fh_extractions to authenticated;
grant select,insert on public.fh_extractions to service_role;
create policy fh_families_read on public.fh_families for select to authenticated using(fh_private.member(id));
create policy fh_members_read on public.fh_members for select to authenticated using(fh_private.member(family_id));
-- Direct owner predicate also covers INSERT ... RETURNING: a stable lookup cannot
-- see the newly inserted row in the statement's original snapshot.
create policy fh_resource_read on public.fh_resources for select to authenticated using(owner_id=auth.uid() or fh_private.access(id));
create policy fh_resource_create on public.fh_resources for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from public.kv_persons p where p.id=person_id and p.user_id=auth.uid() and p.fh_kind in ('self','child')));
create policy fh_resource_edit on public.fh_resources for update to authenticated using(fh_private.access(id,true)) with check(fh_private.access(id,true));
create policy fh_resource_delete on public.fh_resources for delete to authenticated using(owner_id=auth.uid());
create policy fh_grants_read on public.fh_grants for select to authenticated using(recipient_id=auth.uid() or fh_private.owns(resource_id));
create policy fh_grants_create on public.fh_grants for insert to authenticated with check(fh_private.owns(resource_id));
create policy fh_grants_edit on public.fh_grants for update to authenticated using(fh_private.owns(resource_id)) with check(fh_private.owns(resource_id));
create policy fh_grants_delete on public.fh_grants for delete to authenticated using(fh_private.owns(resource_id));
create policy fh_refs_read on public.fh_document_refs for select to authenticated using(fh_private.access(document_id) and fh_private.access(resource_id));
create policy fh_refs_write on public.fh_document_refs for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and exists(select 1 from public.fh_resources where id=document_id and kind='document'));
create policy fh_doses_read on public.fh_doses for select to authenticated using(fh_private.access(resource_id));
create policy fh_doses_create on public.fh_doses for insert to authenticated with check(taken_by=auth.uid() and fh_private.access(resource_id,true) and exists(select 1 from public.fh_resources where id=resource_id and kind='medication' and (details->'slots') ? slot));
create policy fh_doses_delete on public.fh_doses for delete to authenticated using(fh_private.access(resource_id,true));
create policy fh_extractions_read on public.fh_extractions for select to authenticated using(fh_private.owns(document_id));
create policy fh_audit_read on public.fh_audit for select to authenticated using(owner_id=auth.uid());

create function fh_private.protect_resource() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.owner_id<>old.owner_id or new.person_id<>old.person_id or new.kind<>old.kind or new.storage_path is distinct from old.storage_path or new.mime_type is distinct from old.mime_type then
  raise exception 'Resource identity and file cannot be reassigned';
 end if;
 return new;
end $$;
create trigger fh_resource_identity before update on public.fh_resources for each row execute function fh_private.protect_resource();
create function fh_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.fh_resources; rid uuid; begin
 if tg_table_name='fh_resources' then
  if tg_op='DELETE' then r:=old; else r:=new; end if;
 else
  if tg_op='DELETE' then rid:=old.resource_id; else rid:=new.resource_id; end if;
  select * into r from public.fh_resources where id=rid;
 end if;
 if r.owner_id is not null then insert into public.fh_audit(actor_id,owner_id,resource_id,action) values(auth.uid(),r.owner_id,r.id,tg_table_name || ':' || tg_op); end if;
 return null;
end $$;
create trigger fh_resources_audit after insert or update or delete on public.fh_resources for each row execute function fh_private.audit_change();
create trigger fh_grants_audit after insert or update or delete on public.fh_grants for each row execute function fh_private.audit_change();
create trigger fh_doses_audit after insert or delete on public.fh_doses for each row execute function fh_private.audit_change();
create trigger fh_refs_audit after insert or delete on public.fh_document_refs for each row execute function fh_private.audit_change();

create function public.fh_record_open(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not fh_private.access(p_id) then raise exception 'Access denied'; end if;
 insert into public.fh_audit(actor_id,owner_id,resource_id,action) select auth.uid(),owner_id,id,'document:open' from public.fh_resources where id=p_id and kind='document';
end $$;
revoke all on function public.fh_record_open(uuid) from public;
grant execute on function public.fh_record_open(uuid) to authenticated;

-- Family administration never grants health/document access. No seeded people.
create function public.fh_create_family(p_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare fid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.fh_families(name) values(p_name) returning id into fid;
 insert into public.fh_members values(fid,auth.uid(),p_display_name,'admin'); return fid;
end $$;
create function public.fh_add_member(p_family uuid,p_user uuid,p_name text,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not fh_private.member(p_family,true) then raise exception 'Family administrator required'; end if;
 insert into public.fh_members values(p_family,p_user,p_name,p_role);
end $$;
-- Only trusted extraction workers may INSERT suggestions. Confirmation is atomic and owner-only.
create function public.fh_review_extraction(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare e public.fh_extractions; begin
 select * into e from public.fh_extractions where id=p_id for update;
 if not found or not fh_private.owns(e.document_id) then raise exception 'Owner required'; end if;
 if e.status<>'pending' then raise exception 'Already reviewed'; end if;
 if p_accept then update public.fh_resources set details=details || jsonb_build_object('confirmed_extraction',e.proposal,'extraction_source',e.source,'extraction_confidence',e.confidence) where id=e.document_id; end if;
 update public.fh_extractions set status=case when p_accept then 'confirmed' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 insert into public.fh_audit(actor_id,owner_id,resource_id,action) select auth.uid(),owner_id,id,'extraction:' || case when p_accept then 'confirmed' else 'rejected' end from public.fh_resources where id=e.document_id;
end $$;
revoke all on function public.fh_create_family(text,text),public.fh_add_member(uuid,uuid,text,text),public.fh_review_extraction(uuid,boolean) from public;
grant execute on function public.fh_create_family(text,text),public.fh_add_member(uuid,uuid,text,text),public.fh_review_extraction(uuid,boolean) to authenticated;
revoke all on all functions in schema fh_private from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fh-vault','fh-vault',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']);
update storage.buckets set public=false where id='kv-media';
drop policy if exists kv_media_read_public on storage.objects;
-- Support both legacy photos/<uid>/<file> and browser <uid>/<file> paths.
create function fh_private.photo_path(p text) returns boolean language sql stable set search_path='' as $$
 select auth.uid() is not null and (split_part(p,'/',1)=auth.uid()::text or (split_part(p,'/',1)='photos' and split_part(p,'/',2)=auth.uid()::text));
$$;
grant execute on function fh_private.photo_path(text) to authenticated;
revoke all on function fh_private.photo_path(text) from public;
create policy fh_media_read on storage.objects for select to authenticated using(bucket_id='kv-media' and fh_private.photo_path(name));
create policy fh_media_insert on storage.objects for insert to authenticated with check(bucket_id='kv-media' and fh_private.photo_path(name));
create policy fh_vault_read on storage.objects for select to authenticated using(bucket_id='fh-vault' and exists(select 1 from public.fh_resources where storage_path=name and kind='document'));
create policy fh_vault_insert on storage.objects for insert to authenticated with check(bucket_id='fh-vault' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.fh_resources where storage_path=name and owner_id=auth.uid() and kind='document'));
create policy fh_vault_delete on storage.objects for delete to authenticated using(bucket_id='fh-vault' and exists(select 1 from public.fh_resources where storage_path=name and owner_id=auth.uid()));
-- Isolate our buckets from unrelated permissive Storage policies in the shared project.
create policy fh_storage_read_fence on storage.objects as restrictive for select to public using(
 bucket_id not in ('kv-media','fh-vault') or (auth.uid() is not null and ((bucket_id='kv-media' and fh_private.photo_path(name)) or (bucket_id='fh-vault' and exists(select 1 from public.fh_resources where storage_path=name and kind='document')))));
create policy fh_storage_insert_fence on storage.objects as restrictive for insert to public with check(
 bucket_id not in ('kv-media','fh-vault') or (auth.uid() is not null and ((bucket_id='kv-media' and fh_private.photo_path(name)) or (bucket_id='fh-vault' and exists(select 1 from public.fh_resources where storage_path=name and owner_id=auth.uid() and kind='document')))));
create policy fh_storage_update_fence on storage.objects as restrictive for update to public using(bucket_id not in ('kv-media','fh-vault')) with check(bucket_id not in ('kv-media','fh-vault'));
create policy fh_storage_delete_fence on storage.objects as restrictive for delete to public using(
 bucket_id not in ('kv-media','fh-vault') or (auth.uid() is not null and ((bucket_id='kv-media' and fh_private.photo_path(name)) or (bucket_id='fh-vault' and exists(select 1 from public.fh_resources where storage_path=name and owner_id=auth.uid())))));
commit;
