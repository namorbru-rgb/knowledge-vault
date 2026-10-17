-- Read-only Knowledge MCP: separate knowledge sharing; does not change health grants or existing RLS.
create table if not exists public.kv_mcp_shares (
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id, recipient_id),
  constraint kv_mcp_shares_distinct check(owner_id <> recipient_id)
);
alter table public.kv_mcp_shares enable row level security;
revoke all on public.kv_mcp_shares from anon;
grant select, insert, delete on public.kv_mcp_shares to authenticated;
create policy kv_mcp_shares_read on public.kv_mcp_shares
  for select to authenticated using (
    (owner_id = auth.uid() or recipient_id = auth.uid()) and fh_private.live_session()
  );
create policy kv_mcp_shares_owner_insert on public.kv_mcp_shares
  for insert to authenticated with check (
    owner_id = auth.uid() and fh_private.live_session()
  );
create policy kv_mcp_shares_owner_delete on public.kv_mcp_shares
  for delete to authenticated using (
    owner_id = auth.uid() and fh_private.live_session()
  );

-- Definer reads implement a separate read-only view of shared Knowledge.
-- Existing restrictive owner fences remain untouched, and do not become write permissions.
create or replace function public.kv_mcp_search(
  p_query text default '', p_types text[] default null, p_limit integer default 30, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare q text := btrim(coalesce(p_query, ''));
        lim integer := least(greatest(coalesce(p_limit, 30), 1), 50);
        off integer := greatest(coalesce(p_offset, 0), 0);
        result jsonb;
begin
  if auth.uid() is null or not fh_private.live_session() then
    raise exception 'Unauthenticated' using errcode = '42501';
  end if;
  if length(q) > 200 or off > 50000 then
    raise exception 'Invalid query or offset' using errcode = '22023';
  end if;
  with allowed as (
    select auth.uid() as owner_id
    union
    select s.owner_id from public.kv_mcp_shares s
      where s.recipient_id = auth.uid()
  ), hits as (
    select 'video'::text as kind, v.id, coalesce(v.title,v.url) as title,
           left(concat_ws(' ',v.description,v.notes,v.url), 600) as snippet, v.created_at
    from public.kv_videos v join allowed a on a.owner_id=v.user_id
    where (p_types is null or 'video'=any(p_types))
      and (q='' or concat_ws(' ',v.title,v.description,v.notes,v.url) ilike '%'||q||'%')
    union all
    select 'video_segment',s.id,coalesce(v.title,v.url),
           left(s.text,600),s.created_at
    from public.kv_video_segments s
      join public.kv_videos v on v.id=s.video_id and v.user_id=s.user_id
      join allowed a on a.owner_id=s.user_id
    where (p_types is null or 'video_segment'=any(p_types))
      and (q='' or s.text ilike '%'||q||'%')
    union all
    select 'link',l.id,coalesce(l.title,l.url),
           left(concat_ws(' ',l.description,l.summary,l.main_text,l.notes,l.url),600),l.created_at
    from public.kv_links l join allowed a on a.owner_id=l.user_id
    where (p_types is null or 'link'=any(p_types))
      and (q='' or concat_ws(' ',l.title,l.description,l.summary,l.main_text,l.notes,l.url) ilike '%'||q||'%')
    union all
    select 'photo',p.id,coalesce(p.filename,'Foto'),
           left(concat_ws(' ',p.description,p.ocr_text,array_to_string(p.objects_detected, ' ')),600),p.created_at
    from public.kv_photos p join allowed a on a.owner_id=p.user_id
    where (p_types is null or 'photo'=any(p_types))
      and (q='' or concat_ws(' ',p.filename,p.description,p.ocr_text,array_to_string(p.objects_detected,' ')) ilike '%'||q||'%')
    union all
    select 'note',n.id,left(n.content,80),left(n.content,600),n.created_at
    from public.kv_notes n join allowed a on a.owner_id=n.user_id
    where (p_types is null or 'note'=any(p_types)) and (q='' or n.content ilike '%'||q||'%')
  ), page as (
    select * from hits order by created_at desc nulls last,kind,id limit lim+1 offset off
  )
  select jsonb_build_object(
    'results',coalesce(
      (select jsonb_agg(jsonb_build_object(
        'type',kind,'id',id,'title',title,'snippet',snippet,'created_at',created_at
      ) order by created_at desc nulls last,kind,id) from (select * from page limit lim) p),
      '[]'::jsonb
    ),
    'has_more',(select count(*) > lim from page),
    'offset',off,'limit',lim
  ) into result;
  return result;
end $$;

create or replace function public.kv_mcp_get(
  p_type text, p_id uuid, p_segment_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare output jsonb; seg_off integer := greatest(coalesce(p_segment_offset,0),0);
begin
  if auth.uid() is null or not fh_private.live_session() then
    raise exception 'Unauthenticated' using errcode = '42501';
  end if;
  if p_type not in ('video','video_segment','link','photo','note') or seg_off>50000 then
    raise exception 'Invalid type or offset' using errcode = '22023';
  end if;
  if p_type='video' then
    select jsonb_build_object(
      'type','video','id',v.id,'title',v.title,'url',v.url,
      'description',v.description,'notes',v.notes,'duration_seconds',v.duration_seconds,
      'transcript_status',v.transcript_status,'created_at',v.created_at,
      'transcript_offset',seg_off,
      'transcript_segments',coalesce((
        select jsonb_agg(jsonb_build_object('id',s.id,'start_time',s.start_time,'end_time',s.end_time,'text',s.text)
              order by s.start_time,s.id)
        from (
          select id,start_time,end_time,text from public.kv_video_segments
          where video_id=v.id and user_id=v.user_id order by start_time,id limit 100 offset seg_off
        ) s
      ),'[]'::jsonb),
      'transcript_has_more',(select count(*) > seg_off+100 from public.kv_video_segments
                             where video_id=v.id and user_id=v.user_id)
    ) into output
    from public.kv_videos v
    where v.id=p_id and (
      v.user_id=auth.uid() or exists (
       select 1 from public.kv_mcp_shares sh where sh.owner_id=v.user_id and sh.recipient_id=auth.uid()
      )
    );
  elsif p_type='video_segment' then
    select jsonb_build_object('type','video_segment','id',s.id,
      'video_id',v.id,'video_title',v.title,'video_url',v.url,
      'start_time',s.start_time,'end_time',s.end_time,'text',s.text,'created_at',s.created_at)
    into output from public.kv_video_segments s join public.kv_videos v
      on v.id=s.video_id and v.user_id=s.user_id
    where s.id=p_id and (s.user_id=auth.uid() or exists (
      select 1 from public.kv_mcp_shares sh where sh.owner_id=s.user_id and sh.recipient_id=auth.uid()
    ));
  elsif p_type='link' then
    select jsonb_build_object('type','link','id',l.id,'title',l.title,'url',l.url,
      'description',l.description,'summary',l.summary,'main_text',l.main_text,
      'notes',l.notes,'tags',l.tags,'status',l.status,'created_at',l.created_at)
    into output from public.kv_links l
    where l.id=p_id and (l.user_id=auth.uid() or exists (
      select 1 from public.kv_mcp_shares sh where sh.owner_id=l.user_id and sh.recipient_id=auth.uid()
    ));
  elsif p_type='photo' then
    select jsonb_build_object('type','photo','id',p.id,'filename',p.filename,
      'description',p.description,'ocr_text',p.ocr_text,
      'objects_detected',p.objects_detected,'status',p.status,'created_at',p.created_at)
    into output from public.kv_photos p
    where p.id=p_id and (p.user_id=auth.uid() or exists (
      select 1 from public.kv_mcp_shares sh where sh.owner_id=p.user_id and sh.recipient_id=auth.uid()
    ));
  elsif p_type='note' then
    select jsonb_build_object('type','note','id',n.id,'content',n.content,
      'video_id',n.video_id,'link_id',n.link_id,'photo_id',n.photo_id,'created_at',n.created_at)
    into output from public.kv_notes n
    where n.id=p_id and (n.user_id=auth.uid() or exists (
      select 1 from public.kv_mcp_shares sh where sh.owner_id=n.user_id and sh.recipient_id=auth.uid()
    ));
  end if;
  return output;
end $$;

revoke all on function public.kv_mcp_search(text,text[],integer,integer) from public,anon;
revoke all on function public.kv_mcp_get(text,uuid,integer) from public,anon;
grant execute on function public.kv_mcp_search(text,text[],integer,integer) to authenticated;
grant execute on function public.kv_mcp_get(text,uuid,integer) to authenticated;