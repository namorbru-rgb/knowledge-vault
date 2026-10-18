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
