-- Private family video catalogue. Each account sees its own videos and
-- videos whose owner explicitly granted Knowledge access to that account.
-- This function never reveals health records, private storage paths, or
-- unrelated users' Knowledge entries.
create or replace function public.fh_knowledge_videos(
  p_limit integer default 36,
  p_offset integer default 0,
  p_owner uuid default null
)
returns table (
  video_id uuid,
  record_owner uuid,
  owner_name text,
  assigned_person text,
  title text,
  description text,
  source_url text,
  thumbnail_url text,
  transcript_status text,
  created_at timestamptz,
  mine boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with permitted_accounts as (
    select auth.uid() as account_id
    where fh_private.live_session()
    union
    select s.owner_id
    from public.fh_knowledge_shares s
    join public.fh_members viewer_m
      on viewer_m.user_id = s.recipient_id
    join public.fh_members owner_m
      on owner_m.user_id = s.owner_id
     and owner_m.family_id = viewer_m.family_id
    where s.recipient_id = auth.uid()
      and fh_private.live_session()
  )
  select
    v.id as video_id,
    v.user_id as record_owner,
    coalesce(
      (select m.display_name
       from public.fh_members m
       where m.user_id = v.user_id
         and exists (
           select 1 from public.fh_members mine
           where mine.family_id = m.family_id and mine.user_id = auth.uid()
         )
       limit 1),
      case when v.user_id = auth.uid() then 'Ich' else 'Familienmitglied' end
    )::text as owner_name,
    p.name as assigned_person,
    v.title,
    left(coalesce(v.description,''), 3000) as description,
    v.url as source_url,
    case
      when v.thumbnail_url like 'https://%' or v.thumbnail_url like 'http://%'
      then v.thumbnail_url else null
    end as thumbnail_url,
    v.transcript_status,
    v.created_at,
    (v.user_id = auth.uid()) as mine,
    count(*) over() as total_count
  from public.kv_videos v
  join permitted_accounts permitted on permitted.account_id = v.user_id
  left join public.kv_persons p on p.id = v.person_id
  where p_owner is null or v.user_id = p_owner
  order by v.created_at desc nulls last, v.id desc
  limit greatest(1, least(coalesce(p_limit,36),60))
  offset greatest(0, least(coalesce(p_offset,0),5000));
$$;

revoke all on function public.fh_knowledge_videos(integer,integer,uuid)
  from public, anon;
grant execute on function public.fh_knowledge_videos(integer,integer,uuid)
  to authenticated;
comment on function public.fh_knowledge_videos(integer,integer,uuid) is
  'Authorized read-only family video catalogue. Explicit Knowledge share required for viewing another account.';
