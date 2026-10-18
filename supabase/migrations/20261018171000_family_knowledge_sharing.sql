-- Explicit, reciprocal sharing of Knowledge summaries among adults in one
-- Family Hub family. Health resources and Supabase Storage are NOT shared.
create table if not exists public.fh_knowledge_shares(
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,recipient_id),
  constraint fh_knowledge_share_not_self check(owner_id<>recipient_id)
);
alter table public.fh_knowledge_shares enable row level security;
drop policy if exists fh_knowledge_share_owner_select on public.fh_knowledge_shares;
create policy fh_knowledge_share_owner_select on public.fh_knowledge_shares for select
to authenticated using(fh_private.live_session() and owner_id=auth.uid());
drop policy if exists fh_knowledge_share_owner_insert on public.fh_knowledge_shares;
create policy fh_knowledge_share_owner_insert on public.fh_knowledge_shares for insert
to authenticated with check(
  fh_private.live_session() and owner_id=auth.uid()
  and exists(
    select 1 from public.fh_members owner_m
    join public.fh_members guest_m on guest_m.family_id=owner_m.family_id
    where owner_m.user_id=owner_id and guest_m.user_id=recipient_id
  )
);
drop policy if exists fh_knowledge_share_owner_delete on public.fh_knowledge_shares;
create policy fh_knowledge_share_owner_delete on public.fh_knowledge_shares for delete
to authenticated using(fh_private.live_session() and owner_id=auth.uid());
revoke all on public.fh_knowledge_shares from anon;
grant select,insert,delete on public.fh_knowledge_shares to authenticated;

-- A read-only feed: only owner's own records and Knowledge records explicitly
-- shared with this particular authenticated family member.
-- Photos expose only metadata; their private binary files remain owner-only.
create or replace function public.fh_knowledge_feed(p_limit integer default 50, p_offset integer default 0)
returns table (
  record_id uuid, record_type text, record_owner uuid, owner_name text,
  title text, summary text, link_url text, created_at timestamptz,
  mine boolean
)
language sql stable security definer set search_path=''
as $$
  with visible_accounts as (
    select auth.uid() as account
    where fh_private.live_session()
    union
    select s.owner_id from public.fh_knowledge_shares s
    where s.recipient_id=auth.uid() and fh_private.live_session()
      and exists(
        select 1 from public.fh_members own
        join public.fh_members recipient on recipient.family_id=own.family_id
        where own.user_id=s.owner_id and recipient.user_id=auth.uid()
      )
  ),
  entries as (
    select n.id as record_id,'note'::text as record_type,n.user_id as record_owner,
      left(n.content,160) as title,left(n.content,5000) as summary,
      null::text as link_url,n.created_at
    from public.kv_notes n join visible_accounts v on v.account=n.user_id
    union all
    select l.id,'link',l.user_id,left(coalesce(nullif(l.title,''),l.url),200),
      left(coalesce(nullif(l.summary,''),nullif(l.description,''),nullif(l.notes,''),''),5000),
      l.url,l.created_at
    from public.kv_links l join visible_accounts v on v.account=l.user_id
    union all
    select v.id,'video',v.user_id,left(coalesce(nullif(v.title,''),v.url),200),
      left(coalesce(nullif(v.description,''),nullif(v.notes,''),''),5000),
      v.url,v.created_at
    from public.kv_videos v join visible_accounts a on a.account=v.user_id
    union all
    select p.id,'photo',p.user_id,left(coalesce(p.filename,'Foto'),200),
      left(coalesce(p.description,''),5000),null::text,p.created_at
    from public.kv_photos p join visible_accounts v on v.account=p.user_id
  )
  select e.record_id,e.record_type,e.record_owner,
    coalesce((select m.display_name from public.fh_members m where m.user_id=e.record_owner
      and exists(select 1 from public.fh_members own where own.family_id=m.family_id
        and own.user_id=auth.uid()) limit 1),'Familienmitglied')::text as owner_name,
    e.title,e.summary,e.link_url,e.created_at,
    (e.record_owner=auth.uid()) as mine
  from entries e order by e.created_at desc nulls last
  limit greatest(1,least(coalesce(p_limit,50),100))
  offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.fh_knowledge_feed(integer,integer) from public,anon;
grant execute on function public.fh_knowledge_feed(integer,integer) to authenticated;
comment on table public.fh_knowledge_shares is
  'Owner-controlled Knowledge-only share. Never authorises health records or private Storage objects.';
