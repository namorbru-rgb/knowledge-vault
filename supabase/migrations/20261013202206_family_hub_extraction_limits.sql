begin;
create table fh_private.extraction_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,started_at timestamptz not null default now(),finished_at timestamptz);
revoke all on fh_private.extraction_requests from public,anon,authenticated;
create index fh_extraction_user_time on fh_private.extraction_requests(user_id,started_at);
create function public.fh_begin_extraction(p_user uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('family-hub-extraction',0));
 if (select count(*) from fh_private.extraction_requests where user_id=p_user and started_at>now()-interval '1 hour')>=3
 or exists(select 1 from fh_private.extraction_requests where user_id=p_user and finished_at is null and started_at>now()-interval '2 minutes')
 or (select count(*) from fh_private.extraction_requests where finished_at is null and started_at>now()-interval '2 minutes')>=3 then
  return null;
 end if;
 insert into fh_private.extraction_requests(user_id) values(p_user) returning id into result;return result;
end $$;
create function public.fh_end_extraction(p_id uuid) returns void language sql security definer set search_path='' as $$update fh_private.extraction_requests set finished_at=now() where id=p_id;$$;
revoke all on function public.fh_begin_extraction(uuid),public.fh_end_extraction(uuid) from public,anon,authenticated;
grant execute on function public.fh_begin_extraction(uuid),public.fh_end_extraction(uuid) to service_role;
commit;
