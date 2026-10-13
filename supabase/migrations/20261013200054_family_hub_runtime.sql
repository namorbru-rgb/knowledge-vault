begin;
-- Old JWTs stop accessing Hub/Knowledge as soon as their Auth session is revoked.
create function fh_private.live_session() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
 and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()));
$$;
revoke all on function fh_private.live_session() from public;
grant execute on function fh_private.live_session() to authenticated;
do $$declare t text; begin
 foreach t in array array['kv_profiles','kv_persons','kv_categories','kv_videos','kv_links','kv_photos','kv_notes','kv_video_segments','kv_api_keys','fh_families','fh_members','fh_resources','fh_grants','fh_document_refs','fh_doses','fh_extractions','fh_audit'] loop
  execute format('create policy fh_session_fence on public.%I as restrictive for all to authenticated using(fh_private.live_session()) with check(fh_private.live_session())',t);
 end loop;
end $$;
create policy fh_storage_session_fence on storage.objects as restrictive for all to authenticated
 using(bucket_id not in ('kv-media','fh-vault') or fh_private.live_session())
 with check(bucket_id not in ('kv-media','fh-vault') or fh_private.live_session());
create or replace function fh_private.access(p_id uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select fh_private.live_session() and exists(select 1 from public.fh_resources r where r.id=p_id and
 (r.owner_id=auth.uid() or exists(select 1 from public.fh_grants g where g.resource_id=r.id and g.recipient_id=auth.uid() and (not p_write or g.permission='edit'))));
$$;
create or replace function fh_private.owns(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select fh_private.live_session() and exists(select 1 from public.fh_resources where id=p_id and owner_id=auth.uid());
$$;
create or replace function fh_private.member(p_family uuid,p_admin boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select fh_private.live_session() and exists(select 1 from public.fh_members where family_id=p_family and user_id=auth.uid() and (not p_admin or role='admin'));
$$;
create or replace function public.fh_create_family(p_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare fid uuid; begin
 if not fh_private.live_session() then raise exception 'Active personal session required'; end if;
 insert into public.fh_families(name) values(p_name) returning id into fid;
 insert into public.fh_members values(fid,auth.uid(),p_display_name,'admin'); return fid;
end $$;

create table public.fh_push_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null default ((auth.jwt()->>'session_id')::uuid) references auth.sessions(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<2048),p256dh text not null check(length(p256dh) between 40 and 200),
 auth text not null check(length(auth) between 16 and 100),timezone text not null default 'Europe/Zurich',created_at timestamptz not null default now()
);
alter table public.fh_push_subscriptions enable row level security;
revoke all on public.fh_push_subscriptions from anon,authenticated;
grant select,insert,delete on public.fh_push_subscriptions to authenticated;
create policy fh_push_own on public.fh_push_subscriptions for all to authenticated
 using(user_id=auth.uid() and fh_private.live_session()) with check(user_id=auth.uid() and fh_private.live_session() and exists(select 1 from pg_timezone_names where name=timezone));
create table fh_private.push_outbox (
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.fh_push_subscriptions(id) on delete cascade,
 resource_id uuid not null references public.fh_resources(id) on delete cascade,scheduled_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),attempts integer not null default 0,
 leased_until timestamptz,next_try_at timestamptz not null default now(),sent_at timestamptz,
 unique(subscription_id,resource_id,scheduled_at)
);
revoke all on fh_private.push_outbox from public,anon,authenticated;
grant select,update,delete on fh_private.push_outbox to service_role;
grant select,delete on public.fh_push_subscriptions to service_role;
create function public.fh_queue_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare n integer; begin
 with candidates as (
  select r.id resource_id,s.id subscription_id,r.occurred_at scheduled_at
  from public.fh_resources r join public.fh_push_subscriptions s on s.user_id=r.owner_id
  where r.kind in ('reminder','visit','examination') and (r.details->'notify') is distinct from 'false'::jsonb
   and r.occurred_at between p_now-interval '5 minutes' and p_now
  union all
  select r.id,s.id,(((p_now at time zone s.timezone)::date)::text || ' ' || slot.value)::timestamp at time zone s.timezone
  from public.fh_resources r join public.fh_push_subscriptions s on s.user_id=r.owner_id
  cross join lateral jsonb_array_elements_text(case when r.kind='medication' then r.details->'slots' else '[]'::jsonb end) slot(value)
  where r.kind='medication' and (r.details->'notify') is distinct from 'false'::jsonb
   and (r.occurred_at at time zone s.timezone)::date<=(p_now at time zone s.timezone)::date
   and not exists(select 1 from public.fh_doses d where d.resource_id=r.id and d.day=(p_now at time zone s.timezone)::date and d.slot=slot.value)
 ), due as (select * from candidates where scheduled_at between p_now-interval '5 minutes' and p_now)
 insert into fh_private.push_outbox(subscription_id,resource_id,scheduled_at)
 select subscription_id,resource_id,scheduled_at from due on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
create function public.fh_claim_push(p_limit integer default 30) returns table(id uuid,endpoint text,p256dh text,auth text) language sql security definer set search_path='' as $$
 with claimed as (update fh_private.push_outbox o set state='sending',attempts=attempts+1,leased_until=now()+interval '2 minutes'
 where o.id in (select q.id from fh_private.push_outbox q where q.attempts<3 and q.next_try_at<=now() and (q.state='pending' or (q.state='sending' and q.leased_until<now())) order by q.scheduled_at for update skip locked limit least(greatest(p_limit,1),100))
 returning o.id,o.subscription_id)
 select c.id,s.endpoint,s.p256dh,s.auth from claimed c join public.fh_push_subscriptions s on s.id=c.subscription_id;
$$;
create function public.fh_push_runtime() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_object_agg(name,decrypted_secret) from vault.decrypted_secrets where name in ('family_hub_vapid_public','family_hub_vapid_private','family_hub_cron');
$$;
revoke all on function public.fh_queue_reminders(timestamptz),public.fh_claim_push(integer),public.fh_push_runtime() from public,anon,authenticated;
grant execute on function public.fh_queue_reminders(timestamptz),public.fh_claim_push(integer),public.fh_push_runtime() to service_role;
create function public.fh_finish_push(p_id uuid,p_success boolean,p_gone boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_gone then delete from public.fh_push_subscriptions where id=(select subscription_id from fh_private.push_outbox where id=p_id);return;end if;
 update fh_private.push_outbox set state=case when p_success then 'sent' when attempts>=3 then 'failed' else 'pending' end,
  sent_at=case when p_success then now() else null end,leased_until=null,next_try_at=now()+interval '2 minutes' where id=p_id;
end $$;
revoke all on function public.fh_finish_push(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.fh_finish_push(uuid,boolean,boolean) to service_role;
create function public.fh_session_active() returns boolean language sql stable security invoker set search_path='' as $$select fh_private.live_session();$$;
revoke all on function public.fh_session_active() from public,anon;
grant execute on function public.fh_session_active() to authenticated;
commit;
