begin;
-- Exposed RPCs are invoker wrappers; privileged implementations remain private.
alter function public.fh_create_family(text,text) set schema fh_private;
alter function public.fh_add_member(uuid,uuid,text,text) set schema fh_private;
alter function public.fh_record_open(uuid) set schema fh_private;
alter function public.fh_review_extraction(uuid,boolean) set schema fh_private;
create function public.fh_create_family(p_name text,p_display_name text) returns uuid language sql security invoker set search_path='' as $$select fh_private.fh_create_family(p_name,p_display_name);$$;
create function public.fh_add_member(p_family uuid,p_user uuid,p_name text,p_role text) returns void language sql security invoker set search_path='' as $$select fh_private.fh_add_member(p_family,p_user,p_name,p_role);$$;
create function public.fh_record_open(p_id uuid) returns void language sql security invoker set search_path='' as $$select fh_private.fh_record_open(p_id);$$;
create function public.fh_review_extraction(p_id uuid,p_accept boolean) returns void language sql security invoker set search_path='' as $$select fh_private.fh_review_extraction(p_id,p_accept);$$;
revoke all on function public.fh_create_family(text,text),public.fh_add_member(uuid,uuid,text,text),public.fh_record_open(uuid),public.fh_review_extraction(uuid,boolean) from public,anon;
grant execute on function public.fh_create_family(text,text),public.fh_add_member(uuid,uuid,text,text),public.fh_record_open(uuid),public.fh_review_extraction(uuid,boolean) to authenticated;
commit;
