-- Video sharing with explicit owner approval.
create table if not exists public.fh_video_shares (
 owner_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(owner_id,recipient_id),
 check(owner_id<>recipient_id)
);
alter table public.fh_video_shares enable row level security;

create table if not exists public.fh_video_share_requests (
 owner_id uuid not null references auth.users(id),
 requester_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(owner_id,requester_id),
 check(owner_id<>requester_id)
);
alter table public.fh_video_share_requests enable row level security;

revoke all on public.fh_video_shares from anon;
revoke all on public.fh_video_share_requests from anon;
grant select,insert,delete on public.fh_video_shares to authenticated;
grant select,insert,delete on public.fh_video_share_requests to authenticated;

create policy fh_video_shares_read on public.fh_video_shares
 for select to authenticated using(
 fh_private.live_session() and (owner_id=auth.uid() or recipient_id=auth.uid()));
create policy fh_video_shares_create on public.fh_video_shares
 for insert to authenticated with check(
 fh_private.live_session() and owner_id=auth.uid()
 and exists(select 1 from public.fh_members own
  join public.fh_members guest on guest.family_id=own.family_id
  where own.user_id=owner_id and guest.user_id=recipient_id));
create policy fh_video_shares_delete on public.fh_video_shares
 for delete to authenticated using(fh_private.live_session() and owner_id=auth.uid());

create policy fh_video_request_read on public.fh_video_share_requests
 for select to authenticated using(
 fh_private.live_session() and (owner_id=auth.uid() or requester_id=auth.uid()));
create policy fh_video_request_insert on public.fh_video_share_requests
 for insert to authenticated with check(
 fh_private.live_session() and requester_id=auth.uid()
 and exists(select 1 from public.fh_members own
  join public.fh_members guest on guest.family_id=own.family_id
  where own.user_id=owner_id and guest.user_id=requester_id));
create policy fh_video_request_delete on public.fh_video_share_requests
 for delete to authenticated using(
 fh_private.live_session() and (owner_id=auth.uid() or requester_id=auth.uid()));

-- The catalogue recognises existing full-Knowledge grants and narrow video
-- grants. All accesses still require an active verified session and family.
create or replace function public.fh_knowledge_videos(
 p_limit integer default 36,p_offset integer default 0,p_owner uuid default null)
returns table (
 video_id uuid, record_owner uuid, owner_name text, assigned_person text,
 title text, description text, source_url text, thumbnail_url text,
 transcript_status text, created_at timestamptz, mine boolean, total_count bigint)
language sql stable security definer set search_path=''
as $fn$
 select v.id, v.user_id,
  coalesce((select m.display_name from public.fh_members m where m.user_id=v.user_id
   and exists(select 1 from public.fh_members me where me.user_id=auth.uid()
   and me.family_id=m.family_id) limit 1),
   case when v.user_id=auth.uid() then 'Ich' else 'Familienmitglied' end)::text,
  p.name,v.title,left(coalesce(v.description,''),3000),v.url,
  case when v.thumbnail_url like 'https://%' then v.thumbnail_url else null end,
  v.transcript_status,v.created_at,(v.user_id=auth.uid()),
  count(*) over()
 from public.kv_videos v
 left join public.kv_persons p on p.id=v.person_id
 where fh_private.live_session()
  and (p_owner is null or v.user_id=p_owner)
  and (v.user_id=auth.uid() or exists (
    select 1 from public.fh_knowledge_shares s
    join public.fh_members owner_m on owner_m.user_id=s.owner_id
    join public.fh_members viewer_m on viewer_m.user_id=s.recipient_id
     and owner_m.family_id=viewer_m.family_id
    where s.owner_id=v.user_id and s.recipient_id=auth.uid())
    or exists (
      select 1 from public.fh_video_shares s
      join public.fh_members own on own.user_id=s.owner_id
      join public.fh_members recipient on recipient.user_id=s.recipient_id
       and recipient.family_id=own.family_id
      where s.owner_id=v.user_id and s.recipient_id=auth.uid()
    ))
 order by v.created_at desc nulls last,v.id desc
 limit greatest(1,least(coalesce(p_limit,36),60))
 offset greatest(0,least(coalesce(p_offset,0),5000));
$fn$;
revoke all on function public.fh_knowledge_videos(integer,integer,uuid) from public,anon;
grant execute on function public.fh_knowledge_videos(integer,integer,uuid) to authenticated;
